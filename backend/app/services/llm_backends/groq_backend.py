import logging
from typing import Any, Dict, List, Optional

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

GROQ_API_BASE = "https://api.groq.com/openai/v1"


class GroqBackend(BaseLLMBackend):
    """LLM backend that talks to the Groq cloud API (OpenAI-compatible)."""

    def __init__(self, api_key: str) -> None:
        if not api_key:
            raise ValueError(
                "GROQ_API_KEY is required when LLM_SERVICE=groq. "
                "Set it in your .env file."
            )
        self.api_key = api_key
        self.timeout = LLM_REQUEST_TIMEOUT

    def _create_timeout(self, read_timeout: Optional[float] = None) -> httpx.Timeout:
        return httpx.Timeout(
            connect=LLM_HTTP_CONNECT_TIMEOUT,
            read=read_timeout or float(self.timeout),
            write=LLM_HTTP_WRITE_TIMEOUT,
            pool=LLM_HTTP_POOL_TIMEOUT,
        )

    def _build_messages(
        self, prompt: str, system_prompt: Optional[str]
    ) -> List[Dict[str, str]]:
        messages: List[Dict[str, str]] = []
        if system_prompt:
            messages.append({"role": "system", "content": system_prompt})
        messages.append({"role": "user", "content": prompt})
        return messages

    def _build_payload(
        self,
        model: str,
        prompt: str,
        system_prompt: Optional[str],
        temperature: float,
        max_tokens: int,
        json_mode: bool,
    ) -> Dict[str, Any]:
        payload: Dict[str, Any] = {
            "model": model,
            "messages": self._build_messages(prompt, system_prompt),
            "temperature": temperature,
            "max_tokens": max_tokens,
        }
        if json_mode:
            payload["response_format"] = {"type": "json_object"}
        return payload

    def _get_headers(self) -> Dict[str, str]:
        return {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
        }

    async def call(
        self,
        model: str,
        prompt: str,
        system_prompt: Optional[str] = None,
        temperature: float = 0.1,
        max_tokens: int = 512,
        num_ctx: int = 4096,         # ignored for Groq
        json_mode: bool = False,
        keep_alive: Optional[str] = None,  # ignored for Groq
        read_timeout: Optional[float] = None,
    ) -> str:
        url = f"{GROQ_API_BASE}/chat/completions"
        payload = self._build_payload(
            model=model,
            prompt=prompt,
            system_prompt=system_prompt,
            temperature=temperature,
            max_tokens=max_tokens,
            json_mode=json_mode,
        )
        headers = self._get_headers()
        timeout_config = self._create_timeout(read_timeout)

        if json_mode:
            logger.info("[LLM] JSON mode enabled (Groq response_format)")
        logger.info("[LLM] Calling Groq API with model=%s", model)

        async with httpx.AsyncClient(timeout=timeout_config) as client:
            try:
                response = await client.post(url, json=payload, headers=headers)
                response.raise_for_status()
                data = response.json()

                # Extract content from OpenAI-compatible response
                choices = data.get("choices", [])
                if not choices:
                    raise LLMServiceError(
                        "Groq API Error: Empty choices in response"
                    )
                result = choices[0].get("message", {}).get("content", "").strip()
                logger.info("[LLM] Groq response received, length=%d", len(result))
                return result

            except httpx.ConnectError as e:
                error_msg = f"Cannot connect to Groq API. Error: {e}"
                logger.error("[LLM] %s", error_msg)
                raise LLMServiceError(f"Groq Connection Error: {error_msg}")

            except httpx.TimeoutException as e:
                error_msg = f"Groq request timed out after {self.timeout}s. Error: {e}"
                logger.error("[LLM] %s", error_msg)
                raise LLMServiceError(f"Groq Timeout Error: {error_msg}")

            except httpx.HTTPStatusError as e:
                status = e.response.status_code
                body = e.response.text
                if status == 429:
                    error_msg = (
                        f"Groq rate limit exceeded. "
                        f"Please wait and retry. Details: {body}"
                    )
                elif status == 401:
                    error_msg = (
                        "Groq authentication failed. "
                        "Check your GROQ_API_KEY in .env"
                    )
                else:
                    error_msg = f"Groq returned HTTP {status}: {body}"
                logger.error("[LLM] %s", error_msg)
                raise LLMServiceError(f"Groq HTTP Error: {error_msg}")

            except LLMServiceError:
                raise

            except Exception as e:
                error_msg = (
                    f"Unexpected error calling Groq: "
                    f"{type(e).__name__}: {e}"
                )
                logger.error("[LLM] %s", error_msg)
                raise LLMServiceError(f"Groq API Error: {error_msg}")

    async def check_health(self, coder_model: str, chat_model: str) -> bool:
        """Check health by listing available models on Groq."""
        try:
            url = f"{GROQ_API_BASE}/models"
            headers = self._get_headers()
            async with httpx.AsyncClient(timeout=10) as client:
                response = await client.get(url, headers=headers)
                response.raise_for_status()
                data = response.json()
                model_ids = [m.get("id") for m in data.get("data", [])]
                has_coder = coder_model in model_ids
                has_chat = chat_model in model_ids
                if has_coder and has_chat:
                    return True
                # Models might have version suffixes; do prefix matching
                has_coder = has_coder or any(
                    mid.startswith(coder_model) for mid in model_ids
                )
                has_chat = has_chat or any(
                    mid.startswith(chat_model) for mid in model_ids
                )
                return has_coder and has_chat
        except Exception as e:
            logger.warning("[LLM] Groq health check failed: %s", e)
            return False

    async def warmup(self, coder_model: str, chat_model: str) -> None:
        """No warm-up needed for cloud APIs."""
        logger.info("[LLM-WARMUP] Groq is a cloud API — skipping warm-up")
