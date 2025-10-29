from __future__ import annotations

import os
from typing import Dict, Iterator, List

import boto3
from botocore.config import Config

from eval_board_client import DatasetDescriptor, EvalBoardClient, ImageSpec, ModelDescriptor
from requests import HTTPError


IMAGE_EXTENSIONS = {".jpg", ".jpeg", ".png", ".webp", ".gif", ".bmp", ".tif", ".tiff"}

# Configuration - modify these variables as needed
BASE_URL = "http://localhost:3000"
DATASET_NAME = "hand_keywords"

# List of (model_name, s3_prefix) tuples
MODELS = [
    # ("alchamist_base_old_neg_prompt", "s3://hot-data-foundations-useast1/shivam/eval/neg_prompt_simple_base/checkpoint_1000/"),
    # ("neg_prompt_simple_128_lora", "s3://hot-data-foundations-useast1/shivam/eval/neg_prompt_simple_128_lora/checkpoint_000400/"),
    # ("neg_prompt_simple_256_lora", "s3://hot-data-foundations-useast1/shivam/eval/neg_prompt_simple_256_lora/checkpoint_000400/"),
    # ("alchamist_base_hand_only_neg_prompt", "s3://hot-data-foundations-useast1/shivam/eval/neg_prompt_hand_only_base/checkpoint_1000/"),
    # ("alchamist_base_no_neg", "s3://hot-data-foundations-useast1/shivam/eval/neg_prompt_no_neg_base/checkpoint_1000/"),
    # ("neg_prompt_hand_only_128_lora_000200", "s3://hot-data-foundations-useast1/shivam/eval/neg_prompt_hand_only_128_lora/checkpoint_000200/"),
    # ("neg_prompt_hand_only_128_lora_000400", "s3://hot-data-foundations-useast1/shivam/eval/neg_prompt_hand_only_128_lora/checkpoint_000400/"),
    # ("neg_prompt_hand_keywords_200", "s3://hot-data-foundations-useast1/shivam/eval/neg_prompt_hand_keywords/checkpoint_000200/"),
    # ("neg_prompt_hand_keywords_400", "s3://hot-data-foundations-useast1/shivam/eval/neg_prompt_hand_keywords/checkpoint_000400/"),
    # ("neg_prompt_realism_keywords_200", "s3://hot-data-foundations-useast1/shivam/eval/neg_prompt_realism_keywords/checkpoint_000200/"),
    # ("neg_prompt_realism_keywords_400", "s3://hot-data-foundations-useast1/shivam/eval/neg_prompt_realism_keywords/checkpoint_000400/"),
    ('bad_images', "s3://hot-data-foundations-useast1/shivam/custom_dataset/neg_prompt_hand_keywords/bad_images/"),
    # ('good_images', "s3://hot-data-foundations-useast1/shivam/custom_dataset/neg_prompt_hand_keywords/good_images/"),
    # ('bad_images', "s3://hot-data-foundations-useast1/shivam/custom_dataset/neg_random_select/bad_images/"),
    # ('good_images', "s3://hot-data-foundations-useast1/shivam/custom_dataset/neg_random_select/good_images/"),
]


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


def discover_images(s3, model_name: str, prefix: str) -> List[ImageSpec]:
    bucket, path = parse_s3_uri(prefix)
    items = list_images_under_prefix(s3, bucket, path)

    images: List[ImageSpec] = []
    for obj in items:
        # Generate signed URL with maximum expiration (7 days)
        signed_url = s3.generate_presigned_url(
            'get_object',
            Params={
                'Bucket': bucket,
                'Key': obj['key']
            },
            ExpiresIn=604800  # 7 days (maximum allowed)
        )
        
        images.append(
            ImageSpec(
                filename=obj["filename"],
                source_url=signed_url,
                metadata={
                    "model": model_name,
                    "s3_key": obj["key"],
                    "s3_bucket": bucket  # Store bucket/key for potential regeneration
                },
            )
        )
    return images


def main() -> None:
    s3 = boto3.client("s3", config=Config(signature_version="s3v4"))
    dataset = DatasetDescriptor(name=DATASET_NAME)
    client = EvalBoardClient(base_url=BASE_URL)
    for model_name, prefix in MODELS:
        print(f"Discovering images for model '{model_name}' under {prefix}...")
        images = discover_images(s3, model_name, prefix)
        if not images:
            print(f"  No images found for {model_name} at {prefix}")
            continue

        model_descriptor = ModelDescriptor(name=model_name)
        print(
            f"Preparing payload: model={model_descriptor.name}, dataset={dataset.name}, images={len(images)}"
        )

        try:
            payload = client.ingest(
                model=model_descriptor,
                dataset=dataset,
                images=images,
                dry_run=False,
            )
            print("Ingestion submitted successfully.")
        except HTTPError as exc:
            print(f"Ingestion failed for model '{model_name}': {exc.response.status_code} {exc.response.text}")
        except Exception as exc:
            print(f"Unexpected error ingesting model '{model_name}': {exc}")

    print("Done.")


if __name__ == "__main__":
    main()
