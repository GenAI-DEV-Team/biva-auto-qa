from fastapi import APIRouter, Depends, HTTPException, Query, Path
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from typing import List, Optional
from pydantic import BaseModel
from app.core.db import get_db, get_read_db
from app.models.base import Bot, BotVersion
from app.services.legacy_queries import fetch_bot_detail
from app.services.openai_client import openai_service
from app.utils.prompt_loader import load_prompt
import uuid
from datetime import datetime
import logging
import json
import re
from app.core.redis import get_redis

router = APIRouter()
logger = logging.getLogger(__name__)

class BotCreate(BaseModel):
    index: int

class BotResponse(BaseModel):
    id: str
    index: int
    name: str
    created_at: datetime

class BotVersionResponse(BaseModel):
    id: str
    bot_index: int
    system_prompt: str
    knowledge_base: dict
    created_at: datetime

@router.post(
    "/",
    response_model=BotResponse,
    summary="Create bot from legacy index",
    description="Create a new bot using a legacy bot id (index) and seed an initial version."
)
async def create_bot(
    bot_data: BotCreate,
    db: AsyncSession = Depends(get_db),
    read_db: AsyncSession = Depends(get_read_db),
):
    """Create a new bot by legacy bot index.

    - Check the read DB (legacy) for a bot whose id equals the provided index.
    - If found, create a new Bot in the write DB mirroring legacy fields.
    """
    # Try to fetch legacy bot details. If the legacy schema/table doesn't exist,
    # continue with minimal defaults instead of failing the request.
    try:
        legacy_rows = await fetch_bot_detail(read_db, bot_id=bot_data.index)
    except Exception as e:
        logger.warning("Legacy fetch failed for bot_id=%s: %s", bot_data.index, e)
        legacy_rows = []

    legacy_bot = legacy_rows[0] if legacy_rows else None

    # Avoid duplicates if already created
    existing_query = select(Bot).where(Bot.bot_index == (legacy_bot.id if legacy_bot else bot_data.index))
    existing_result = await db.execute(existing_query)
    existing_bot = existing_result.scalar_one_or_none()
    if existing_bot:
        return BotResponse(
            id=str(existing_bot.id),
            index=existing_bot.bot_index,
            name=existing_bot.name,
            created_at=existing_bot.created_at,
        )

    

    bot = Bot(
        bot_index=(legacy_bot.id if legacy_bot else bot_data.index),
        name=(legacy_bot.name if (legacy_bot and getattr(legacy_bot, "name", None)) else f"Bot {bot_data.index}"),

    )

    db.add(bot)
    await db.flush()

    # Seed initial bot version using legacy system_prompt when available
    system_prompt = (
        legacy_bot.system_prompt if (legacy_bot and getattr(legacy_bot, "system_prompt", None)) else "Imported from legacy bot"
    )
    initial_version = BotVersion(
        bot_index=bot.bot_index,
        system_prompt=system_prompt,
    )

    db.add(initial_version)

    # Build knowledge_base via LLM from the legacy system_prompt
    if legacy_bot and getattr(legacy_bot, "system_prompt", None):
        try:
            knowledge_prompt = load_prompt("knowledge.md")
            messages = [
                {"role": "system", "content": knowledge_prompt},
                {"role": "user", "content": legacy_bot.system_prompt},
            ]
            kb_str = await openai_service.chat_completion(
                messages=messages,
                temperature=0.4
            )
            initial_version.knowledge_base = json.loads(kb_str)
        except Exception:
            # If parsing or LLM fails, keep empty knowledge_base
            initial_version.knowledge_base = {}

    await db.commit()

    return BotResponse(
        id=str(bot.id),
        index=bot.bot_index,
        name=bot.name,
        created_at=bot.created_at,
    )

