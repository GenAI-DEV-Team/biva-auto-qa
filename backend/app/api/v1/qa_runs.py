from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from typing import List, Optional, Any, Dict, Set
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text, select
from app.core.db import get_read_db, get_db
from app.models.base import Bot, BotVersion, Evaluation
from app.utils.prompt_loader import load_prompt
from app.services.openai_client import openai_service
import json
import asyncio


router = APIRouter()


class QARunRequest(BaseModel):
    conversation_ids: Optional[List[str]] = Field(
        default=None, description="Legacy conversation_id list (max 20)"
    )
    limit: int = Field(20, ge=1, le=20, description="Max conversations when auto mode")


class QARunResult(BaseModel):
    conversation_id: str
    bot_id: Optional[int] = None
    ok: bool
    result: Optional[Dict[str, Any]] = None
    error: Optional[str] = None


async def _fetch_conversations_auto(db: AsyncSession, limit: int) -> List[Dict[str, Any]]:
    sql = text(
        """
        SELECT id, conversation_id, customer_phone, bot_id, bot_memory, created_at, updated_at
        FROM conversation
        WHERE customer_phone IS NOT NULL AND TRIM(customer_phone) <> ''
        ORDER BY created_at DESC
        LIMIT :limit
        """
    )
    result = await db.execute(sql, {"limit": limit})
    return [dict(row) for row in result.mappings().all()]


async def _fetch_conversation_by_id(db: AsyncSession, conversation_id: str) -> Optional[Dict[str, Any]]:
    sql = text(
        """
        SELECT id, conversation_id, customer_phone, bot_id, bot_memory, created_at, updated_at
        FROM conversation
        WHERE conversation_id = :cid
        LIMIT 1
        """
    )
    result = await db.execute(sql, {"cid": conversation_id})
    row = result.mappings().first()
    return dict(row) if row else None


async def _get_latest_bot_kb(write_db: AsyncSession, legacy_bot_id: Optional[int]) -> Dict[str, Any]:
    if legacy_bot_id is None:
        return {}
    # Map legacy bot id -> write DB Bot.bot_index
    bot_q = select(Bot).where(Bot.bot_index == legacy_bot_id)
    bot_res = await write_db.execute(bot_q)
    bot = bot_res.scalar_one_or_none()
    if not bot:
        return {}
    ver_q = (
        select(BotVersion)
        .where(BotVersion.bot_index == bot.bot_index)
        .order_by(BotVersion.created_at.desc())
        .limit(1)
    )
    ver_res = await write_db.execute(ver_q)
    version = ver_res.scalar_one_or_none()
    if not version:
        return {}
    return version.knowledge_base or {}


async def _prefetch_latest_kb_map(write_db: AsyncSession, legacy_bot_ids: Set[int]) -> Dict[int, Dict[str, Any]]:
    """Fetch latest knowledge_base for a set of legacy bot ids in one query.

    Returns mapping: legacy_bot_id -> knowledge_base dict
    """
    if not legacy_bot_ids:
        return {}

    # Map legacy bot ids to write DB bots
    bot_q = select(Bot).where(Bot.bot_index.in_(list(legacy_bot_ids)))
    bot_res = await write_db.execute(bot_q)
    bots = bot_res.scalars().all()
    if not bots:
        return {bid: {} for bid in legacy_bot_ids}

    indices = [b.bot_index for b in bots]

    # Fetch latest versions per bot_index by ordering and picking first per group
    ver_q = (
        select(BotVersion)
        .where(BotVersion.bot_index.in_(indices))
        .order_by(BotVersion.bot_index.asc(), BotVersion.created_at.desc())
    )
    ver_res = await write_db.execute(ver_q)
    versions = ver_res.scalars().all()

    kb_map: Dict[int, Dict[str, Any]] = {}
    for v in versions:
        if v.bot_index not in kb_map:
            kb_map[v.bot_index] = v.knowledge_base or {}

    # Ensure all requested ids have an entry
    for bid in legacy_bot_ids:
        kb_map.setdefault(bid, {})

    return kb_map


