from fastapi import APIRouter, HTTPException, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, text
from typing import List, Optional, Dict, Any
from app.core.db import get_db, get_read_db
from sqlalchemy import select
from app.services.google_sheets_service import google_sheets_service
from app.models.base import Evaluation
import logging
import json
import gspread

logger = logging.getLogger(__name__)

router = APIRouter()


@router.get("/list", response_model=Dict[str, List[Dict[str, Any]]])
async def get_sheets_list():
    """Get list of available sheets from Google Spreadsheet"""
    try:
        worksheets = google_sheets_service.list_worksheets()
        sheets_info = []

        for sheet_name in worksheets:
            try:
                # Try to get worksheet info
                worksheet = google_sheets_service.get_worksheet(sheet_name)
                if worksheet:
                    sheets_info.append({
                        "title": sheet_name,
                        "sheetId": hash(sheet_name),  # Simple ID generation
                        "index": worksheets.index(sheet_name),
                        "sheetType": "GRID",
                        "gridProperties": {
                            "rowCount": 1000,  # Default
                            "columnCount": 26   # Default
                        }
                    })
            except Exception as e:
                logger.warning(f"Could not get info for sheet {sheet_name}: {e}")
                # Still include the sheet with basic info
                sheets_info.append({
                    "title": sheet_name,
                    "sheetId": hash(sheet_name),
                    "index": worksheets.index(sheet_name),
                    "sheetType": "GRID",
                    "gridProperties": {
                        "rowCount": 1000,
                        "columnCount": 26
                    }
                })

        return {"sheets": sheets_info}
    except FileNotFoundError as e:
        logger.error(f"Google Sheets credentials not configured: {e}")
        raise HTTPException(
            status_code=503,
            detail="Google Sheets credentials not found. Please check that credentials.json exists and has correct permissions."
        )
    except gspread.exceptions.SpreadsheetNotFound as e:
        logger.error(f"Google Spreadsheet not found: {e}")
        raise HTTPException(
            status_code=503,
            detail="Google Spreadsheet not found. Please verify the SPREADSHEET_ID in environment variables."
        )
    except gspread.exceptions.APIError as e:
        logger.error(f"Google Sheets API error: {e}")
        error_details = str(e).lower()
        if "quota" in error_details or "limit" in error_details:
            raise HTTPException(
                status_code=429,
                detail="Google Sheets API quota exceeded. Please try again later."
            )
        elif "permission" in error_details or "access" in error_details:
            raise HTTPException(
                status_code=403,
                detail="Insufficient permissions to access Google Spreadsheet. Please check service account permissions."
            )
        else:
            raise HTTPException(
                status_code=503,
                detail=f"Google Sheets API error: {str(e)}"
            )
    except Exception as e:
        logger.error(f"Error getting sheets list: {e}")
        error_str = str(e).lower()
        if "network" in error_str or "connection" in error_str:
            raise HTTPException(
                status_code=503,
                detail="Network connection error. Please check your internet connection and try again."
            )
        else:
            raise HTTPException(
                status_code=500,
                detail=f"Failed to get sheets list: {str(e)}"
            )


async def _get_conversations_from_read_db(
    db: AsyncSession,
    qa_filter: Optional[str] = None,
    overall_filter: Optional[str] = None,
    review_filter: Optional[str] = None,
    limit: int = 200,
    offset: int = 0
) -> List[Dict[str, Any]]:
    """Get conversations from read database (legacy data)"""
    try:
        # Build SQL query for conversations from read DB
        sql = text("""
            SELECT
                c.id,
                c.conversation_id,
                c.customer_phone,
                c.bot_id,
                c.created_at,
                c.updated_at
            FROM conversation c
            WHERE c.customer_phone IS NOT NULL AND TRIM(c.customer_phone) <> ''
            ORDER BY c.created_at DESC
            LIMIT :limit OFFSET :offset
        """)

        result = await db.execute(sql, {"limit": limit, "offset": offset})
        rows = result.mappings().all()

        return [{
            "conversation_id": row.conversation_id or "",
            "customer_phone": row.customer_phone or "",
            "bot_id": str(row.bot_id) if row.bot_id else "",
            "created_at": row.created_at.isoformat() if row.created_at else "",
            "evaluation_result": None,  # Will be filled from write DB
            "reviewed": False,  # Will be filled from write DB
            "review_note": ""  # Will be filled from write DB
        } for row in rows]
    except Exception as e:
        logger.error(f"Error getting conversations from read DB: {e}")
        raise

async def _get_evaluations_from_write_db(
    write_db: AsyncSession,
    conversation_ids: List[str]
) -> Dict[str, Dict[str, Any]]:
    """Get evaluations from write database"""
    try:
        if not conversation_ids:
            return {}

        # Query evaluations for the conversation IDs
        query = select(Evaluation).where(Evaluation.conversation_id.in_(conversation_ids))
        result = await write_db.execute(query)
        evaluations = result.scalars().all()

        return {
            eval.conversation_id: {
                "evaluation_result": eval.evaluation_result,
                "reviewed": eval.reviewed or False,
                "review_note": eval.review_note or ""
            }
            for eval in evaluations
        }
    except Exception as e:
        logger.error(f"Error getting evaluations from write DB: {e}")
        return {}

