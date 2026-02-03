"""
Ingest character consistency eval dataset samples into EvalBoard.

Treats context (input) and edited (generated) images as two separate "models" for visual comparison.
Uses the same image/prompt pairing logic as 04_benchmark_characters.py.

Usage:
    python ingest_edit_eval.py
"""
from __future__ import annotations

import sys
from glob import glob
from pathlib import Path
from typing import List

import boto3
from botocore.config import Config
from requests import HTTPError

sys.path.insert(0, "/home/ubuntu/foundation-training")
from utils import s3 as s3_utils

from eval_board_client import DatasetDescriptor, EvalBoardClient, ImageSpec, ModelDescriptor

# Configuration
BASE_URL = "http://localhost:3000"
DATASET_NAME = "character_consistency_eval"
BATCH_SIZE = 100

# S3 paths
SOURCE_BUCKET = "hot-data-foundations-useast1"
SOURCE_PREFIX = "shivam/eval/benchmark/character_consistency/images/"
OUTPUT_BUCKET = "hot-data-foundations-useast1"
lora_scale = 1.0
OUTPUT_PREFIX = f"shivam/eval/character_consistency/infer20-lora{lora_scale}"
STRUCTURED_PROMPTS_DIR = "/home/ubuntu/custom_dataset/character_consistency/structured_prompts"


def generate_signed_url(s3, bucket: str, key: str, expires_in: int = 604800) -> str:
    """Generate a presigned URL for an S3 object (default 7 days expiry)."""
    return s3.generate_presigned_url(
        "get_object",
        Params={"Bucket": bucket, "Key": key},
        ExpiresIn=expires_in,
    )


def get_image_prompt_pairs() -> List[dict]:
    """
    Get all image/prompt pairs following the same logic as 04_benchmark_characters.py.
    Returns list of dicts with source image info and output image info.
    """
    print(f"Listing images from s3://{SOURCE_BUCKET}/{SOURCE_PREFIX}")
    objects = s3_utils.list_objects_by_prefix(SOURCE_BUCKET, SOURCE_PREFIX)
    image_extensions = {".png", ".jpg", ".jpeg", ".webp"}
    images = [obj for obj in objects if Path(obj["Key"]).suffix.lower() in image_extensions]
    print(f"Found {len(images)} source images")

    pairs = []

    for img in images:
        source_key = img["Key"]
        image_filename = Path(source_key).stem

        # Find all structured prompts for this image (pattern: {image_filename}_{i}.json)
        prompt_pattern = f"{STRUCTURED_PROMPTS_DIR}/{image_filename}_*.json"
        prompt_files = sorted(glob(prompt_pattern))

        if not prompt_files:
            continue

        for prompt_path in prompt_files:
            prompt_filename = Path(prompt_path).stem
            
            # Output key matches the logic in 04_benchmark_characters.py
            # Output keeps the original image extension
            image_ext = Path(source_key).suffix
            output_key = f"{OUTPUT_PREFIX}/{prompt_filename}{image_ext}"

            # Read the structured prompt for metadata
            with open(prompt_path, "r") as f:
                structured_prompt = f.read()

            pairs.append({
                "prompt_id": prompt_filename,
                "image_ext": image_ext,
                "source_bucket": SOURCE_BUCKET,
                "source_key": source_key,
                "output_bucket": OUTPUT_BUCKET,
                "output_key": output_key,
                "structured_prompt": structured_prompt,
            })

    print(f"Found {len(pairs)} image/prompt pairs")
    return pairs


def create_image_specs(
    s3,
    pairs: List[dict],
    model_name: str,
    bucket_field: str,
    key_field: str,
) -> List[ImageSpec]:
    """Create ImageSpec list for a model from pairs."""
    images: List[ImageSpec] = []

    for pair in pairs:
        bucket = pair[bucket_field]
        key = pair[key_field]
        prompt_id = pair["prompt_id"]

        # Use prompt_id as filename for matching across models (keep original ext)
        image_ext = pair.get("image_ext", ".png")
        filename = f"{prompt_id}{image_ext}"

        try:
            signed_url = generate_signed_url(s3, bucket, key)
            images.append(
                ImageSpec(
                    filename=filename,
                    source_url=signed_url,
                    metadata={
                        "model": model_name,
                        "prompt_id": prompt_id,
                        "s3_bucket": bucket,
                        "s3_key": key,
                        "structured_prompt": pair.get("structured_prompt", ""),
                    },
                )
            )
        except Exception as e:
            print(f"Error generating URL for {bucket}/{key}: {e}")
            continue

    return images


def main() -> None:
    # Initialize S3 client
    s3 = boto3.client("s3", config=Config(signature_version="s3v4"))

    # Get all image/prompt pairs
    pairs = get_image_prompt_pairs()
    if not pairs:
        print("No pairs found, exiting.")
        return

    # Initialize EvalBoard client
    client = EvalBoardClient(base_url=BASE_URL)
    dataset = DatasetDescriptor(name=DATASET_NAME)

    # Models: context (source image) and edited (generated image)
    models = [
        ("context", "source_bucket", "source_key"),
        (f"trained-lora{lora_scale}", "output_bucket", "output_key"),
    ]

    # Ingest each model
    for model_name, bucket_field, key_field in models:
        print(f"\nProcessing model '{model_name}'...")

        images = create_image_specs(s3, pairs, model_name, bucket_field, key_field)
        if not images:
            print(f"  No images found for {model_name}")
            continue

        model_descriptor = ModelDescriptor(name=model_name)

        # Batch the images
        total_images = len(images)
        num_batches = (total_images + BATCH_SIZE - 1) // BATCH_SIZE
        print(f"  Ingesting {total_images} images in {num_batches} batch(es)...")

        for batch_idx in range(num_batches):
            start_idx = batch_idx * BATCH_SIZE
            end_idx = min(start_idx + BATCH_SIZE, total_images)
            batch_images = images[start_idx:end_idx]

            print(f"  Batch {batch_idx + 1}/{num_batches}: images {start_idx + 1}-{end_idx}...")

            try:
                client.ingest(
                    model=model_descriptor,
                    dataset=dataset,
                    images=batch_images,
                    dry_run=False,
                )
                print(f"  Batch {batch_idx + 1}/{num_batches} submitted successfully.")
            except HTTPError as exc:
                print(f"  Batch {batch_idx + 1}/{num_batches} failed: {exc.response.status_code} {exc.response.text}")
            except Exception as exc:
                print(f"  Batch {batch_idx + 1}/{num_batches} error: {exc}")

    print("\nDone.")


if __name__ == "__main__":
    main()
