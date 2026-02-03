"""
Ingest nano_consist edit dataset samples into EvalBoard.

Treats input and output images as two separate "models" for visual comparison.
Deterministically selects 100 random samples from the CSV.

Usage:
    python ingest_edit.py
"""
from __future__ import annotations

import os
import random
from pathlib import Path
from typing import List

import boto3
import pandas as pd
from botocore.config import Config
from requests import HTTPError

from eval_board_client import DatasetDescriptor, EvalBoardClient, ImageSpec, ModelDescriptor

# Configuration
BASE_URL = "http://localhost:3000"
DATASET_NAME = "nano_consist_filter"
# DATASET_NAME = "nano_consist_small_edits"
# Use the CSV with face count metadata (created by prepare_face_draft_data.py)
CSV_PATH = Path("~/custom_dataset/nano_consist_150k_approved_with_res.csv").expanduser()
CSV_PATH = Path("/home/ubuntu/custom_dataset/nano_consist_big_edits.csv").expanduser()
# CSV_PATH = Path("/home/ubuntu/custom_dataset/nano_consist_small_edits.csv").expanduser()
NUM_SAMPLES = 200
RANDOM_SEED = 42
BATCH_SIZE = 100

# Models represent input vs output images
# Supports both old format (input_image_bucket/key) and new format (input_bucket/key)
MODELS = [
    ("context", "input_bucket", "input_key"),
    ("edited", "output_bucket", "output_key"),
]


def generate_signed_url(s3, bucket: str, key: str, expires_in: int = 604800) -> str:
    """Generate a presigned URL for an S3 object (default 7 days expiry)."""
    return s3.generate_presigned_url(
        "get_object",
        Params={"Bucket": bucket, "Key": key},
        ExpiresIn=expires_in,
    )


def load_and_sample_csv(csv_path: Path, num_samples: int, seed: int) -> pd.DataFrame:
    """Load CSV, filter for 1 face, and deterministically sample records."""
    print(f"Loading CSV from {csv_path}...")
    df = pd.read_csv(csv_path)
    print(f"Loaded {len(df)} records.")

    # Filter for exactly 1 face detected
    if "face_count" in df.columns:
        df = df[df["face_count"] == 1].reset_index(drop=True)
        print(f"Filtered to {len(df)} records with exactly 1 face.")
    else:
        print("Warning: 'face_count' column not found, skipping face filter.")

    # Deterministic random sampling
    random.seed(seed)
    if len(df) > num_samples:
        sampled_indices = random.sample(range(len(df)), num_samples)
        sampled_indices.sort()  # Keep order deterministic
        df = df.iloc[sampled_indices].reset_index(drop=True)
        print(f"Sampled {num_samples} records (seed={seed}).")
    else:
        print(f"Using all {len(df)} records (less than {num_samples}).")

    return df


def create_image_specs(
    s3,
    df: pd.DataFrame,
    model_name: str,
    bucket_col: str,
    key_col: str,
) -> List[ImageSpec]:
    """Create ImageSpec list for a model from DataFrame."""
    images: List[ImageSpec] = []

    for idx, row in df.iterrows():
        bucket = row[bucket_col]
        key = row[key_col]
        # Support both edit_id (new format) and prompt_id (old format)
        edit_id = row.get("edit_id", row.get("prompt_id", f"sample_{idx}"))


        # Use edit_id as filename for matching across models
        # Keep original extension from key
        ext = Path(key).suffix if key else ".png"
        filename = f"{edit_id}{ext}"

        try:
            signed_url = generate_signed_url(s3, bucket, key)
            images.append(
                ImageSpec(
                    filename=filename,
                    source_url=signed_url,
                    metadata={
                        "model": model_name,
                        "edit_id": edit_id,
                        "s3_bucket": bucket,
                        "s3_key": key,
                        "prompt_1": str(row.get("prompt_1", "")),
                        "prompt_2": str(row.get("prompt_2", "")),
                        "short_description": str(row.get("short_description", "")),
                        "edit_category": str(row.get("edit_category", "")),
                        "classification_reason": str(row.get("classification_reason", "")),
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

    # Load and sample data
    df = load_and_sample_csv(CSV_PATH, NUM_SAMPLES, RANDOM_SEED)

    # Initialize EvalBoard client
    client = EvalBoardClient(base_url=BASE_URL)
    dataset = DatasetDescriptor(name=DATASET_NAME)

    # Delete existing models first to ensure clean state
    print("\nDeleting existing models...")
    for model_name, _, _ in MODELS:
        result = client.delete_model_by_name(model_name)
        if result:
            deleted_artifacts = result.get("deletedArtifacts", 0)
            print(f"  Deleted model '{model_name}' ({deleted_artifacts} artifacts removed)")
        else:
            print(f"  Model '{model_name}' not found, skipping deletion")

    # Ingest each model (input and output images)
    for model_name, bucket_col, key_col in MODELS:
        print(f"\nProcessing model '{model_name}'...")

        images = create_image_specs(s3, df, model_name, bucket_col, key_col)
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
