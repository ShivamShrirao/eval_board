#!/usr/bin/env python3
"""Ingest Eval Board data by scanning S3 prefixes per model.

Example usage:

    python python/examples/ingest_basic.py \
        --base-url http://localhost:3000 \
        --dataset-name coco-validation \
        --model "stable-diffusion-v4" s3://bucket/path/to/model_v4/ \
        --model "stable-diffusion-v5" s3://bucket/path/to/model_v5/

Requires AWS credentials (standard boto3 resolution).
"""

from __future__ import annotations

import argparse
import os
from dataclasses import dataclass
from typing import Dict, Iterable, Iterator, List

import boto3
from botocore.config import Config

from eval_board_client import DatasetDescriptor, EvalBoardClient, ImageSpec, ModelDescriptor


IMAGE_EXTENSIONS = {".jpg", ".jpeg", ".png", ".webp", ".gif", ".bmp", ".tif", ".tiff"}


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Ingest Eval Board data from S3 prefixes.")
    parser.add_argument("--base-url", default="http://localhost:3000", help="Eval Board base URL")
    parser.add_argument("--dataset-name", required=True, help="Dataset name to associate with these images")
    parser.add_argument(
        "--dataset-slug",
        help="Optional dataset slug; defaults to slugified dataset name"
    )
    parser.add_argument(
        "--max-images",
        type=int,
        default=None,
        help="Optional limit per model prefix"
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Print payload instead of POSTing"
    )
    parser.add_argument(
        "--aws-region",
        default=None,
        help="Explicit AWS region for S3 client"
    )
    parser.add_argument(
        "--model",
        action="append",
        nargs=2,
        metavar=("MODEL_NAME", "S3_PREFIX"),
        required=True,
        help="Pair of model name and S3 prefix (may repeat)",
    )
    return parser.parse_args()


def list_images_under_prefix(s3, bucket: str, prefix: str) -> Iterator[Dict[str, str]]:
    paginator = s3.get_paginator("list_objects_v2")
    for page in paginator.paginate(Bucket=bucket, Prefix=prefix):
        for obj in page.get("Contents", []):
            key = obj["Key"]
            if key.endswith("/"):
                continue
            _, ext = os.path.splitext(key)
            if ext.lower() not in IMAGE_EXTENSIONS:
                continue
            yield {"key": key, "filename": os.path.basename(key)}


def parse_s3_uri(uri: str) -> tuple[str, str]:
    if not uri.startswith("s3://"):
        raise ValueError(f"Not a valid S3 URI: {uri}")
    _, remainder = uri.split("s3://", 1)
    parts = remainder.split("/", 1)
    bucket = parts[0]
    prefix = parts[1] if len(parts) > 1 else ""
    if prefix and not prefix.endswith("/"):
        prefix += "/"
    return bucket, prefix


def discover_images(s3, model_name: str, prefix: str, limit: int | None) -> List[ImageSpec]:
    bucket, path = parse_s3_uri(prefix)
    items = list_images_under_prefix(s3, bucket, path)

    images: List[ImageSpec] = []
    for index, obj in enumerate(items):
        if limit is not None and index >= limit:
            break
        source = f"s3://{bucket}/{obj['key']}"
        images.append(
            ImageSpec(
                filename=obj["filename"],
                source_url=source,
                metadata={"model": model_name, "s3_key": obj["key"]},
            )
        )
    return images


def main() -> None:
    args = parse_args()

    session_config = {}
    if args.aws_region:
        session_config["region_name"] = args.aws_region

    s3 = boto3.client("s3", config=Config(signature_version="s3v4"), **session_config)

    dataset = DatasetDescriptor(name=args.dataset_name, slug=args.dataset_slug)

    all_images: List[ImageSpec] = []
    models: List[ModelDescriptor] = []

    for model_name, prefix in args.model:
        print(f"Discovering images for model '{model_name}' under {prefix}...")
        images = discover_images(s3, model_name, prefix, args.max_images)
        if not images:
            print(f"  No images found for {model_name} at {prefix}")
            continue
        all_images.extend(images)
        models.append(ModelDescriptor(name=model_name))

    if not all_images:
        print("No images discovered; nothing to ingest.")
        return

    model_descriptor = models[0]
    if len(models) > 1:
        print(
            "Multiple model prefixes provided; only the first model will be used for ingestion."
        )

    client = EvalBoardClient(base_url=args.base_url)

    print(f"Preparing payload: model={model_descriptor.name}, dataset={dataset.name}, images={len(all_images)}")

    payload = client.ingest(
        model=model_descriptor,
        dataset=dataset,
        images=all_images,
        dry_run=args.dry_run,
    )

    if args.dry_run:
        print("Dry run payload preview:")
        print(payload)
    else:
        print("Ingestion submitted successfully.")


if __name__ == "__main__":
    main()
