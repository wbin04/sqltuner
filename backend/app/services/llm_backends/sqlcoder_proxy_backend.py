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


class SQLCoderProxyBackend(BaseLLMBackend):
    """LLM backend that calls a LiteLLM proxy via OpenAI-compatible API.

    Designed for use with a proxy deployed on Hugging Face Spaces
    (e.g. whehehe04-sqlcoderproxy.hf.space/v1), but compatible with any
    OpenAI-spec endpoint — including local LiteLLM instances.
    """

    def __init__(self, base_url: str, api_key: str = "binproxy") -> None:
        """
        Args:
            base_url: Full base URL of the proxy, e.g.
                      "https://whehehe04-sqlcoderproxy.hf.space/v1"
            api_key:  API key sent in the Authorization header.
                      Defaults to "binproxy" (proxy-level auth token).
        """
        if not base_url:
            raise ValueError(
                "SQLCODER_PROXY_URL is required when LLM_SERVICE=sqlcoderproxy. "
                "Set it in your .env file."
            )
        self.base_url = base_url.rstrip("/")
        self.api_key = api_key
        self.timeout = LLM_REQUEST_TIMEOUT

    # ── helpers ──────────────────────────────────────────────────────────────

    def _create_timeout(self, read_timeout: Optional[float] = None) -> httpx.Timeout:
        return httpx.Timeout(
            connect=LLM_HTTP_CONNECT_TIMEOUT,
            read=read_timeout or float(self.timeout),
            write=LLM_HTTP_WRITE_TIMEOUT,
            pool=LLM_HTTP_POOL_TIMEOUT,
        )

    def _get_headers(self) -> Dict[str, str]:
        return {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
        }

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
        # json_mode via response_format is only sent when the proxy model
        # supports it; SQLCoder typically does not, so we skip it to avoid
        # a 422 error from the proxy.
        if json_mode:
            logger.info(
                "[LLM] JSON mode requested — SQLCoderProxy does not enforce "
                "response_format; prompt-level instruction used instead."
            )
        return payload

    # ── interface ─────────────────────────────────────────────────────────────

    async def call(
        self,
        model: str,
        prompt: str,
        system_prompt: Optional[str] = None,
        temperature: float = 0.1,
        max_tokens: int = 512,
        num_ctx: int = 4096,          # ignored — proxy manages context
        json_mode: bool = False,
        keep_alive: Optional[str] = None,  # ignored — cloud/proxy API
        read_timeout: Optional[float] = None,
    ) -> str:
        url = f"{self.base_url}/chat/completions"
        payload = self._build_payload(
            model=model,
            prompt=prompt,
            system_prompt=system_prompt,
            temperature=temperature,
            max_tokens=max_tokens,
            json_mode=json_mode,
        )
        headers = self._get_headers()
        timeout_cfg = self._create_timeout(read_timeout)

        logger.info(
            "[LLM] Calling SQLCoderProxy at %s with model=%s", self.base_url, model
        )

        async with httpx.AsyncClient(timeout=timeout_cfg) as client:
            try:
                response = await client.post(url, json=payload, headers=headers)
                response.raise_for_status()
                data = response.json()

                choices = data.get("choices", [])
                if not choices:
                    raise LLMServiceError(
                        "SQLCoderProxy Error: Empty choices in response"
                    )
                result = choices[0].get("message", {}).get("content", "").strip()
                logger.info(
                    "[LLM] SQLCoderProxy response received, length=%d", len(result)
                )
                return result

            except httpx.ConnectError as e:
                msg = f"Cannot connect to SQLCoderProxy at {self.base_url}. Error: {e}"
                logger.error("[LLM] %s", msg)
                raise LLMServiceError(f"SQLCoderProxy Connection Error: {msg}")

            except httpx.TimeoutException as e:
                msg = (
                    f"SQLCoderProxy request timed out after {self.timeout}s. "
                    f"Error: {e}"
                )
                logger.error("[LLM] %s", msg)
                raise LLMServiceError(f"SQLCoderProxy Timeout Error: {msg}")

            except httpx.HTTPStatusError as e:
                status = e.response.status_code
                body = e.response.text
                if status == 401:
                    msg = (
                        "SQLCoderProxy authentication failed. "
                        "Check SQLCODER_PROXY_API_KEY in .env"
                    )
                elif status == 429:
                    msg = f"SQLCoderProxy rate limit exceeded. Details: {body}"
                else:
                    msg = f"SQLCoderProxy returned HTTP {status}: {body}"
                logger.error("[LLM] %s", msg)
                raise LLMServiceError(f"SQLCoderProxy HTTP Error: {msg}")

            except LLMServiceError:
                raise

            except Exception as e:
                msg = (
                    f"Unexpected error calling SQLCoderProxy: "
                    f"{type(e).__name__}: {e}"
                )
                logger.error("[LLM] %s", msg)
                raise LLMServiceError(f"SQLCoderProxy API Error: {msg}")

    async def check_health(self, coder_model: str, chat_model: str) -> bool:
        """Probe the proxy by calling /models (OpenAI-compatible endpoint)."""
        try:
            url = f"{self.base_url}/models"
            headers = self._get_headers()
            async with httpx.AsyncClient(timeout=10) as client:
                response = await client.get(url, headers=headers)
                response.raise_for_status()
                data = response.json()
                model_ids = [m.get("id") for m in data.get("data", [])]
                logger.info(
                    "[LLM] SQLCoderProxy available models: %s", model_ids
                )
                # If proxy returns a model list, check presence; otherwise
                # treat a 200 response as healthy.
                if not model_ids:
                    return True
                has_coder = coder_model in model_ids or any(
                    mid.startswith(coder_model) for mid in model_ids
                )
                has_chat = chat_model in model_ids or any(
                    mid.startswith(chat_model) for mid in model_ids
                )
                return has_coder and has_chat
        except Exception as e:
            logger.warning("[LLM] SQLCoderProxy health check failed: %s", e)
            return False

    async def warmup(self, coder_model: str, chat_model: str) -> None:
        """No warm-up needed — proxy / cloud API."""
        logger.info(
            "[LLM-WARMUP] SQLCoderProxy is a remote API — skipping warm-up"
        )
