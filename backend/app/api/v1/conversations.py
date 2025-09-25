from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, text
from typing import List, Optional
from pydantic import BaseModel
from app.core.db import get_read_db, get_db
from app.services.legacy_queries import fetch_conversations_time_range
from app.models.base import Evaluation, Bot
from datetime import datetime
import json
import logging
import re
from app.core.redis import get_redis

logger = logging.getLogger(__name__)

def normalize_phone_number(phone: str) -> str:
    """Normalize phone number for consistent search.
    - Remove all non-digit characters
    - Handle Vietnamese phone numbers (+84, 0 prefixes)
    - Support partial matching
    """
    if not phone:
        return phone

    # Remove all non-digit characters
    normalized = re.sub(r'\D', '', phone)

    # Handle Vietnamese phone numbers
    if normalized.startswith('84'):
        normalized = normalized[2:]  # Remove country code
    elif normalized.startswith('0') and len(normalized) == 10:
        normalized = normalized[1:]  # Remove leading 0 for Vietnamese numbers

    return normalized

router = APIRouter()

class ConversationResponse(BaseModel):
    id: int
    conversation_id: Optional[str]
    customer_phone: Optional[str]
    bot_id: Optional[int]
    created_at: Optional[datetime]
    updated_at: Optional[datetime]


class SpanResponse(BaseModel):
    id: str
    conversation_id: str
    turn_idx: int
    role: str
    text: str
    embedding: Optional[List[float]]
    created_at: datetime

