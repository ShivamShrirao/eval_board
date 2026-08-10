from __future__ import annotations

import dataclasses
import os
import warnings
from dataclasses import dataclass, field
from datetime import datetime
from typing import Any, Dict, Iterable, Literal, Mapping, MutableMapping, Optional

import requests


def _ensure_base_url(base_url: str) -> str:
    normalized = base_url.rstrip("/")
    if normalized.endswith("/api"):
        return normalized
    return f"{normalized}/api"


def _isoformat(dt: Optional[datetime]) -> Optional[str]:
    if dt is None:
        return None
    if dt.tzinfo is None:
        return dt.replace(tzinfo=datetime.now().astimezone().tzinfo).isoformat()
    return dt.isoformat()


@dataclass
class ModelDescriptor:
    name: str
    slug: Optional[str] = None
    type: Literal["image", "text"] = "image"
    description: Optional[str] = None


@dataclass
class BenchmarkDescriptor:
    name: str
    slug: Optional[str] = None


@dataclass
class DatasetDescriptor(BenchmarkDescriptor):
    """Deprecated alias for :class:`BenchmarkDescriptor`.

    Kept so existing external ingest scripts keep working. Emits a
    ``DeprecationWarning`` on construction.
    """

    def __post_init__(self) -> None:
        warnings.warn(
            "DatasetDescriptor is deprecated; use BenchmarkDescriptor instead.",
            DeprecationWarning,
            stacklevel=2,
        )


@dataclass
class ImageSpec:
    filename: str
    source_url: Optional[str] = None
    type: Literal["image", "text"] = "image"
    content: Optional[str] = None
    prompt: Optional[str] = None
    edit_instruction: Optional[str] = None
    thumbnail_url: Optional[str] = None
    width: Optional[int] = None
    height: Optional[int] = None
    captured_at: Optional[datetime] = None
    metadata: MutableMapping[str, Any] = field(default_factory=dict)

    def to_payload(self) -> Dict[str, Any]:
        payload = {
            "filename": self.filename,
            "type": self.type,
            "sourceUrl": self.source_url,
            "content": self.content,
            "prompt": self.prompt,
            "editInstruction": self.edit_instruction,
            "thumbnailUrl": self.thumbnail_url,
            "width": self.width,
            "height": self.height,
            "capturedAt": _isoformat(self.captured_at),
            "metadata": dict(self.metadata) if self.metadata else {},
        }
        # Remove keys with None values to keep payload lean.
        return {key: value for key, value in payload.items() if value is not None}


class EvalBoardClient:
    """
    Minimal SDK for interacting with the Eval Board ingestion API.
    """

    def __init__(
        self,
        base_url: str,
        *,
        api_key: Optional[str] = None,
        password: Optional[str] = None,
        timeout: int = 30,
        session: Optional[requests.Session] = None,
    ) -> None:
        self.base_url = _ensure_base_url(base_url)
        self.timeout = timeout
        self.api_key = api_key
        self._session = session or requests.Session()
        if api_key:
            self._session.headers.update({"Authorization": f"Bearer {api_key}"})
        # Eval Board's site password gate. The middleware accepts an
        # x-eval-board-password header for programmatic clients. Pull from the
        # explicit kwarg, then env, so scripts work without code changes.
        resolved_password = password or os.environ.get("EVAL_BOARD_PASSWORD")
        if resolved_password:
            self._session.headers.update({"x-eval-board-password": resolved_password})
        self._session.headers.setdefault("Content-Type", "application/json")
        self._session.headers.setdefault("User-Agent", "eval-board-client/0.1.0")

    def close(self) -> None:
        self._session.close()

    def __enter__(self) -> "EvalBoardClient":
        return self

    def __exit__(self, exc_type, exc, tb) -> None:  # type: ignore[override]
        self.close()

    def list_models(self, *, search: Optional[str] = None, limit: int = 100) -> list[Dict[str, Any]]:
        """List models, optionally filtered by search term."""
        params: Dict[str, Any] = {"limit": limit}
        if search:
            params["search"] = search
        response = self._session.get(
            f"{self.base_url}/models",
            params=params,
            timeout=self.timeout,
        )
        response.raise_for_status()
        return response.json().get("models", [])

    def delete_model(self, model_id: str) -> Mapping[str, Any]:
        """Delete a model by its ID."""
        response = self._session.delete(
            f"{self.base_url}/models/{model_id}",
            timeout=self.timeout,
        )
        response.raise_for_status()
        return response.json()

    def delete_model_by_name(self, model_name: str) -> Optional[Mapping[str, Any]]:
        """Delete a model by its name. Returns None if model not found."""
        models = self.list_models(search=model_name)
        for model in models:
            if model.get("name") == model_name:
                return self.delete_model(model["id"])
        return None

    def clear_model_images(self, model_id: str) -> Mapping[str, Any]:
        """Delete all images from a model without deleting the model itself."""
        response = self._session.delete(
            f"{self.base_url}/models/{model_id}/images",
            timeout=self.timeout,
        )
        response.raise_for_status()
        return response.json()

    def clear_model_images_by_name(self, model_name: str) -> Optional[Mapping[str, Any]]:
        """Delete all images from a model by name. Returns None if model not found."""
        models = self.list_models(search=model_name)
        for model in models:
            if model.get("name") == model_name:
                return self.clear_model_images(model["id"])
        return None

    def ingest(
        self,
        *,
        model: ModelDescriptor | Mapping[str, Any],
        benchmark: BenchmarkDescriptor | Mapping[str, Any] | None = None,
        images: Iterable[ImageSpec],
        dry_run: bool = False,
        dataset: BenchmarkDescriptor | Mapping[str, Any] | None = None,
    ) -> Mapping[str, Any]:
        # `dataset` is a deprecated alias for `benchmark`, kept for external scripts.
        if benchmark is None:
            if dataset is None:
                raise TypeError("ingest() missing required keyword argument: 'benchmark'")
            warnings.warn(
                "The `dataset` argument to ingest() is deprecated; use `benchmark` instead.",
                DeprecationWarning,
                stacklevel=2,
            )
            benchmark = dataset

        image_payload = [image.to_payload() for image in images]

        payload = {
            "model": dataclasses.asdict(model) if isinstance(model, ModelDescriptor) else dict(model),
            "benchmark": dataclasses.asdict(benchmark)
            if isinstance(benchmark, BenchmarkDescriptor)
            else dict(benchmark),
            "images": image_payload,
        }

        if dry_run:
            return payload

        response = self._session.post(
            f"{self.base_url}/ingest",
            json=payload,
            timeout=self.timeout,
        )
        response.raise_for_status()
        return response.json()
