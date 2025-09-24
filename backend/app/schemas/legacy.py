from typing import List, Optional, Any
from pydantic import BaseModel
from datetime import datetime


class UserRow(BaseModel):
    id: int
    username: Optional[str] = None
    email: Optional[str] = None
    full_name: Optional[str] = None
    phone: Optional[str] = None
    is_active: Optional[int] = None
    is_admin: Optional[int] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None


class BotRow(BaseModel):
    id: int
    name: Optional[str] = None
    user_id: Optional[int] = None
    bot_type: Optional[str] = None
    bot_url: Optional[str] = None
    version: Optional[int] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None


class BotDetailRow(BotRow):
    system_prompt: Optional[str] = None


class ConversationRow(BaseModel):
    id: int
    conversation_id: Optional[str] = None
    customer_phone: Optional[str] = None
    bot_id: Optional[int] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None


class OptimizationSessionRow(BaseModel):
    id: int
    bot_id: Optional[int] = None
    last_updated_at: Optional[datetime] = None


class UserWithBotRow(BaseModel):
    user_id: Optional[int] = None
    username: Optional[str] = None
    email: Optional[str] = None
    bot_id: Optional[int] = None
    bot_name: Optional[str] = None
    bot_type: Optional[str] = None
    bot_created_at: Optional[datetime] = None


class ConversationWithBotRow(BaseModel):
    conv_row_id: int
    conversation_id: Optional[str] = None
    customer_phone: Optional[str] = None
    conv_created_at: Optional[datetime] = None
    bot_id: Optional[int] = None
    bot_name: Optional[str] = None
    bot_type: Optional[str] = None


class OptSessionWithBotRow(BaseModel):
    opt_id: int
    last_updated_at: Optional[datetime] = None
    bot_id: Optional[int] = None
    bot_name: Optional[str] = None
    bot_type: Optional[str] = None


class ConversationByBotRow(BaseModel):
    id: int
    conversation_id: Optional[str] = None
    customer_phone: Optional[str] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
    bot_name: Optional[str] = None


class ConversationMemoryRow(BaseModel):
    id: int
    conversation_id: Optional[str] = None
    customer_phone: Optional[str] = None
    bot_id: Optional[int] = None
    bot_memory: Optional[Any] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None


