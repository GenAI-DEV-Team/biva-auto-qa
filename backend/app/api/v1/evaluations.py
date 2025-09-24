from fastapi import APIRouter, Depends, HTTPException, Query, Path
from pydantic import BaseModel
from typing import List, Any, Dict
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.core.db import get_db
from app.models.base import Evaluation


router = APIRouter()


class EvaluationResponse(BaseModel):
    id: str
    conversation_id: str
    memory: Dict[str, Any]
    evaluation_result: Dict[str, Any]


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
    query = (
        select(Evaluation)
        .order_by(Evaluation.created_at.desc())
        .limit(limit)
    )
    result = await db.execute(query)
    rows = result.scalars().all()
    return [
        EvaluationResponse(
            id=str(row.id),
            conversation_id=row.conversation_id,
            memory=row.memory or {},
            evaluation_result=row.evaluation_result or {},
        )
        for row in rows
    ]


@router.get(
    "/{conversation_id}",
    response_model=EvaluationResponse,
    summary="Get evaluation by conversation_id",
)
async def get_evaluation(
    conversation_id: str = Path(..., description="Legacy conversation id"),
    db: AsyncSession = Depends(get_db),
):
    query = select(Evaluation).where(Evaluation.conversation_id == conversation_id)
    result = await db.execute(query)
    row = result.scalar_one_or_none()
    if not row:
        raise HTTPException(status_code=404, detail="Evaluation not found")
    return EvaluationResponse(
        id=str(row.id),
        conversation_id=row.conversation_id,
        memory=row.memory or {},
        evaluation_result=row.evaluation_result or {},
    )


