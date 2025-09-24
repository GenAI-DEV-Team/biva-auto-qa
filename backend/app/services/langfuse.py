from langfuse import Langfuse
from app.core.config import settings
import logging

logger = logging.getLogger(__name__)

# Initialize Langfuse client
langfuse_client = None

if settings.LANGFUSE_SECRET_KEY and settings.LANGFUSE_PUBLIC_KEY:
    langfuse_client = Langfuse(
        secret_key=settings.LANGFUSE_SECRET_KEY,
        public_key=settings.LANGFUSE_PUBLIC_KEY,
        host=settings.LANGFUSE_HOST
    )
    logger.info("Langfuse client initialized")
else:
    logger.warning("Langfuse credentials not found, tracing will be disabled")

class LangfuseService:
    def __init__(self):
        self.client = langfuse_client

    def create_trace(self, name: str, metadata: dict = None):
        """Create a new trace"""
        if not self.client:
            return None
        try:
            if hasattr(self.client, "trace"):
                return self.client.trace(name=name, metadata=metadata or {})
            # Fallback for SDKs with different method name
            if hasattr(self.client, "create_trace"):
                return self.client.create_trace(name=name, metadata=metadata or {})
            logger.warning("Langfuse client missing 'trace' method; disabling tracing")
            return None
        except Exception as e:
            logger.warning("Langfuse trace creation failed: %s", e)
            return None

    def create_span(self, trace, name: str, input: dict = None, output: dict = None, metadata: dict = None):
        """Create a span within a trace"""
        if not self.client or not trace:
            return None
        try:
            if hasattr(trace, "span"):
                return trace.span(
                    name=name,
                    input=input,
                    output=output,
                    metadata=metadata or {}
                )
            logger.warning("Langfuse trace object missing 'span' method; skipping span creation")
            return None
        except Exception as e:
            logger.warning("Langfuse span creation failed: %s", e)
            return None

    def log_generation(self, trace, model: str, input: str, output: str, metadata: dict = None):
        """Log a generation event"""
        if not self.client or not trace:
            return None
        try:
            if hasattr(trace, "generation"):
                return trace.generation(
                    name=f"{model}_generation",
                    model=model,
                    input=input,
                    output=output,
                    metadata=metadata or {}
                )
            logger.warning("Langfuse trace object missing 'generation' method; skipping generation log")
            return None
        except Exception as e:
            logger.warning("Langfuse generation log failed: %s", e)
            return None

    def log_evaluation(self, trace, name: str, score: float, metadata: dict = None):
        """Log an evaluation score"""
        if not self.client or not trace:
            return None
        try:
            if hasattr(trace, "score"):
                return trace.score(name=name, value=score, metadata=metadata or {})
            logger.warning("Langfuse trace object missing 'score' method; skipping score log")
            return None
        except Exception as e:
            logger.warning("Langfuse score log failed: %s", e)
            return None

    def flush(self):
        """Flush any pending events"""
        if self.client:
            try:
                if hasattr(self.client, "flush"):
                    self.client.flush()
            except Exception as e:
                logger.warning("Langfuse flush failed: %s", e)

# Global service instance
langfuse_service = LangfuseService()
