from typing import Any, Dict, List, Optional
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text
from app.schemas.legacy import (
    UserRow,
    BotRow,
    BotDetailRow,
    ConversationRow,
    OptimizationSessionRow,
    UserWithBotRow,
    ConversationWithBotRow,
    OptSessionWithBotRow,
    ConversationByBotRow,
    ConversationMemoryRow,
)


async def fetch_users(db: AsyncSession, limit: int = 100) -> List[UserRow]:
    sql = text(
        """
        SELECT
          id,
          username,
          email,
          full_name,
          phone,
          is_active,
          is_admin,
          created_at,
          updated_at
        FROM users
        ORDER BY id DESC
        LIMIT :limit
        """
    )
    result = await db.execute(sql, {"limit": limit})
    rows = result.mappings().all()
    return [UserRow(**dict(row)) for row in rows]


async def fetch_bots(db: AsyncSession, limit: int = 100) -> List[BotRow]:
    sql = text(
        """
        SELECT
          id,
          name,
          user_id,
          bot_type,
          bot_url,
          version,
          created_at,
          updated_at
        FROM bot
        ORDER BY id DESC
        LIMIT :limit
        """
    )
    result = await db.execute(sql, {"limit": limit})
    rows = result.mappings().all()
    return [BotRow(**dict(row)) for row in rows]


async def fetch_conversations(db: AsyncSession, limit: int = 100) -> List[ConversationRow]:
    sql = text(
        """
        SELECT
          id,
          conversation_id,
          customer_phone,
          bot_id,
          created_at,
          updated_at
        FROM conversation
        ORDER BY id DESC
        LIMIT :limit
        """
    )
    result = await db.execute(sql, {"limit": limit})
    rows = result.mappings().all()
    return [ConversationRow(**dict(row)) for row in rows]


async def fetch_bot_detail(db: AsyncSession, bot_id: int) -> List[BotDetailRow]:
    sql = text(
        """
        SELECT
          id,
          name,
          user_id,
          bot_type,
          bot_url,
          system_prompt,
          version,
          created_at,
          updated_at
        FROM bot
        WHERE id = :bot_id
        """
    )
    result = await db.execute(sql, {"bot_id": bot_id})
    rows = result.mappings().all()
    return [BotDetailRow(**dict(row)) for row in rows]


async def fetch_optimization_sessions(db: AsyncSession, limit: int = 100) -> List[OptimizationSessionRow]:
    sql = text(
        """
        SELECT
          id,
          bot_id,
          last_updated_at
        FROM optimization_sessions
        ORDER BY id DESC
        LIMIT :limit
        """
    )
    result = await db.execute(sql, {"limit": limit})
    rows = result.mappings().all()
    return [OptimizationSessionRow(**dict(row)) for row in rows]


async def fetch_users_with_bots(db: AsyncSession, limit: int = 200) -> List[UserWithBotRow]:
    sql = text(
        """
        SELECT
          u.id AS user_id,
          u.username,
          u.email,
          b.id AS bot_id,
          b.name AS bot_name,
          b.bot_type,
          b.created_at AS bot_created_at
        FROM users u
        LEFT JOIN bot b ON b.user_id = u.id
        ORDER BY u.id DESC, b.id DESC
        LIMIT :limit
        """
    )
    result = await db.execute(sql, {"limit": limit})
    rows = result.mappings().all()
    return [UserWithBotRow(**dict(row)) for row in rows]


async def fetch_conversations_with_bot(db: AsyncSession, limit: int = 200) -> List[ConversationWithBotRow]:
    sql = text(
        """
        SELECT
          c.id AS conv_row_id,
          c.conversation_id,
          c.customer_phone,
          c.created_at AS conv_created_at,
          b.id AS bot_id,
          b.name AS bot_name,
          b.bot_type
        FROM conversation c
        JOIN bot b ON c.bot_id = b.id
        ORDER BY c.id DESC
        LIMIT :limit
        """
    )
    result = await db.execute(sql, {"limit": limit})
    rows = result.mappings().all()
    return [ConversationWithBotRow(**dict(row)) for row in rows]


async def fetch_opt_sessions_with_bot(db: AsyncSession, limit: int = 200) -> List[OptSessionWithBotRow]:
    sql = text(
        """
        SELECT
          o.id AS opt_id,
          o.last_updated_at,
          b.id AS bot_id,
          b.name AS bot_name,
          b.bot_type
        FROM optimization_sessions o
        JOIN bot b ON o.bot_id = b.id
        ORDER BY o.id DESC
        LIMIT :limit
        """
    )
    result = await db.execute(sql, {"limit": limit})
    rows = result.mappings().all()
    return [OptSessionWithBotRow(**dict(row)) for row in rows]


