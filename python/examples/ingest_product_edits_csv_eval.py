"""
Sample product-edit rows from a CSV and ingest them into Eval Board.

Workflow:
1. Stream rows from `CSV_PATH`.
2. Reservoir-sample `NUM_SAMPLES` records.
3. Ingest input images as the `context` model.
4. Ingest output images as the `target` model.

Usage:
    python ingest_product_edits_csv_eval.py
"""
from __future__ import annotations

import csv
import random
from pathlib import Path
from typing import Iterable, List

from requests import HTTPError

from eval_board_client import DatasetDescriptor, EvalBoardClient, ImageSpec, ModelDescriptor

# Configuration
BASE_URL = "http://localhost:8080"
EVAL_BOARD_PASSWORD = "briaeval"

# The requested `product_edits_filtered_significant.csv` is not present in this workspace.
# This points to the closest available dataset with the needed input/output S3 columns.
CSV_PATH = Path("/home/ubuntu/custom_dataset/product_edits_filtered_with_masks.csv")

DATASET_NAME = "product_edits_filtered_significant"
NUM_SAMPLES = 200
RANDOM_SEED = 42
BATCH_SIZE = 100
MODEL_SPECS = [
    ("context", "input_bucket", "input_key"),
    ("target", "output_bucket", "output_key"),
]

# Set to True if you want to wipe the sampled models before re-ingesting.
CLEAR_EXISTING_MODEL_IMAGES = False


def choose_prompt(row: dict[str, str]) -> str | None:
    for key in ("prompt_3", "prompt_2", "prompt_1", "short_description"):
        value = (row.get(key) or "").strip()
        if value:
            return value
    return None


def sample_csv_rows(csv_path: Path, num_samples: int, seed: int) -> tuple[List[dict[str, str]], int]:
    rng = random.Random(seed)
    sampled_rows: List[dict[str, str]] = []
    total_rows = 0

    with csv_path.open("r", newline="") as handle:
        reader = csv.DictReader(handle)
        for row in reader:
            total_rows += 1

            if len(sampled_rows) < num_samples:
                sampled_rows.append(row)
                continue

            replace_idx = rng.randrange(total_rows)
            if replace_idx < num_samples:
                sampled_rows[replace_idx] = row

    sampled_rows.sort(key=lambda row: (row.get("edit_id") or "", row.get("input_key") or ""))
    return sampled_rows, total_rows


def build_filename(row: dict[str, str], key_field: str) -> str:
    edit_id = (row.get("edit_id") or "").strip() or (row.get("output_id") or "").strip() or "sample"
    key = (row.get(key_field) or "").strip()
    ext = Path(key).suffix or ".jpg"
    return f"{edit_id}{ext}"


def build_metadata(row: dict[str, str], model_name: str, bucket: str, key: str) -> dict[str, str]:
    metadata = {
        "model": model_name,
        "edit_id": (row.get("edit_id") or "").strip(),
        "input_id": row.get("input_id", ""),
        "output_id": row.get("output_id", ""),
        "edit_category": row.get("edit_category", ""),
        "data_type": row.get("data_type", ""),
        "prompt_1": row.get("prompt_1", ""),
        "prompt_2": row.get("prompt_2", ""),
        "prompt_3": row.get("prompt_3", ""),
        "short_description": row.get("short_description", ""),
        "caption": row.get("caption", ""),
        "is_product_edit": row.get("is_product_edit", ""),
        "product_name": row.get("product_name", ""),
        "classification_reason": row.get("classification_reason", ""),
        "s3_bucket": bucket,
        "s3_key": key,
    }

    for optional_key in (
        "mask_bucket",
        "mask_key",
        "input_mask_bucket",
        "input_mask_key",
        "is_significant_edit",
        "transformation_type",
        "significance_reason",
        "is_complex_bg",
        "bg_type",
    ):
        value = row.get(optional_key)
        if value not in (None, ""):
            metadata[optional_key] = value

    return metadata


def create_image_specs(
    rows: Iterable[dict[str, str]],
    model_name: str,
    bucket_field: str,
    key_field: str,
) -> List[ImageSpec]:
    images: List[ImageSpec] = []

    for row in rows:
        bucket = (row.get(bucket_field) or "").strip()
        key = (row.get(key_field) or "").strip()
        if not bucket or not key:
            continue

        source_uri = f"s3://{bucket}/{key}"
        input_width_raw = (row.get("input_width") or "").strip()
        input_height_raw = (row.get("input_height") or "").strip()
        width = int(input_width_raw) if input_width_raw else None
        height = int(input_height_raw) if input_height_raw else None
        edit_id = (row.get("edit_id") or "").strip() or (row.get("output_id") or "").strip() or "unknown"

        images.append(
            ImageSpec(
                filename=build_filename(row, key_field),
                source_url=source_uri,
                prompt=choose_prompt(row),
                width=width,
                height=height,
                metadata=build_metadata(row, model_name, bucket, key),
            )
        )

    return images


def main() -> None:
    print(f"Sampling rows from {CSV_PATH}...")
    rows, total_rows = sample_csv_rows(CSV_PATH, NUM_SAMPLES, RANDOM_SEED)
    if not rows:
        print("No rows found, exiting.")
        return

    print(f"Sampled {len(rows)} row(s) from {total_rows} total.")

    client = EvalBoardClient(base_url=BASE_URL, password=EVAL_BOARD_PASSWORD)
    dataset = DatasetDescriptor(name=DATASET_NAME)

    if CLEAR_EXISTING_MODEL_IMAGES:
        print("\nClearing existing model images...")
        for model_name, _, _ in MODEL_SPECS:
            result = client.clear_model_images_by_name(model_name)
            if result:
                deleted_artifacts = result.get("deletedArtifacts", 0)
                print(f"  Cleared model '{model_name}' ({deleted_artifacts} images removed)")
            else:
                print(f"  Model '{model_name}' not found, skipping")

    for model_name, bucket_field, key_field in MODEL_SPECS:
        print(f"\nProcessing model '{model_name}'...")
        images = create_image_specs(
            rows=rows,
            model_name=model_name,
            bucket_field=bucket_field,
            key_field=key_field,
        )
        if not images:
            print(f"  No images found for {model_name}")
            continue

        model_descriptor = ModelDescriptor(name=model_name)
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
