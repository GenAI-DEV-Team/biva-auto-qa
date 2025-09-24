from functools import wraps
from typing import Callable, Any, Dict
from app.services.langfuse import langfuse_service
from app.core.config import settings
import logging

logger = logging.getLogger(__name__)

def trace_llm_call(name: str, model: str = None):
    """Decorator to trace LLM calls"""
    def decorator(func: Callable):
        @wraps(func)
        async def wrapper(*args, **kwargs):
            # Create trace if Langfuse is available
            trace = None
            span = None

            if langfuse_service.client:
                trace = langfuse_service.create_trace(
                    name=name,
                    metadata={
                        "model": model or "unknown",
                        "function": func.__name__
                    }
                )
                span = langfuse_service.create_span(
                    trace,
                    name=f"{func.__name__}_call",
                    input={"args": str(args), "kwargs": str(kwargs)}
                )

            try:
                result = await func(*args, **kwargs)

                # Log successful completion
                if span:
                    span.end(output={"result_length": len(str(result)) if result else 0})

                if trace:
                    # Log generation if this is an LLM call
                    if model:
                        langfuse_service.log_generation(
                            trace,
                            model=model,
                            input=str(kwargs.get('messages', args)),
                            output=result
                        )

                return result
            except Exception as e:
                # Log error
                if span:
                    span.end(output={"error": str(e)})

                if trace:
                    trace.score(name="error_rate", value=1.0, metadata={"error": str(e)})

                logger.error(f"Error in {func.__name__}: {e}")
                raise
            finally:
                # Flush traces
                if langfuse_service.client:
                    langfuse_service.flush()

        return wrapper
    return decorator

def trace_service_call(name: str):
    """Decorator to trace service calls"""
    def decorator(func: Callable):
        @wraps(func)
        async def wrapper(*args, **kwargs):
            span = None

            if langfuse_service.client:
                # Try to get trace from context or create new one
                trace = langfuse_service.create_trace(name=f"{name}_service")
                span = langfuse_service.create_span(
                    trace,
                    name=func.__name__,
                    input={"args": str(args), "kwargs": str(kwargs)}
                )

            try:
                result = await func(*args, **kwargs)

                if span:
                    span.end(output={"result": str(result)[:100] + "..." if len(str(result)) > 100 else str(result)})

                return result
            except Exception as e:
                if span:
                    span.end(output={"error": str(e)})

                logger.error(f"Error in {func.__name__}: {e}")
                raise
            finally:
                if langfuse_service.client:
                    langfuse_service.flush()

        return wrapper
    return decorator

def get_trace_context():
    """Get current trace context (placeholder for context vars)"""
    # In a real implementation, you might use contextvars
    return None

def set_trace_context(trace):
    """Set current trace context (placeholder for context vars)"""
    # In a real implementation, you might use contextvars
    pass