async def fetch_conversations_by_bot(db: AsyncSession, bot_id: int, limit: int = 200) -> List[ConversationByBotRow]:
    sql = text(
        """
        SELECT
          c.id,
          c.conversation_id,
          c.customer_phone,
          c.created_at,
          c.updated_at,
          b.name AS bot_name
        FROM conversation c
        JOIN bot b ON c.bot_id = b.id
        WHERE c.bot_id = :bot_id
        ORDER BY c.id DESC
        LIMIT :limit
        """
    )
    result = await db.execute(sql, {"bot_id": bot_id, "limit": limit})
    rows = result.mappings().all()
    return [ConversationByBotRow(**dict(row)) for row in rows]


async def fetch_conversations_by_phone_like(db: AsyncSession, phone_like: str, limit: int = 200) -> List[ConversationRow]:
    sql = text(
        """
        SELECT
          id,
          conversation_id,
          customer_phone,
          bot_id,
          created_at,
          updated_at
        FROM conversation
        WHERE customer_phone LIKE :phone_like
        ORDER BY id DESC
        LIMIT :limit
        """
    )
    result = await db.execute(sql, {"phone_like": phone_like, "limit": limit})
    rows = result.mappings().all()
    return [ConversationRow(**dict(row)) for row in rows]


async def fetch_opt_sessions_by_bot(db: AsyncSession, bot_id: int, limit: int = 200) -> List[OptimizationSessionRow]:
    sql = text(
        """
        SELECT
          o.id,
          o.bot_id,
          o.last_updated_at
        FROM optimization_sessions o
        WHERE o.bot_id = :bot_id
        ORDER BY o.id DESC
        LIMIT :limit
        """
    )
    result = await db.execute(sql, {"bot_id": bot_id, "limit": limit})
    rows = result.mappings().all()
    return [OptimizationSessionRow(**dict(row)) for row in rows]


async def fetch_conversations_time_range(
    db: AsyncSession,
    bot_id: Optional[int] = None,
    start_ts: Optional[str] = None,
    end_ts: Optional[str] = None,
    limit: int = 500,
    offset: int = 0,
) -> List[ConversationRow]:
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
        WHERE (:bot_id IS NULL OR c.bot_id = :bot_id)
          AND (:start_ts IS NULL OR c.created_at >= :start_ts)
          AND (:end_ts IS NULL OR c.created_at < :end_ts)
        ORDER BY c.created_at DESC
        LIMIT :limit
        OFFSET :offset
        """
    )
    params = {"bot_id": bot_id, "start_ts": start_ts, "end_ts": end_ts, "limit": limit, "offset": offset}
    result = await db.execute(sql, params)
    rows = result.mappings().all()
    return [ConversationRow(**dict(row)) for row in rows]


async def fetch_conversations_with_memory_by_bot(
    db: AsyncSession,
    bot_id: Optional[int] = None,
    limit: int = 50,
) -> List[ConversationMemoryRow]:
    sql = text(
        """
        SELECT
          c.id,
          c.conversation_id,
          c.customer_phone,
          c.bot_id,
          c.bot_memory,
          c.created_at,
          c.updated_at
        FROM conversation c
        WHERE (:bot_id IS NULL OR c.bot_id = :bot_id)
        ORDER BY c.created_at DESC
        LIMIT :limit
        """
    )
    params = {"bot_id": bot_id, "limit": limit}
    result = await db.execute(sql, params)
    rows = result.mappings().all()
    return [ConversationMemoryRow(**dict(row)) for row in rows]


async def fetch_chat_type_conversations(db: AsyncSession, limit: int = 300) -> List[ConversationRow]:
    sql = text(
        """
        SELECT
          id,
          conversation_id,
          customer_phone,
          bot_id,
          created_at
        FROM conversation
        WHERE (customer_phone IS NULL OR TRIM(customer_phone) = '')
        ORDER BY id DESC
        LIMIT :limit
        """
    )
    result = await db.execute(sql, {"limit": limit})
    rows = result.mappings().all()
    return [ConversationRow(**dict(row)) for row in rows]


async def fetch_call_type_conversations(db: AsyncSession, limit: int = 300) -> List[ConversationRow]:
    sql = text(
        """
        SELECT
          id,
          conversation_id,
          customer_phone,
          bot_id,
          created_at
        FROM conversation
        WHERE customer_phone IS NOT NULL AND TRIM(customer_phone) <> ''
        ORDER BY id DESC
        LIMIT :limit
        """
    )
    result = await db.execute(sql, {"limit": limit})
    rows = result.mappings().all()
    return [ConversationRow(**dict(row)) for row in rows]