@router.get("/conversations", response_model=Dict[str, List[Dict[str, Any]]])
async def get_conversations_for_sheets(
    read_db: AsyncSession = Depends(get_read_db),
    write_db: AsyncSession = Depends(get_db),
    qa_filter: Optional[str] = Query(None, description="QA filter: all, qa, notqa"),
    overall_filter: Optional[str] = Query(None, description="Overall filter: all, good, warn, bad, other"),
    review_filter: Optional[str] = Query(None, description="Review filter: all, reviewed, notreviewed"),
    limit: int = Query(200, description="Limit number of results"),
    offset: int = Query(0, description="Offset for pagination")
):
    """Get conversations that have been evaluated or reviewed for sheets update"""
    try:
        # Get conversations from read database
        conversations = await _get_conversations_from_read_db(
            read_db, qa_filter, overall_filter, review_filter, limit, offset
        )

        if not conversations:
            return {"conversations": []}

        # Get conversation IDs
        conversation_ids = [conv["conversation_id"] for conv in conversations]

        # Get evaluations from write database
        evaluations_map = await _get_evaluations_from_write_db(write_db, conversation_ids)

        # Merge evaluation data into conversations
        for conv in conversations:
            conv_id = conv["conversation_id"]
            if conv_id in evaluations_map:
                eval_data = evaluations_map[conv_id]
                conv["evaluation_result"] = eval_data["evaluation_result"]
                conv["reviewed"] = eval_data["reviewed"]
                conv["review_note"] = eval_data["review_note"]

        # Apply filters that depend on evaluation data
        filtered_conversations = []
        for conv in conversations:
            # QA filter
            has_evaluation = conv["evaluation_result"] is not None
            if qa_filter == "qa" and not has_evaluation:
                continue
            elif qa_filter == "notqa" and has_evaluation:
                continue

            # Review filter
            is_reviewed = conv["reviewed"]
            if review_filter == "reviewed" and not is_reviewed:
                continue
            elif review_filter == "notreviewed" and is_reviewed:
                continue

            # Overall filter (simplified - just check if evaluation exists)
            if overall_filter and overall_filter != "all":
                if overall_filter in ["good", "warn", "bad"] and not has_evaluation:
                    continue

            filtered_conversations.append(conv)

        return {"conversations": filtered_conversations}

    except FileNotFoundError as e:
        logger.error(f"Google Sheets credentials not configured: {e}")
        raise HTTPException(
            status_code=503,
            detail="Google Sheets integration not configured. Please add credentials.json file and configure GOOGLE_SHEET_CREDENTIALS_PATH in environment variables."
        )
    except Exception as e:
        logger.error(f"Error getting conversations for sheets: {e}")

        # Check if it's a table not found error
        error_str = str(e)
        if "UndefinedTableError" in error_str or "doesn't exist" in error_str or "does not exist" in error_str:
            raise HTTPException(
                status_code=503,
                detail="Database configuration issue detected. The database tables ('conversation', 'evaluations') don't exist or there's a database type mismatch. Please check: 1) Database is properly initialized with tables, 2) DATABASE_READ_URL points to correct database, 3) Database type consistency (PostgreSQL vs MySQL)."
            )
        else:
            raise HTTPException(status_code=500, detail=f"Failed to get conversations: {str(e)}")


@router.post("/update", response_model=Dict[str, Any])
async def update_google_sheets(
    requests: List[Dict[str, Any]],
    db: AsyncSession = Depends(get_db)
):
    """Update Google Sheets with conversation records"""
    try:
        successful_updates = 0
        failed_updates = 0
        errors = []

        for request in requests:
            sheet_name = request.get("sheet_name")
            records = request.get("records", [])

            if not sheet_name:
                errors.append(f"Missing sheet_name in request: {request}")
                failed_updates += 1
                continue

            if not records:
                errors.append(f"No records to update for sheet: {sheet_name}")
                failed_updates += 1
                continue

            try:
                # Use the Google Sheets service to insert records
                success = google_sheets_service.insert_multiple_to_top(
                    sheet_name=sheet_name,
                    records=records
                )

                if success:
                    successful_updates += 1
                    logger.info(f"Successfully updated {len(records)} records to sheet: {sheet_name}")
                else:
                    failed_updates += 1
                    errors.append(f"Failed to update sheet: {sheet_name}")

            except Exception as e:
                failed_updates += 1
                error_msg = f"Error updating sheet {sheet_name}: {str(e)}"
                errors.append(error_msg)
                logger.error(error_msg)

        return {
            "success": failed_updates == 0,
            "message": f"Updated {successful_updates} sheet(s) successfully, {failed_updates} failed",
            "successful_updates": successful_updates,
            "failed_updates": failed_updates,
            "errors": errors
        }
    except FileNotFoundError as e:
        logger.error(f"Google Sheets credentials not configured: {e}")
        raise HTTPException(
            status_code=503,
            detail="Google Sheets integration not configured. Please add credentials.json file and configure GOOGLE_SHEET_CREDENTIALS_PATH in environment variables."
        )
    except Exception as e:
        logger.error(f"Error in update_google_sheets: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to update sheets: {str(e)}")
