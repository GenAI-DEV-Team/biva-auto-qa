from fastapi import APIRouter, Depends, HTTPException, Query, Path
from pydantic import BaseModel
from typing import List, Any, Dict, Optional
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.core.db import get_db
from app.models.base import Evaluation
from app.core.redis import get_redis
import json


router = APIRouter()


class EvaluationResponse(BaseModel):
    id: str
    conversation_id: str
    memory: Dict[str, Any]
    evaluation_result: Dict[str, Any]
    reviewed: bool
    review_note: Optional[str] = None


@router.get(
    "/",
    response_model=List[EvaluationResponse],
    summary="List evaluations",
    description="List evaluations with pagination (ordered by created_at desc).",
)
async def list_evaluations(
    limit: int = Query(50, ge=1, le=200),
    db: AsyncSession = Depends(get_db),
):
    cache_key = f"eval:list:{limit}"
    redis = await get_redis()
    cached = await redis.get(cache_key)
    if cached:
        try:
            return [EvaluationResponse(**x) for x in json.loads(cached)]
        except Exception:
            pass

    query = (
        select(Evaluation)
        .order_by(Evaluation.created_at.desc())
        .limit(limit)
    )
    result = await db.execute(query)
    rows = result.scalars().all()
    payload = [
        EvaluationResponse(
            id=str(row.id),
            conversation_id=row.conversation_id,
            memory=row.memory or {},
            evaluation_result=row.evaluation_result or {},
            reviewed=bool(getattr(row, "reviewed", False)),
            review_note=getattr(row, "review_note", None),
        )
        for row in rows
    ]
    try:
        # Evaluations list TTL: 1 hour
        await redis.setex(cache_key, 60 * 60, json.dumps([p.dict() for p in payload]))
    except Exception:
        pass
    return payload


@router.get(
    "/{conversation_id}",
    response_model=EvaluationResponse,
    summary="Get evaluation by conversation_id",
)
async def get_evaluation(
    conversation_id: str = Path(..., description="Legacy conversation id"),
    db: AsyncSession = Depends(get_db),
):
    cache_key = f"eval:by_id:{conversation_id}"
    redis = await get_redis()
    cached = await redis.get(cache_key)
    if cached:
        try:
            return EvaluationResponse(**json.loads(cached))
        except Exception:
            pass

    query = select(Evaluation).where(Evaluation.conversation_id == conversation_id)
    result = await db.execute(query)
    row = result.scalar_one_or_none()
    if not row:
        raise HTTPException(status_code=404, detail="Evaluation not found")
    payload = EvaluationResponse(
        id=str(row.id),
        conversation_id=row.conversation_id,
        memory=row.memory or {},
        evaluation_result=row.evaluation_result or {},
        reviewed=bool(getattr(row, "reviewed", False)),
        review_note=getattr(row, "review_note", None),
    )
    try:
        # Evaluation by id TTL: 1 hour
        await redis.setex(cache_key, 60 * 60, json.dumps(payload.dict()))
    except Exception:
        pass
    return payload


class EvaluationReviewUpdate(BaseModel):
    reviewed: Optional[bool] = None
    review_note: Optional[str] = None


@router.patch(
    "/{conversation_id}",
    response_model=EvaluationResponse,
    summary="Update evaluation review status",
)
async def update_evaluation_review(
    conversation_id: str = Path(..., description="Legacy conversation id"),
    body: EvaluationReviewUpdate = None,
    db: AsyncSession = Depends(get_db),
):
    query = select(Evaluation).where(Evaluation.conversation_id == conversation_id)
    result = await db.execute(query)
    row = result.scalar_one_or_none()
    if not row:
        raise HTTPException(status_code=404, detail="Evaluation not found")
    if body is not None:
        if body.reviewed is not None:
            row.reviewed = bool(body.reviewed)
        if body.review_note is not None:
            row.review_note = body.review_note
        await db.commit()
        await db.refresh(row)
        # Invalidate caches
        try:
            redis = await get_redis()
            await redis.delete(f"eval:by_id:{conversation_id}")
            # delete list caches
            async for key in redis.scan_iter("eval:list:*"):
                await redis.delete(key)
        except Exception:
            pass
    return EvaluationResponse(
        id=str(row.id),
        conversation_id=row.conversation_id,
        memory=row.memory or {},
        evaluation_result=row.evaluation_result or {},
        reviewed=bool(getattr(row, "reviewed", False)),
        review_note=getattr(row, "review_note", None),
    )