@router.get("/", response_model=List[ConversationResponse])
async def list_conversations(
    bot_id: Optional[int] = None,
    start_ts: Optional[str] = None,
    end_ts: Optional[str] = None,
    phone_like: Optional[str] = None,
    conversation_id_like: Optional[str] = None,
    bot_name_like: Optional[str] = None,
    qa_status: Optional[str] = None,  # "qa", "notqa", or None
    limit: int = 50,
    offset: int = 0,
    db: AsyncSession = Depends(get_read_db),
    write_db: AsyncSession = Depends(get_db)
):
    """List conversations from read DB with filters. Only returns CALLs (exclude chats).

    - bot_id: legacy bot id (int)
    - start_ts, end_ts: ISO timestamps or DB-compatible datetime strings
    - phone_like: phone number search pattern
    - conversation_id_like: conversation ID search pattern (partial match)
    - bot_name_like: bot name search pattern (partial match)
    - qa_status: "qa" (has evaluation), "notqa" (no evaluation), or None (all)
    - limit: max rows
    """
    # Try cache first
    cache_key = f"conv:list:{bot_id}:{start_ts}:{end_ts}:{phone_like}:{conversation_id_like}:{bot_name_like}:{qa_status}:{limit}:{offset}"
    redis = await get_redis()
    cached = await redis.get(cache_key)
    if cached:
        try:
            data = json.loads(cached)
            return [ConversationResponse(**x) for x in data]
        except Exception:
            pass

    # Base SQL query for conversations (from read DB)
    # Note: QA status filtering will be handled in Python after joining with evaluations
    # Build SQL query conditionally based on bot_name_like parameter
    if bot_name_like:
        # If bot name filtering is requested, try to join with bot table
        sql = text(
            """
            SELECT
              c.id,
              c.conversation_id,
              c.customer_phone,
              c.bot_id,
              c.created_at,
              c.updated_at
            FROM conversation c
            LEFT JOIN bot b ON c.bot_id = b.bot_index
            WHERE (c.customer_phone IS NOT NULL AND TRIM(c.customer_phone) <> '')
              AND (:bot_id IS NULL OR c.bot_id = :bot_id)
              AND (:start_ts IS NULL OR c.created_at >= :start_ts)
              AND (:end_ts IS NULL OR c.created_at < :end_ts)
              AND (:phone_like IS NULL OR TRIM(c.customer_phone) LIKE :phone_like)
              AND (:conversation_id_like IS NULL OR c.conversation_id LIKE :conversation_id_like)
              AND (:bot_name_like IS NULL OR b.name LIKE :bot_name_like)
            ORDER BY c.created_at DESC
            LIMIT :limit
            OFFSET :offset
            """
        )
    else:
        # If no bot name filtering, use the original query without JOIN
        sql = text(
            """
            SELECT
              c.id,
              c.conversation_id,
              c.customer_phone,
              c.bot_id,
              c.created_at,
              c.updated_at
            FROM conversation c
            WHERE (c.customer_phone IS NOT NULL AND TRIM(c.customer_phone) <> '')
              AND (:bot_id IS NULL OR c.bot_id = :bot_id)
              AND (:start_ts IS NULL OR c.created_at >= :start_ts)
              AND (:end_ts IS NULL OR c.created_at < :end_ts)
              AND (:phone_like IS NULL OR TRIM(c.customer_phone) LIKE :phone_like)
              AND (:conversation_id_like IS NULL OR c.conversation_id LIKE :conversation_id_like)
            ORDER BY c.created_at DESC
            LIMIT :limit
            OFFSET :offset
            """
        )
    # Normalize phone number for search (MariaDB compatible)
    normalized_phone = phone_like  # Keep original for now since we simplified the SQL

    params = {
        "bot_id": bot_id,
        "start_ts": start_ts,
        "end_ts": end_ts,
        "phone_like": (f"%{normalized_phone}%" if normalized_phone else None),
        "conversation_id_like": (f"%{conversation_id_like}%" if conversation_id_like else None),
        "bot_name_like": (f"%{bot_name_like}%" if bot_name_like else None),
        "qa_status": qa_status,
        "limit": limit,
        "offset": offset,
    }
    # Execute query with error handling for missing bot table
    try:
        result = await db.execute(sql, params)
        calls = result.mappings().all()
    except Exception as e:
        logger.warning(f"Error executing conversations query: {e}")
        # If bot name filtering is requested but fails, fall back to query without bot filtering
        if bot_name_like:
            logger.info("Falling back to query without bot name filtering")
            fallback_sql = text(
                """
                SELECT
                  c.id,
                  c.conversation_id,
                  c.customer_phone,
                  c.bot_id,
                  c.created_at,
                  c.updated_at
                FROM conversation c
                WHERE (c.customer_phone IS NOT NULL AND TRIM(c.customer_phone) <> '')
                  AND (:bot_id IS NULL OR c.bot_id = :bot_id)
                  AND (:start_ts IS NULL OR c.created_at >= :start_ts)
                  AND (:end_ts IS NULL OR c.created_at < :end_ts)
                  AND (:phone_like IS NULL OR
                       REPLACE(REPLACE(REPLACE(REPLACE(TRIM(c.customer_phone), '+84', ''), ' ', ''), '-', '') LIKE :phone_like OR
                       REPLACE(REPLACE(REPLACE(REPLACE(TRIM(c.customer_phone), '+84', '0'), ' ', ''), '-', '') LIKE :phone_like)
                  AND (:conversation_id_like IS NULL OR c.conversation_id LIKE :conversation_id_like)
                ORDER BY c.created_at DESC
                LIMIT :limit
                OFFSET :offset
                """
            )
            fallback_params = {
                "bot_id": bot_id,
                "start_ts": start_ts,
                "end_ts": end_ts,
                "phone_like": (f"%{normalized_phone}%" if normalized_phone else None),
                "conversation_id_like": (f"%{conversation_id_like}%" if conversation_id_like else None),
                "limit": limit,
                "offset": offset,
            }
            result = await db.execute(fallback_sql, fallback_params)
            calls = result.mappings().all()
        else:
            # Re-raise if it's not a bot name filtering issue
            raise

    # Get conversation IDs to query evaluations from write DB
    conversation_ids = [call["conversation_id"] for call in calls if call["conversation_id"]]

    # Query evaluations from write DB
    evaluations_map = {}
    if conversation_ids:
        try:
            # Query evaluations for these conversation IDs from write DB
            eval_query = select(Evaluation).where(Evaluation.conversation_id.in_(conversation_ids))
            eval_result = await write_db.execute(eval_query)
            evaluations = eval_result.scalars().all()

            # Create a map of conversation_id -> evaluation
            for eval in evaluations:
                evaluations_map[eval.conversation_id] = eval
        except Exception as e:
            logger.warning(f"Could not fetch evaluations from write DB: {e}")
            # Continue without evaluations

    # Create payload with evaluation data and apply QA status filtering
    payload = []
    for r in calls:
        conv_id = r["conversation_id"]
        evaluation = evaluations_map.get(conv_id)

        # Apply QA status filtering
        if qa_status:
            has_evaluation = evaluation is not None
            if qa_status == "qa" and not has_evaluation:
                continue  # Skip conversations without evaluations
            elif qa_status == "notqa" and has_evaluation:
                continue  # Skip conversations with evaluations

        payload.append(
            ConversationResponse(
                id=r["id"],
                conversation_id=conv_id,
                customer_phone=r["customer_phone"],
                bot_id=r["bot_id"],
                created_at=r["created_at"],
                updated_at=r["updated_at"],
                # Note: We would need to extend ConversationResponse to include evaluation fields
                # For now, just include basic data
            )
        )
    try:
        # Conversations TTL: 5 hours
        await redis.setex(cache_key, 5 * 60 * 60, json.dumps([p.dict() for p in payload]))
    except Exception:
        pass
    return payload

