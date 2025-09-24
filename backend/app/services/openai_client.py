import openai
from openai import AsyncOpenAI
from app.core.config import settings
from app.core.tracing import trace_llm_call
from tenacity import retry, stop_after_attempt, wait_exponential, retry_if_exception_type
import logging

logger = logging.getLogger(__name__)

# Initialize OpenAI client
client = AsyncOpenAI(api_key=settings.OPENAI_API_KEY)

# Retry decorator for OpenAI API calls
retry_decorator = retry(
    stop=stop_after_attempt(5),
    wait=wait_exponential(multiplier=1, min=4, max=10),
    retry=retry_if_exception_type((openai.APIError, openai.RateLimitError, openai.Timeout)),
    before_sleep=lambda retry_state: logger.warning(
        f"Retry attempt {retry_state.attempt_number} for OpenAI API call"
    )
)

class OpenAIService:
    def __init__(self):
        self.client = client

    @retry_decorator
    @trace_llm_call("chat_completion", "gpt-4.1-mini")
    async def chat_completion(
        self,
        messages: list,
        model: str = "gpt-4.1-mini",
        temperature: float = 0.4,
        response_format: dict | str | None = None,
    ) -> str:
        """Generate chat completion using OpenAI API"""
        try:
            params = {
                "model": model,
                "messages": messages,
                "temperature": temperature,
            }
            if response_format is not None:
                params["response_format"] = (
                    response_format if isinstance(response_format, dict) else {"type": str(response_format)}
                )

            response = await self.client.chat.completions.create(**params)
            return response.choices[0].message.content
        except Exception as e:
            logger.error(f"OpenAI chat completion error: {e}")
            raise

    @retry_decorator
    @trace_llm_call("generate_embedding", "text-embedding-3-large")
    async def generate_embedding(self, text: str, model: str = "text-embedding-3-large") -> list:
        """Generate embedding for text using OpenAI API"""
        try:
            response = await self.client.embeddings.create(
                input=text,
                model=model
            )
            return response.data[0].embedding
        except Exception as e:
            logger.error(f"OpenAI embedding error: {e}")
            raise

    @retry_decorator
    @trace_llm_call("generate_embeddings_batch", "text-embedding-3-large")
    async def generate_embeddings_batch(self, texts: list[str], model: str = "text-embedding-3-large") -> list:
        """Generate embeddings for multiple texts in batch"""
        try:
            response = await self.client.embeddings.create(
                input=texts,
                model=model
            )
            return [data.embedding for data in response.data]
        except Exception as e:
            logger.error(f"OpenAI batch embedding error: {e}")
            raise

# Global service instance
openai_service = OpenAIService()
