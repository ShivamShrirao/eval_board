from __future__ import annotations

import json
import os
from dataclasses import dataclass
from typing import Any, Dict, Iterable, List, Optional, Tuple
from urllib.parse import urlparse

import boto3

from .client import ImageSpec

IMAGE_EXTENSIONS = {".png", ".jpg", ".jpeg", ".webp", ".gif", ".bmp", ".tiff"}


class InvalidS3Uri(ValueError):
    pass


def parse_s3_uri(uri: str) -> Tuple[str, str]:
    parsed = urlparse(uri)
    if parsed.scheme != "s3" or not parsed.netloc:
        raise InvalidS3Uri(f"Invalid S3 URI: {uri}")
    bucket = parsed.netloc
    prefix = parsed.path.lstrip("/")
    if prefix and not prefix.endswith("/"):
        prefix += "/"
    return bucket, prefix


@dataclass
class S3ManifestBuilder:
    """
    Helper that mirrors the legacy scripts for turning S3 prefixes into ImageSpec payloads.
    """

    public_base_url: Optional[str] = None
    metadata_suffix: str = ".json"
    eager_metadata: bool = True
    s3_client: Optional[Any] = None

    def __post_init__(self) -> None:
        self.s3 = self.s3_client or boto3.client("s3")

    def build(
        self,
        *,
        image_prefixes: Iterable[str],
        metadata_prefix: Optional[str] = None,
    ) -> List[ImageSpec]:
        metadata_cache: Dict[str, Dict] = {}

        if metadata_prefix:
            metadata_cache = self._load_metadata(metadata_prefix)

        specs: List[ImageSpec] = []
        for uri in image_prefixes:
            bucket, prefix = parse_s3_uri(uri)
            for key in self._iter_keys(bucket, prefix):
                name = os.path.basename(key)
                root, ext = os.path.splitext(name)
                if ext.lower() not in IMAGE_EXTENSIONS:
                    continue
                metadata = dict(metadata_cache.get(root, {}))
                specs.append(
                    ImageSpec(
                        filename=name,
                        source_url=self._to_public_url(bucket, key),
                        prompt=metadata.get("prompt"),
                        width=metadata.get("width"),
                        height=metadata.get("height"),
                        metadata=metadata,
                    )
                )
        return specs

    def _iter_keys(self, bucket: str, prefix: str) -> Iterable[str]:
        paginator = self.s3.get_paginator("list_objects_v2")
        for page in paginator.paginate(Bucket=bucket, Prefix=prefix):
            for obj in page.get("Contents", []):
                key = obj["Key"]
                if key.endswith("/"):
                    continue
                yield key

    def _load_metadata(self, uri: str) -> Dict[str, Dict]:
        bucket, prefix = parse_s3_uri(uri)
        paginator = self.s3.get_paginator("list_objects_v2")
        out: Dict[str, Dict] = {}
        for page in paginator.paginate(Bucket=bucket, Prefix=prefix):
            for obj in page.get("Contents", []):
                key = obj["Key"]
                if not key.endswith(self.metadata_suffix):
                    continue
                root = os.path.splitext(os.path.basename(key))[0]
                if not self.eager_metadata:
                    out[root] = {"s3_key": key}
                    continue
                data = self.s3.get_object(Bucket=bucket, Key=key)["Body"].read()
                try:
                    out[root] = json.loads(data.decode("utf-8"))
                except json.JSONDecodeError:
                    out[root] = {}
        return out

    def _to_public_url(self, bucket: str, key: str) -> str:
        if self.public_base_url:
            return f"{self.public_base_url.rstrip('/')}/{key}"
        return f"s3://{bucket}/{key}"
