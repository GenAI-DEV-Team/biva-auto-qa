from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.core.db import get_db
from app.api.v1.auth import get_current_user
from app.models.base import UserPrompt, User
from pydantic import BaseModel
from typing import Optional
from app.utils.prompt_loader import load_prompt


router = APIRouter()


class PromptResponse(BaseModel):
    prompt: str


class PromptUpdateRequest(BaseModel):
    prompt: str


@router.get("/me", response_model=PromptResponse)
async def get_my_prompt(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    q = select(UserPrompt).where(UserPrompt.user_id == current_user.id)
    res = await db.execute(q)
    up: Optional[UserPrompt] = res.scalar_one_or_none()
    if up and up.prompt and up.prompt.strip():
        return PromptResponse(prompt=up.prompt)
    # fallback to default file
    return PromptResponse(prompt=load_prompt("qa.md"))


@router.put("/me", response_model=PromptResponse)
async def upsert_my_prompt(
    req: PromptUpdateRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    prompt_text = (req.prompt or "").strip()
    if not prompt_text:
        raise HTTPException(status_code=400, detail="Prompt cannot be empty")

    q = select(UserPrompt).where(UserPrompt.user_id == current_user.id)
    res = await db.execute(q)
    up: Optional[UserPrompt] = res.scalar_one_or_none()
    if up is None:
        up = UserPrompt(user_id=current_user.id, prompt=prompt_text)
        db.add(up)
    else:
        up.prompt = prompt_text

    await db.commit()
    await db.refresh(up)
    return PromptResponse(prompt=up.prompt)


@router.delete("/me")
async def delete_my_prompt(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    q = select(UserPrompt).where(UserPrompt.user_id == current_user.id)
    res = await db.execute(q)
    up: Optional[UserPrompt] = res.scalar_one_or_none()
    if up is None:
        # nothing to delete; return default
        return {"status": "ok", "prompt": load_prompt("qa.md")}
    await db.delete(up)
    await db.commit()
    return {"status": "ok", "prompt": load_prompt("qa.md")}


