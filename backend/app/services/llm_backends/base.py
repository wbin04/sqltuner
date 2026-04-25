import logging
from abc import ABC, abstractmethod
from typing import Optional

logger = logging.getLogger(__name__)


class BaseLLMBackend(ABC):
    """Abstract base class for LLM backends (Ollama, Groq, etc.)."""

    @abstractmethod
    async def call(
        self,
        model: str,
        prompt: str,
        system_prompt: Optional[str] = None,
        temperature: float = 0.1,
        max_tokens: int = 512,
        num_ctx: int = 4096,
        json_mode: bool = False,
        keep_alive: Optional[str] = None,
        read_timeout: Optional[float] = None,
    ) -> str:
        """
        Send a prompt to the LLM and return the raw text response.

        Args:
            model: Model name/identifier.
            prompt: User prompt text.
            system_prompt: Optional system instruction.
            temperature: Sampling temperature.
            max_tokens: Maximum tokens to generate.
            num_ctx: Context window size (Ollama-specific, ignored by others).
            json_mode: If True, instruct the LLM to return JSON.
            keep_alive: Keep-alive duration (Ollama-specific, ignored by others).
            read_timeout: Custom read timeout override.

        Returns:
            Raw text response from the LLM.
        """
        ...

    @abstractmethod
    async def check_health(self, coder_model: str, chat_model: str) -> bool:
        """
        Check whether the backend is reachable and the required models
        are available.

        Args:
            coder_model: The coder/optimization model name.
            chat_model: The chat/general model name.

        Returns:
            True if the backend is healthy and models are available.
        """
        ...

    @abstractmethod
    async def warmup(self, coder_model: str, chat_model: str) -> None:
        """
        Optional warm-up step.  Cloud APIs can no-op this.

        Args:
            coder_model: The coder/optimization model name.
            chat_model: The chat/general model name.
        """
        ...
