from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, text
from typing import List, Optional
from pydantic import BaseModel
from app.core.db import get_read_db, get_db
from app.services.legacy_queries import fetch_conversations_time_range
from datetime import datetime
import json

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
    limit: int = 50,
    db: AsyncSession = Depends(get_read_db)
):
    """List conversations from read DB with filters. Only returns CALLs (exclude chats).

    - bot_id: legacy bot id (int)
    - start_ts, end_ts: ISO timestamps or DB-compatible datetime strings
    - limit: max rows
    """
    rows = await fetch_conversations_time_range(
        db,
        bot_id=bot_id,
        start_ts=start_ts,
        end_ts=end_ts,
        limit=limit,
    )
    # Keep only call-type: customer_phone is not null/empty
    calls = [
        r for r in rows
        if r.customer_phone is not None and str(r.customer_phone).strip() != ""
    ]
    return [
        ConversationResponse(
            id=r.id,
            conversation_id=r.conversation_id,
            customer_phone=r.customer_phone,
            bot_id=r.bot_id,
            created_at=r.created_at,
            updated_at=r.updated_at,
        )
        for r in calls
    ]

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
    result = await db.execute(sql, {"cid": conversation_id})
    row = result.mappings().first()
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
    result = await db.execute(sql, {"cid": conversation_id})
    row = result.mappings().first()
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
