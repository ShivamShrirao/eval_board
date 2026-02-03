from __future__ import annotations

import os
import random
import boto3
from typing import Dict, Iterator, List, Tuple
from botocore.config import Config
from eval_board_client import DatasetDescriptor, EvalBoardClient, ImageSpec, ModelDescriptor
from requests import HTTPError

IMAGE_EXTENSIONS = {".jpg", ".jpeg", ".png", ".webp", ".gif", ".bmp", ".tif", ".tiff"}

# Configuration
BASE_URL = "http://localhost:3000"
DATASET_NAME = "100k_upscale"
BATCH_SIZE = 1000  # Kept from example, though total images is small (540)
SAMPLES_PER_RESOLUTION = 10

# S3 Configuration
BUCKET_NAME = "eiga-synthetic-raw-data"

# Model definitions and their S3 prefixes
# Format: (model_name, s3_prefix)
MODELS = [
    ("fibo_base", "s3://eiga-synthetic-raw-data/images/fibo_100k/"),
    # ("upscale_comfyui_dbr_stage1", "s3://eiga-synthetic-raw-data/images/fibo_100k_upscale_stage1/"),
    ("upscale_comfyui_dbr_stage2", "s3://eiga-synthetic-raw-data/images/fibo_100k_upscale_stage2/"),
]

# Structure definitions
TYPES = [
    "base",
    "distilled-cfg",
    "distilled-teacache",
    "distilled-tg",
]

RESOLUTIONS = [
    "1024x1024",
    "1088x960",
    "1152x896",
    "1216x832",
    "1280x800",
    "1344x768",
    "832x1248",
    "896x1152",
    "960x1088",
]

# The reference prefix to sample from (stage2 has the least images)
REFERENCE_PREFIX = "s3://eiga-synthetic-raw-data/images/fibo_100k_upscale_stage2/"

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

def list_images_in_dir(s3, bucket: str, prefix: str) -> List[Dict[str, str]]:
    """List valid images directly under a prefix (non-recursive for sampling logic)."""
    paginator = s3.get_paginator("list_objects_v2")
    images = []
    for page in paginator.paginate(Bucket=bucket, Prefix=prefix):
        for obj in page.get("Contents", []):
            key = obj["Key"]
            if key.endswith("/"):
                continue
            _, ext = os.path.splitext(key)
            if ext.lower() not in IMAGE_EXTENSIONS:
                continue
            images.append({"key": key, "filename": os.path.basename(key)})
    return images

def get_sampled_relative_paths(s3) -> List[str]:
    """
    Traverse the reference directory structure and sample images.
    Returns a list of relative paths (e.g. 'base/1024x1024/image.png').
    """
    ref_bucket, ref_base_prefix = parse_s3_uri(REFERENCE_PREFIX)
    sampled_paths = []
    
    print(f"Sampling images from reference: {REFERENCE_PREFIX}")
    
    for type_dir in TYPES:
        for res_dir in RESOLUTIONS:
            # Construct the specific prefix for this type and resolution
            # Note: ref_base_prefix ends with '/'
            # type_dir and res_dir do not start/end with '/' in list, so we add slashes
            current_prefix = f"{ref_base_prefix}{type_dir}/{res_dir}/"
            
            print(f"  Scanning {type_dir}/{res_dir}...")
            candidates = list_images_in_dir(s3, ref_bucket, current_prefix)
            
            if not candidates:
                print(f"    Warning: No images found in {current_prefix}")
                continue
                
            # Sample images
            num_to_sample = min(len(candidates), SAMPLES_PER_RESOLUTION)
            sampled = random.sample(candidates, num_to_sample)
            
            for item in sampled:
                # Extract relative path from the full key
                # Full key: images/fibo_100k_upscale_stage2/base/1024x1024/img.png
                # Base prefix: images/fibo_100k_upscale_stage2/
                # Relative: base/1024x1024/img.png
                full_key = item["key"]
                if full_key.startswith(ref_base_prefix):
                    rel_path = full_key[len(ref_base_prefix):]
                    sampled_paths.append(rel_path)
                else:
                    print(f"    Warning: Key {full_key} does not start with expected prefix {ref_base_prefix}")
    
    print(f"Total sampled images: {len(sampled_paths)}")
    return sampled_paths

def generate_image_specs(s3, model_name: str, base_uri: str, relative_paths: List[str]) -> List[ImageSpec]:
    bucket, base_prefix = parse_s3_uri(base_uri)
    specs = []
    
    for rel_path in relative_paths:
        final_rel_path = rel_path
        if model_name == "fibo_base":
             base, ext = os.path.splitext(rel_path)
             if ext.lower() == ".png":
                 final_rel_path = base + ".jpg"

        full_key = f"{base_prefix}{final_rel_path}"
        filename = os.path.basename(full_key)
        
        # Generate signed URL
        signed_url = s3.generate_presigned_url(
            'get_object',
            Params={
                'Bucket': bucket,
                'Key': full_key
            },
            ExpiresIn=604800  # 7 days
        )
        
        specs.append(
            ImageSpec(
                filename=filename,
                source_url=signed_url,
                metadata={
                    "model": model_name,
                    "s3_key": full_key,
                    "s3_bucket": bucket,
                    "relative_path": final_rel_path
                },
            )
        )
    return specs

def main() -> None:
    # Set seed for deterministic sampling
    random.seed(42)

    s3 = boto3.client("s3", config=Config(signature_version="s3v4"))
    dataset = DatasetDescriptor(name=DATASET_NAME)
    client = EvalBoardClient(base_url=BASE_URL)
    
    # Step 1: Discover and sample paths from the reference directory (stage2)
    sampled_relative_paths = get_sampled_relative_paths(s3)
    
    if not sampled_relative_paths:
        print("No images found to sample. Exiting.")
        return

    # Step 2: Ingest for each model using the sampled paths
    for model_name, s3_prefix in MODELS:
        print(f"Preparing ingestion for model '{model_name}' using prefix {s3_prefix}...")
        
        images = generate_image_specs(s3, model_name, s3_prefix, sampled_relative_paths)
        model_descriptor = ModelDescriptor(name=model_name)
        
        total_images = len(images)
        num_batches = (total_images + BATCH_SIZE - 1) // BATCH_SIZE
        print(
            f"  Ingesting {total_images} images in {num_batches} batch(es) for model={model_descriptor.name}"
        )

        for batch_idx in range(num_batches):
            start_idx = batch_idx * BATCH_SIZE
            end_idx = min(start_idx + BATCH_SIZE, total_images)
            batch_images = images[start_idx:end_idx]
            
            print(f"    Batch {batch_idx + 1}/{num_batches}: ingesting images {start_idx + 1}-{end_idx}...")
            
            try:
                client.ingest(
                    model=model_descriptor,
                    dataset=dataset,
                    images=batch_images,
                    dry_run=False,
                )
                print(f"    Batch {batch_idx + 1}/{num_batches} submitted successfully.")
            except HTTPError as exc:
                print(f"    Batch {batch_idx + 1}/{num_batches} failed for model '{model_name}': {exc.response.status_code} {exc.response.text}")
            except Exception as exc:
                print(f"    Batch {batch_idx + 1}/{num_batches} unexpected error for model '{model_name}': {exc}")

    print("Done.")

if __name__ == "__main__":
    main()

