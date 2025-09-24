from app.workers.celery_app import celery_app
from app.core.config import settings
from app.services.ingest import ingest_service
from app.services.evaluator import evaluator
from app.services.business_detect import business_classifier
from app.services.proposal_generator import proposal_generator
from app.services.proposal_approval import proposal_approval
from app.core.db import async_session
from app.core.tracing import trace_service_call
from app.services.langfuse import langfuse_service
import uuid
import json
import logging
from datetime import datetime

logger = logging.getLogger(__name__)

@celery_app.task
def add(x, y):
    return x + y

@celery_app.task
def health_check():
    return {"status": "healthy", "service": "celery"}

@celery_app.task
@trace_service_call("process_conversation_batch")
async def process_conversation_batch(bot_id: str, conversations_data: list, run_id: str = None):
    """Process a batch of conversations for a bot"""
    async with async_session() as db:
        try:
            # Create trace
            trace = langfuse_service.create_trace(
                name="process_conversation_batch",
                metadata={"bot_id": bot_id, "conversation_count": len(conversations_data), "run_id": run_id}
            )

            # Import conversations
            conversations = await ingest_service.import_conversations_batch(
                uuid.UUID(bot_id), conversations_data, db, trace
            )

            # Process each conversation
            for conversation in conversations:
                # Segment conversation
                spans = await ingest_service.segment_service.segment_conversation(
                    conversation.id, [msg for msg in conversations_data if msg.get('id') == str(conversation.id)], trace
                )

                # Save spans
                for span in spans:
                    db.add(span)

            await db.commit()

            # Return results
            return {
                "status": "completed",
                "bot_id": bot_id,
                "conversations_processed": len(conversations),
                "run_id": run_id
            }

        except Exception as e:
            logger.error(f"Error processing conversation batch for bot {bot_id}: {e}")
            raise

@celery_app.task
@trace_service_call("evaluate_conversation")
async def evaluate_conversation(conversation_id: str, run_id: str = None):
    """Evaluate all spans in a conversation"""
    async with async_session() as db:
        try:
            trace = langfuse_service.create_trace(
                name="evaluate_conversation",
                metadata={"conversation_id": conversation_id, "run_id": run_id}
            )

            # Get conversation and spans
            from app.models.base import Conversation, Span
            from sqlalchemy import select

            conv_query = select(Conversation).where(Conversation.id == uuid.UUID(conversation_id))
            conv_result = await db.execute(conv_query)
            conversation = conv_result.scalar_one_or_none()

            if not conversation:
                raise ValueError(f"Conversation {conversation_id} not found")

            spans_query = select(Span).where(Span.conversation_id == uuid.UUID(conversation_id))
            spans_result = await db.execute(spans_query)
            spans = spans_result.scalars().all()

            evaluations = []

            for span in spans:
                # Evaluate span
                evaluation = await evaluator.evaluate_span(span, {}, trace)
                db.add(evaluation)
                evaluations.append(evaluation)

                # Classify business
                business_type, business_id, similarity, business_data = await business_classifier.classify_span(
                    span.text, conversation.bot_id, db, trace
                )

                # Generate proposals if needed
                if business_type == "new" and business_data:
                    proposal = await proposal_generator.generate_new_business_proposal(
                        conversation.bot_id, business_data, span.text, db, trace
                    )
                    db.add(proposal)

                elif business_type == "old" and evaluation.issues:
                    # Get current version
                    from app.models.base import BotVersion
                    version_query = select(BotVersion).where(BotVersion.bot_id == conversation.bot_id).order_by(BotVersion.created_at.desc())
                    version_result = await db.execute(version_query)
                    current_version = version_result.scalar_one_or_none()

                    if current_version:
                        proposal = await proposal_generator.generate_improvement_proposal(
                            conversation.bot_id, span.text, evaluation.issues, current_version, db, trace
                        )
                        db.add(proposal)

            await db.commit()

            return {
                "status": "completed",
                "conversation_id": conversation_id,
                "spans_evaluated": len(spans),
                "evaluations_created": len(evaluations),
                "run_id": run_id
            }

        except Exception as e:
            logger.error(f"Error evaluating conversation {conversation_id}: {e}")
            raise