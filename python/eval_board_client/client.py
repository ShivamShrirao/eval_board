from __future__ import annotations

import dataclasses
from dataclasses import dataclass, field
from datetime import datetime
from typing import Any, Dict, Iterable, Mapping, MutableMapping, Optional

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
    description: Optional[str] = None


@dataclass
class DatasetDescriptor:
    name: str
    slug: Optional[str] = None


@dataclass
class ImageSpec:
    filename: str
    source_url: str
    prompt: Optional[str] = None
    thumbnail_url: Optional[str] = None
    width: Optional[int] = None
    height: Optional[int] = None
    captured_at: Optional[datetime] = None
    metadata: MutableMapping[str, Any] = field(default_factory=dict)

    def to_payload(self) -> Dict[str, Any]:
        payload = {
            "filename": self.filename,
            "sourceUrl": self.source_url,
            "prompt": self.prompt,
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
        timeout: int = 30,
        session: Optional[requests.Session] = None,
    ) -> None:
        self.base_url = _ensure_base_url(base_url)
        self.timeout = timeout
        self.api_key = api_key
        self._session = session or requests.Session()
        if api_key:
            self._session.headers.update({"Authorization": f"Bearer {api_key}"})
        self._session.headers.setdefault("Content-Type", "application/json")
        self._session.headers.setdefault("User-Agent", "eval-board-client/0.1.0")

    def close(self) -> None:
        self._session.close()

    def __enter__(self) -> "EvalBoardClient":
        return self

    def __exit__(self, exc_type, exc, tb) -> None:  # type: ignore[override]
        self.close()

    def ingest(
        self,
        *,
        model: ModelDescriptor | Mapping[str, Any],
        dataset: DatasetDescriptor | Mapping[str, Any],
        images: Iterable[ImageSpec],
        dry_run: bool = False,
    ) -> Mapping[str, Any]:
        image_payload = [image.to_payload() for image in images]

        payload = {
            "model": dataclasses.asdict(model) if isinstance(model, ModelDescriptor) else dict(model),
            "dataset": dataclasses.asdict(dataset) if isinstance(dataset, DatasetDescriptor) else dict(dataset),
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