@router.get("/{conversation_id}", response_model=ConversationResponse)
async def get_conversation(conversation_id: str, db: AsyncSession = Depends(get_read_db)):
    """Get a specific conversation from legacy read DB by conversation_id string."""
    sql = text(
        """
        SELECT id, conversation_id, customer_phone, bot_id, created_at, updated_at
        FROM conversation
        WHERE conversation_id = :cid
        LIMIT 1
        """
    )
    try:
        result = await db.execute(sql, {"cid": conversation_id})
        row = result.mappings().first()
    except Exception:
        row = None
    if not row:
        raise HTTPException(status_code=404, detail="Conversation not found")

    return ConversationResponse(
        id=row["id"],
        conversation_id=row["conversation_id"],
        customer_phone=row["customer_phone"],
        bot_id=row["bot_id"],
        created_at=row["created_at"],
        updated_at=row["updated_at"],
    )

@router.get("/{conversation_id}/spans", response_model=List[SpanResponse])
async def get_conversation_spans(conversation_id: str, db: AsyncSession = Depends(get_read_db)):
    """Parse spans from legacy conversation.bot_memory (no DB writes)."""
    sql = text(
        """
        SELECT id, conversation_id, bot_memory, created_at
        FROM conversation
        WHERE conversation_id = :cid
        LIMIT 1
        """
    )
    try:
        result = await db.execute(sql, {"cid": conversation_id})
        row = result.mappings().first()
    except Exception:
        row = None
    if not row:
        return []

    spans: List[SpanResponse] = []
    created_at = row.get("created_at")
    raw_memory = row.get("bot_memory")

    if not raw_memory:
        return []

    try:
        memory_obj = json.loads(raw_memory) if isinstance(raw_memory, str) else raw_memory
        messages = memory_obj.get("messages", []) if isinstance(memory_obj, dict) else []
        for idx, msg in enumerate(messages):
            role = msg.get("role") if isinstance(msg, dict) else None
            content = msg.get("content") if isinstance(msg, dict) else None
            if not role or content is None:
                continue
            spans.append(
                SpanResponse(
                    id=f"{conversation_id}:{idx}",
                    conversation_id=conversation_id,
                    turn_idx=idx,
                    role=str(role),
                    text=str(content),
                    embedding=None,
                    created_at=created_at,
                )
            )
    except Exception:
        # On malformed JSON, fall back to empty spans
        return []

    return spans