async def _eval_single(
    qa_system_prompt: str,
    conversation_row: Dict[str, Any],
    knowledge_base: Dict[str, Any],
) -> QARunResult:
    conversation_id = conversation_row.get("conversation_id") or ""
    bot_id = conversation_row.get("bot_id")
    raw_memory = conversation_row.get("bot_memory")
    if not conversation_id:
        return QARunResult(conversation_id="", bot_id=bot_id, ok=False, error="missing conversation_id")

    # Load system prompt with KB injected
    try:
        system_prompt = qa_system_prompt.replace("{{KB}}", json.dumps(knowledge_base, ensure_ascii=False))
    except Exception as e:
        return QARunResult(conversation_id=conversation_id, bot_id=bot_id, ok=False, error=f"kb_inject_failed: {e}")

    # Build user prompt from bot_memory (as-is string if present)
    if raw_memory is None:
        user_prompt = "{}"
    else:
        user_prompt = raw_memory if isinstance(raw_memory, str) else json.dumps(raw_memory, ensure_ascii=False)

    try:
        content = await asyncio.wait_for(
            openai_service.chat_completion(
                model="gpt-4.1-mini",
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": "mode: đưa ra thông tin tri tiết, không bình luận\n" + user_prompt},
                ],
                temperature=0.4,
                response_format={"type": "json_object"}
            ),
            timeout=90,
        )
        parsed = json.loads(content)
        return QARunResult(conversation_id=conversation_id, bot_id=bot_id, ok=True, result=parsed)
    except asyncio.TimeoutError:
        return QARunResult(conversation_id=conversation_id, bot_id=bot_id, ok=False, error="timeout")
    except Exception as e:
        return QARunResult(conversation_id=conversation_id, bot_id=bot_id, ok=False, error=str(e))


@router.post("/run", response_model=List[QARunResult])
async def run_qa(
    body: QARunRequest,
    read_db: AsyncSession = Depends(get_read_db),
    write_db: AsyncSession = Depends(get_db),
):
    """Run Auto-QA for conversations.

    Modes:
    1) Provide up to 20 legacy conversation_ids (body.conversation_ids)
    2) No IDs -> auto-pick latest `limit` call conversations from legacy DB
    """
    # Gather conversations (enforce hard cap of 20)
    conversations: List[Dict[str, Any]] = []
    if body.conversation_ids:
        if len(body.conversation_ids) > 20:
            raise HTTPException(status_code=400, detail="conversation_ids exceeds 20")
        for cid in body.conversation_ids:
            row = await _fetch_conversation_by_id(read_db, cid)
            if row:
                conversations.append(row)
    else:
        limit = min(max(body.limit, 1), 20)
        conversations = await _fetch_conversations_auto(read_db, limit=limit)

    if not conversations:
        raise HTTPException(status_code=404, detail="No conversations found to evaluate")

    # Preload system prompt
    qa_system_prompt = load_prompt("qa.md")

    # Concurrency control
    semaphore = asyncio.Semaphore(3)

    # Prefetch KBs to avoid using the shared DB session inside concurrent tasks
    legacy_ids: Set[int] = {c.get("bot_id") for c in conversations if c.get("bot_id") is not None}
    kb_map = await _prefetch_latest_kb_map(write_db, legacy_ids)

    async def evaluate(conv: Dict[str, Any]) -> QARunResult:
        async with semaphore:
            kb = kb_map.get(conv.get("bot_id")) or {}
            return await _eval_single(qa_system_prompt, conv, kb)

    tasks = [evaluate(c) for c in conversations]
    results = await asyncio.gather(*tasks)

    # Utility: recursively strip PostgreSQL-invalid null bytes from strings
    def _sanitize_for_pg(value: Any) -> Any:
        if isinstance(value, str):
            # Remove NUL bytes which Postgres cannot store in text/jsonb
            return value.replace("\x00", "").replace("\u0000", "")
        if isinstance(value, list):
            return [_sanitize_for_pg(v) for v in value]
        if isinstance(value, dict):
            return {k: _sanitize_for_pg(v) for k, v in value.items()}
        return value

    # Persist evaluations to write DB (upsert by conversation_id)
    for conv, res in zip(conversations, results):
        if not res.ok:
            continue

        conversation_id = res.conversation_id or (conv.get("conversation_id") or "")
        conversation_id = _sanitize_for_pg(conversation_id)
        if not conversation_id:
            continue

        # Prepare memory JSON
        raw_memory = conv.get("bot_memory")
        if raw_memory is None:
            memory_json: Dict[str, Any] = {}
        elif isinstance(raw_memory, str):
            try:
                memory_json = json.loads(raw_memory)
            except Exception:
                memory_json = {"raw": raw_memory}
        else:
            memory_json = raw_memory

        # Sanitize memory and result payloads for Postgres
        memory_json = _sanitize_for_pg(memory_json)
        result_json = _sanitize_for_pg(res.result or {})

        # Upsert Evaluation by conversation_id
        existing_q = select(Evaluation).where(Evaluation.conversation_id == conversation_id)
        existing_res = await write_db.execute(existing_q)
        existing = existing_res.scalar_one_or_none()

        if existing:
            existing.memory = memory_json
            existing.evaluation_result = result_json
        else:
            eval_row = Evaluation(
                conversation_id=conversation_id,
                memory=memory_json,
                evaluation_result=result_json,
            )
            write_db.add(eval_row)

    await write_db.commit()

    return results