@router.get(
    "/",
    response_model=List[BotResponse],
    summary="List bots",
    description="Return all bots in the write database."
)
async def list_bots(limit: int = Query(100, ge=1, le=1000), db: AsyncSession = Depends(get_db)):
    """List all bots"""
    redis = await get_redis()
    cache_key = f"bots:list:{limit}"

    # Check database first, then cache
    query = select(Bot).order_by(Bot.created_at.desc()).limit(limit)
    result = await db.execute(query)
    bots = result.scalars().all()

    logger.info(f"Database query returned {len(bots)} bots")

    payload = [
        BotResponse(
            id=str(bot.id),
            index=bot.bot_index,
            name=bot.name,
            created_at=bot.created_at,
        )
        for bot in bots
    ]

    # Only cache if we have data
    if payload:
        try:
            await redis.setex(cache_key, 86400, json.dumps([p.dict() for p in payload]))
            logger.info(f"Cached {len(payload)} bots with key {cache_key}")
        except Exception as e:
            logger.warning(f"Failed to cache bots: {e}")

    # Check if there's stale cache data
    try:
        cached = await redis.get(cache_key)
        if cached:
            try:
                cached_data = json.loads(cached)
                if len(cached_data) != len(payload):
                    logger.warning(f"Cache inconsistency: cached={len(cached_data)}, actual={len(payload)}")
                    # Delete stale cache
                    await redis.delete(cache_key)
                    logger.info(f"Deleted stale cache key: {cache_key}")
            except Exception as e:
                logger.warning(f"Cache data corruption for {cache_key}: {e}")
                await redis.delete(cache_key)
    except Exception as e:
        logger.warning(f"Cache check failed: {e}")

    return payload

@router.delete("/cache", summary="Clear bots cache", description="Clear all cached bot data")
async def clear_bots_cache():
    """Clear all cached bot data"""
    redis = await get_redis()
    try:
        # Get all bot cache keys
        keys = await redis.keys("bots:list:*")
        if keys:
            await redis.delete(*keys)
            logger.info(f"Cleared {len(keys)} bot cache keys")
            return {"message": f"Cleared {len(keys)} cache entries", "cleared_keys": keys}
        else:
            return {"message": "No cache keys found"}
    except Exception as e:
        logger.error(f"Failed to clear cache: {e}")
        raise HTTPException(status_code=500, detail="Failed to clear cache")

@router.get("/debug", summary="Debug bots data", description="Debug endpoint to check database and cache state")
async def debug_bots(db: AsyncSession = Depends(get_db)):
    """Debug endpoint to check database and cache state"""
    redis = await get_redis()

    # Check database
    query = select(Bot).order_by(Bot.created_at.desc())
    result = await db.execute(query)
    bots = result.scalars().all()

    # Check cache
    cache_keys = await redis.keys("bots:list:*")
    cache_info = {}
    for key in cache_keys:
        try:
            cached = await redis.get(key)
            if cached:
                data = json.loads(cached)
                cache_info[key] = len(data)
        except Exception:
            cache_info[key] = "corrupted"

    return {
        "database": {
            "total_bots": len(bots),
            "bots": [
                {
                    "id": str(bot.id),
                    "index": bot.bot_index,
                    "name": bot.name,
                    "created_at": bot.created_at.isoformat()
                }
                for bot in bots[:5]  # Show first 5
            ]
        },
        "cache": {
            "keys": cache_keys,
            "info": cache_info
        }
    }

@router.get(
    "/{bot_id}",
    response_model=BotResponse,
    summary="Get bot by UUID",
    description="Fetch a single bot by its UUID."
)
async def get_bot(
    bot_id: str = Path(..., description="Bot UUID"),
    db: AsyncSession = Depends(get_db)
):
    """Get a specific bot"""
    query = select(Bot).where(Bot.id == uuid.UUID(bot_id))
    result = await db.execute(query)
    bot = result.scalar_one_or_none()

    if not bot:
        raise HTTPException(status_code=404, detail="Bot not found")

    return BotResponse(
        id=str(bot.id),
        index=bot.bot_index,
        name=bot.name,
        created_at=bot.created_at,
    )

