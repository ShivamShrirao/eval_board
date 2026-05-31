"""
Ingest character consistency eval dataset samples into EvalBoard.

Treats context (input) and edited (generated) images as two separate "models" for visual comparison.
Uses the same image/prompt pairing logic as 04_benchmark_characters.py.

Usage:
    python ingest_edit_eval.py
"""
from __future__ import annotations

import csv
import sys
import json
from glob import glob
from pathlib import Path
from typing import List

from requests import HTTPError

sys.path.insert(0, "/home/ubuntu/foundation-training")
from utils import s3 as s3_utils

from eval_board_client import DatasetDescriptor, EvalBoardClient, ImageSpec, ModelDescriptor

# Configuration
BASE_URL = "http://localhost:8080"
EVAL_BOARD_PASSWORD = "briaeval"
DATASET_NAME = "replace_bg"
DATASET_NAME = "product_embedding"
BATCH_SIZE = 100

# Source: "s3_prompts" for S3 images + local structured prompt JSONs,
#         "csv" for loading records from a CSV file.
SOURCE = "s3_prompts"
# SOURCE = "csv"
if SOURCE == "csv":
    DATASET_NAME = "guy_bench"

# --- CSV source config ---
CSV_PATH = "/home/ubuntu/custom_dataset/guy_bench.csv"

# --- S3 prompts source config ---
SOURCE_BUCKET = "hot-data-foundations-useast1"
SOURCE_PREFIX = "shivam/custom_dataset/product_consistency/images/"
STRUCTURED_PROMPTS_DIR = "/home/ubuntu/custom_dataset/product_consistency/replace_bg_structured_prompts"
SOURCE_PREFIX = "shivam/custom_dataset/product_embedding/images/"
STRUCTURED_PROMPTS_DIR = "/home/ubuntu/custom_dataset/product_embedding/structured_prompts"

# S3 output paths
OUTPUT_BUCKET = "hot-data-foundations-useast1"

# If non-empty, ingest these model names directly and ignore CKPT_STEPS.
FIXED_MODEL_NAMES = [
    # "sdedit_fibo_edit_char_merged",
]
# MODEL_NAME = f"bria_lifestyle_shot_by_text"
# OUTPUT_PREFIX = f"shivam/eval/{DATASET_NAME}/{MODEL_NAME}"

LORA_SCALE = 1.0
CKPT_PREFIX = "ema_replace_bg_fm_lpips_ema_ckpt_"
# Range of ckpt_step values to ingest. Used only when FIXED_MODEL_NAMES is empty.
CKPT_STEPS = list(range(300, 901, 100))



def build_model_name(ckpt_step: int, lora_scale: float = LORA_SCALE) -> str:
    return f"{CKPT_PREFIX}{ckpt_step:06d}-lora{lora_scale}"


def build_output_prefix(model_name: str) -> str:
    return f"shivam/eval/{DATASET_NAME}/{model_name}"


def get_pairs_from_s3_prompts(output_prefix: str) -> List[dict]:
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
        prompt_pattern = f"{STRUCTURED_PROMPTS_DIR}/{image_filename}*.json"
        prompt_files = sorted(glob(prompt_pattern))

        if not prompt_files:
            continue

        for prompt_path in prompt_files:
            prompt_filename = Path(prompt_path).stem

            # Output key matches the logic in 04_benchmark_characters.py
            # Output keeps the original image extension
            image_ext = Path(source_key).suffix
            output_key = f"{output_prefix}/{prompt_filename}{image_ext}"

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
                "edit_instruction": json.loads(structured_prompt)["edit_instruction"],
            })

    print(f"Found {len(pairs)} image/prompt pairs")
    return pairs


def get_pairs_from_csv(csv_path: str, output_prefix: str) -> List[dict]:
    """
    Get all image/prompt pairs from a CSV file.
    Expected columns: key, bucket, path, dataset_name, instruction, edit_type, structured_prompt
    """
    print(f"Reading records from CSV: {csv_path}")
    pairs = []

    with open(csv_path, "r") as f:
        reader = csv.DictReader(f)
        for row in reader:
            prompt_id = row["key"]
            image_ext = Path(row["path"]).suffix
            # Ensure the key has a file extension
            key_with_ext = f"{prompt_id}{image_ext}" if not Path(prompt_id).suffix else prompt_id

            pairs.append({
                "prompt_id": prompt_id,
                "image_ext": image_ext,
                "source_bucket": row["bucket"],
                "source_key": row["path"],
                "output_bucket": OUTPUT_BUCKET,
                "output_key": f"{output_prefix}/{key_with_ext}",
                "structured_prompt": row["structured_prompt"],
                "edit_instruction": row.get("instruction", ""),
            })

    print(f"Found {len(pairs)} image/prompt pairs from CSV")
    return pairs


def create_image_specs(
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
            source_uri = f"s3://{bucket}/{key}"
            images.append(
                ImageSpec(
                    filename=filename,
                    source_url=source_uri,
                    metadata={
                        "model": model_name,
                        "prompt_id": prompt_id,
                        "s3_bucket": bucket,
                        "s3_key": key,
                        "structured_prompt": pair.get("structured_prompt", ""),
                        "edit_instruction": pair.get("edit_instruction", ""),
                    },
                )
            )
        except Exception as e:
            print(f"Error generating URL for {bucket}/{key}: {e}")
            continue

    return images


def ingest_for_model(client: EvalBoardClient, model_name: str, include_context: bool) -> None:
    output_prefix = build_output_prefix(model_name)

    print(f"\n=== model={model_name} ===")

    # Get all image/prompt pairs
    if SOURCE == "csv":
        pairs = get_pairs_from_csv(CSV_PATH, output_prefix)
    else:
        pairs = get_pairs_from_s3_prompts(output_prefix)
    if not pairs:
        print("No pairs found, skipping.")
        return

    dataset = DatasetDescriptor(name=DATASET_NAME)

    # Models: context (source image) and edited (generated image).
    # Only ingest the context model on the first iteration since it doesn't
    # depend on the generated model.
    models = []
    if include_context:
        models.append(("context", "source_bucket", "source_key"))
    models.append((model_name, "output_bucket", "output_key"))

    for m_name, bucket_field, key_field in models:
        print(f"\nProcessing model '{m_name}'...")

        images = create_image_specs(pairs, m_name, bucket_field, key_field)
        if not images:
            print(f"  No images found for {m_name}")
            continue

        model_descriptor = ModelDescriptor(name=m_name)

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


def main() -> None:
    client = EvalBoardClient(base_url=BASE_URL, password=EVAL_BOARD_PASSWORD)

    if FIXED_MODEL_NAMES:
        model_names = list(FIXED_MODEL_NAMES)
    else:
        model_names = [build_model_name(step) for step in CKPT_STEPS]

    for idx, model_name in enumerate(model_names):
        ingest_for_model(client, model_name, include_context=(idx == 0))

    print("\nDone.")


if __name__ == "__main__":
    main()
