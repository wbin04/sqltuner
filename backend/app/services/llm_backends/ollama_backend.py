import logging
from typing import Any, Dict, Optional

import httpx

from app.core.constants import (
    LLM_HTTP_CONNECT_TIMEOUT,
    LLM_HTTP_POOL_TIMEOUT,
    LLM_HTTP_WRITE_TIMEOUT,
    LLM_REQUEST_TIMEOUT,
)
from app.core.exceptions import LLMServiceError
from app.services.llm_backends.base import BaseLLMBackend

logger = logging.getLogger(__name__)


class OllamaBackend(BaseLLMBackend):
    """LLM backend that talks to a local Ollama instance."""

    def __init__(self, base_url: str) -> None:
        self.base_url = base_url.rstrip("/")
        self.timeout = LLM_REQUEST_TIMEOUT

    def _build_url(self, endpoint: str = "generate") -> str:
        return f"{self.base_url}/api/{endpoint}"

    def _create_timeout(self, read_timeout: Optional[float] = None) -> httpx.Timeout:
        return httpx.Timeout(
            connect=LLM_HTTP_CONNECT_TIMEOUT,
            read=read_timeout or float(self.timeout),
            write=LLM_HTTP_WRITE_TIMEOUT,
            pool=LLM_HTTP_POOL_TIMEOUT,
        )

    def _build_payload(
        self,
        model: str,
        prompt: str,
        system_prompt: Optional[str],
        temperature: float,
        max_tokens: int,
        num_ctx: int,
        json_mode: bool,
        keep_alive: Optional[str],
    ) -> Dict[str, Any]:
        payload: Dict[str, Any] = {
            "model": model,
            "prompt": prompt,
            "stream": False,
            "keep_alive": keep_alive or "60m",
            "options": {
                "temperature": temperature,
                "num_ctx": num_ctx,
                "num_predict": max_tokens,
            },
        }
        if system_prompt:
            payload["system"] = system_prompt
        if json_mode:
            payload["format"] = "json"
        return payload

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
        url = self._build_url()
        payload = self._build_payload(
            model=model,
            prompt=prompt,
            system_prompt=system_prompt,
            temperature=temperature,
            max_tokens=max_tokens,
            num_ctx=num_ctx,
            json_mode=json_mode,
            keep_alive=keep_alive,
        )
        timeout_config = self._create_timeout(read_timeout)

        if json_mode:
            logger.info("[LLM] JSON mode enabled")
        logger.info("[LLM] Calling Ollama at %s with model=%s", url, model)

        async with httpx.AsyncClient(timeout=timeout_config) as client:
            try:
                response = await client.post(url, json=payload)
                response.raise_for_status()
                result = response.json().get("response", "").strip()
                logger.info("[LLM] Ollama response received, length=%d", len(result))
                return result

            except httpx.ConnectError as e:
                error_msg = (
                    f"Cannot connect to Ollama at {url}. "
                    f"Is Ollama running? Error: {e}"
                )
                logger.error("[LLM] %s", error_msg)
                raise LLMServiceError(f"Ollama Connection Error: {error_msg}")

            except httpx.TimeoutException as e:
                error_msg = (
                    f"Ollama request timed out after {self.timeout}s. Error: {e}"
                )
                logger.error("[LLM] %s", error_msg)
                raise LLMServiceError(f"Ollama Timeout Error: {error_msg}")

            except httpx.HTTPStatusError as e:
                error_msg = (
                    f"Ollama returned HTTP {e.response.status_code}: "
                    f"{e.response.text}"
                )
                logger.error("[LLM] %s", error_msg)
                raise LLMServiceError(f"Ollama HTTP Error: {error_msg}")

            except Exception as e:
                error_msg = (
                    f"Unexpected error calling Ollama: "
                    f"{type(e).__name__}: {e}"
                )
                logger.error("[LLM] %s", error_msg)
                raise LLMServiceError(f"Ollama API Error: {error_msg}")

    async def check_health(self, coder_model: str, chat_model: str) -> bool:
        try:
            url = self._build_url("tags")
            async with httpx.AsyncClient(timeout=10) as client:
                response = await client.get(url)
                response.raise_for_status()
                data = response.json()
                models = data.get("models", [])
                model_names = [m.get("name") for m in models]
                has_coder = coder_model in model_names
                has_chat = chat_model in model_names
                return has_coder and has_chat
        except Exception:
            return False

    async def warmup(self, coder_model: str, chat_model: str) -> None:
        """Warm up Ollama models by sending minimal requests."""
        logger.info("[LLM-WARMUP] Warming up Ollama models...")
        try:
            await self.call(
                model=chat_model,
                prompt="Hi",
                system_prompt="You are a SQL expert",
                max_tokens=50,
            )
            logger.info("[LLM-WARMUP] Warmed up chat model: %s", chat_model)

            await self.call(
                model=coder_model,
                prompt="SELECT * FROM test",
                system_prompt="You are a SQL optimizer. Return JSON.",
                max_tokens=50,
                json_mode=True,
            )
            logger.info("[LLM-WARMUP] Warmed up coder model: %s", coder_model)
        except Exception as e:
            logger.warning("[LLM-WARMUP] Ollama warm-up failed: %s", e)