@router.get(
    "/{bot_id}/versions",
    response_model=List[BotVersionResponse],
    summary="List bot versions",
    description="List all versions for a bot by its UUID, newest first."
)
async def get_bot_versions(
    bot_id: str = Path(..., description="Bot UUID"),
    db: AsyncSession = Depends(get_db)
):
    """Get versions for a bot"""
    # Resolve bot_index from bot UUID
    bot_query = select(Bot).where(Bot.id == uuid.UUID(bot_id))
    bot_result = await db.execute(bot_query)
    bot = bot_result.scalar_one_or_none()
    if not bot:
        raise HTTPException(status_code=404, detail="Bot not found")

    query = (
        select(BotVersion)
        .where(BotVersion.bot_index == bot.bot_index)
        .order_by(BotVersion.created_at.desc())
    )
    result = await db.execute(query)
    versions = result.scalars().all()

    return [
        BotVersionResponse(
            id=str(version.id),
            bot_index=version.bot_index,
            system_prompt=version.system_prompt,
            knowledge_base=version.knowledge_base,
            created_at=version.created_at,
        )
        for version in versions
    ]

@router.post(
    "/{bot_index}/knowledge_base/regenerate",
    response_model=BotVersionResponse,
    summary="Regenerate knowledge base",
    description="Regenerate the bot's knowledge base using the latest system prompt, creating a new version."
)
async def update_bot_knowledge_base(
    bot_index: int = Path(..., description="Legacy bot index (external id)"),
    db: AsyncSession = Depends(get_db)
):
    """Regenerate knowledge base for the latest bot version and create a new version."""
    # Resolve bot
    bot_query = select(Bot).where(Bot.bot_index == bot_index)
    bot_result = await db.execute(bot_query)
    bot = bot_result.scalar_one_or_none()
    if not bot:
        raise HTTPException(status_code=404, detail="Bot not found")

    # Get latest version for this bot
    ver_query = (
        select(BotVersion)
        .where(BotVersion.bot_index == bot.bot_index)
        .order_by(BotVersion.created_at.desc())
        .limit(1)
    )
    ver_result = await db.execute(ver_query)
    current_version = ver_result.scalar_one_or_none()
    if not current_version:
        raise HTTPException(status_code=404, detail="Bot version not found")

    # Regenerate KB from the current system prompt
    system_prompt = current_version.system_prompt
    try:
        knowledge_prompt = load_prompt("knowledge.md")
        messages = [
            {"role": "system", "content": knowledge_prompt},
            {"role": "user", "content": system_prompt},
        ]
        logger.info("Regenerating KB for bot_index=%s using LLM", bot.bot_index)
        kb_str = await openai_service.chat_completion(
            model="gpt-4.1",
            messages=messages,
            temperature=0.4,
            response_format={"type": "json_object"}
        )
        logger.info("LLM responded for bot_index=%s, length=%d", bot.bot_index, len(kb_str or ""))
        kb_json = _parse_kb_json_safe(kb_str)
    except Exception as e:
        logger.error("KB regeneration failed for bot_index=%s: %s", bot.bot_index, e)
        kb_json = {}

    # Create new version with regenerated KB
    new_version = BotVersion(
        bot_index=bot.bot_index,
        system_prompt=system_prompt,
        knowledge_base=kb_json,
    )
    db.add(new_version)
    await db.commit()

    return BotVersionResponse(
        id=str(new_version.id),
        bot_index=new_version.bot_index,
        system_prompt=new_version.system_prompt,
        knowledge_base=new_version.knowledge_base,
        created_at=new_version.created_at,
    )


def _parse_kb_json_safe(text: str) -> dict:
    """Parse JSON content returned by LLM defensively.

    - Accepts content wrapped in markdown code fences
    - Extracts the first top-level JSON object if extra text is present
    - Falls back to empty dict on failure
    """
    if not text:
        return {}

    # Fast path
    try:
        return json.loads(text)
    except Exception:
        pass

    content = text.strip()

    # Strip markdown code fences if any
    if content.startswith("```"):
        # Remove opening fence with optional language
        content = re.sub(r"^```[a-zA-Z0-9_-]*\s*", "", content)
        # Remove closing fence
        content = re.sub(r"```\s*$", "", content)

    # Try again
    try:
        return json.loads(content)
    except Exception:
        pass

    # Extract substring between first '{' and last '}'
    start = content.find("{")
    end = content.rfind("}")
    if start != -1 and end != -1 and end > start:
        candidate = content[start : end + 1]
        try:
            return json.loads(candidate)
        except Exception:
            logger.warning("Failed to parse KB JSON from candidate substring; returning empty dict")

    return {}