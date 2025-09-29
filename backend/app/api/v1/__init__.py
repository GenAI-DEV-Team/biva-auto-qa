from fastapi import APIRouter
from app.api.v1 import health, bots, conversations, evaluations, qa_runs, auth, sheets, user_prompts

api_router = APIRouter()
api_router.include_router(health.router, prefix="/health", tags=["health"])
api_router.include_router(auth.router, prefix="/auth", tags=["auth"])
api_router.include_router(bots.router, prefix="/bots", tags=["bots"])
api_router.include_router(conversations.router, prefix="/conversations", tags=["conversations"])
api_router.include_router(evaluations.router, prefix="/evaluations", tags=["evaluations"])
api_router.include_router(qa_runs.router, prefix="/qa_runs", tags=["qa_runs"])
api_router.include_router(sheets.router, prefix="/sheets", tags=["sheets"])
api_router.include_router(user_prompts.router, prefix="/prompts", tags=["prompts"])