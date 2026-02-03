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
DATASET_NAME = "refiner"
BATCH_SIZE = 1000

# List of (model_name, s3_prefix) tuples
MODELS = [
    ("fibo_base", "s3://hot-data-foundations-useast1/shivam/eval/benchmark/fibo/"),
    ("fibo-cfg-distill", "s3://hot-data-foundations-useast1/shivam/eval/benchmark/fibo-cfg-distill/1024x1024/"),
    
    ("fibo-edit-refiner-bench-step2500-gs1.0", "s3://hot-data-foundations-useast1/shivam/eval/refiner/fibo-edit-refiner-bench-step2500-gs1.0/"),
    ("fibo-edit-refiner-bench-step2500-gs2.0", "s3://hot-data-foundations-useast1/shivam/eval/refiner/fibo-edit-refiner-bench-step2500-gs2.0/"),
    ("fibo-edit-refiner-bench-step3750-gs1.0", "s3://hot-data-foundations-useast1/shivam/eval/refiner/fibo-edit-refiner-bench-step3750-gs1.0/"),
    ("fibo-edit-refiner-bench-step4250-gs1.0", "s3://hot-data-foundations-useast1/shivam/eval/refiner/fibo-edit-refiner-bench-step4250-gs1.0/"),
    ("fibo-edit-refiner-bench-step5000-gs1.0-infer10", "s3://hot-data-foundations-useast1/shivam/eval/refiner/fibo-edit-refiner-bench-step5000-gs1.0-infer10/"),
    ("fibo-edit-refiner-bench-distill-step1500-gs1.0-infer10", "s3://hot-data-foundations-useast1/shivam/eval/refiner/fibo-edit-refiner-bench-distill-step1500-gs1.0-infer10/"),

    ("fibo-edit-refiner-bench-0.3-noise-step4500-gs1.0-infer10", "s3://hot-data-foundations-useast1/shivam/eval/refiner/fibo-edit-refiner-bench-0.3-noise-step4500-gs1.0-infer10/"),

    ("fibo-refiner-quadrants-step5000-gs1.0-infer10", "s3://hot-data-foundations-useast1/shivam/eval/refiner/fibo-edit-refiner-bench-quadrants-step5000-gs1.0-infer10/"),
    ("fibo-refiner-quadrants-seed200050-step5000-gs1.0-infer10", "s3://hot-data-foundations-useast1/shivam/eval/refiner/fibo-edit-refiner-bench-quadrants-seed200050-step5000-gs1.0-infer10/"),
    ("fibo-refiner-quadrants-step5000-gs1.0-infer10-tiled", "s3://hot-data-foundations-useast1/shivam/eval/refiner/fibo-edit-refiner-bench-quadrants-step5000-gs1.0-infer10-tiled/"),
    ("fibo-refiner-quadrants-step5000-gs1.0-infer5-distill", "s3://hot-data-foundations-useast1/shivam/eval/refiner/fibo-edit-refiner-bench-quadrants-step5000-gs1.0-infer5-distill/"),
    ("fibo-refiner-quadrants-step5000-gs1.0-infer5-tiled-distill", "s3://hot-data-foundations-useast1/shivam/eval/refiner/fibo-edit-refiner-bench-quadrants-step5000-gs1.0-infer5-tiled-distill/"),

    ("refine-distilled-bench-quadrants-step4000-gs1.0-infer10", "s3://hot-data-foundations-useast1/shivam/eval/refiner/refine-distilled-bench-quadrants-step4000-gs1.0-infer10/"),
    ("refine-distilled-bench-quadrants-step5000-gs1.0-infer10", "s3://hot-data-foundations-useast1/shivam/eval/refiner/refine-distilled-bench-quadrants-step5000-gs1.0-infer10/"),
    ("refine-distilled-bench-quadrants-step4000-gs1.0-infer10-tiled", "s3://hot-data-foundations-useast1/shivam/eval/refiner/refine-distilled-bench-quadrants-step4000-gs1.0-infer10-tiled/"),
    ("refine-distilled-bench-quadrants-step5000-gs1.0-infer10-tiled", "s3://hot-data-foundations-useast1/shivam/eval/refiner/refine-distilled-bench-quadrants-step5000-gs1.0-infer10-tiled/"),

    # ("upscale_comfyui_dbr_stage1", "s3://hot-data-foundations-useast1/shivam/eval/benchmark/fibo_upscaled_comfyui_dbr_stage1/"),
    ("upscale_comfyui_dbr_stage2", "s3://hot-data-foundations-useast1/shivam/eval/benchmark/fibo_upscaled_comfyui_dbr_stage2/"),

    # ("03interpolation_checkpoint1000", "s3://hot-data-foundations-useast1/eliran/upscaler/shivam_comparison/03interpolation_checkpoint1000/"),
    # ("04noise_checkpoint750", "s3://hot-data-foundations-useast1/eliran/upscaler/shivam_comparison/04noise_checkpoint750/"),
    # ("04noise_old_checkpoint750", "s3://hot-data-foundations-useast1/eliran/upscaler/shivam_comparison/04noise_old_checkpoint750/"),
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
        if "_checkpoint" in model_name:
            base, ext = os.path.splitext(obj["filename"])
            obj["filename"] = str(int(base)-1) + ext
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
        
        # Batch the images into chunks of BATCH_SIZE
        total_images = len(images)
        num_batches = (total_images + BATCH_SIZE - 1) // BATCH_SIZE
        print(
            f"Preparing to ingest {total_images} images in {num_batches} batch(es) for model={model_descriptor.name}, dataset={dataset.name}"
        )

        for batch_idx in range(num_batches):
            start_idx = batch_idx * BATCH_SIZE
            end_idx = min(start_idx + BATCH_SIZE, total_images)
            batch_images = images[start_idx:end_idx]
            
            print(f"  Batch {batch_idx + 1}/{num_batches}: ingesting images {start_idx + 1}-{end_idx}...")
            
            try:
                payload = client.ingest(
                    model=model_descriptor,
                    dataset=dataset,
                    images=batch_images,
                    dry_run=False,
                )
                print(f"  Batch {batch_idx + 1}/{num_batches} submitted successfully.")
            except HTTPError as exc:
                print(f"  Batch {batch_idx + 1}/{num_batches} failed for model '{model_name}': {exc.response.status_code} {exc.response.text}")
            except Exception as exc:
                print(f"  Batch {batch_idx + 1}/{num_batches} unexpected error for model '{model_name}': {exc}")

    print("Done.")


if __name__ == "__main__":
    main()
