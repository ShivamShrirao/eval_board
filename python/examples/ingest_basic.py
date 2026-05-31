from __future__ import annotations

import os
import json
from pathlib import Path
from typing import Any, Dict, Iterator, List

import boto3
from botocore.config import Config

from eval_board_client import DatasetDescriptor, EvalBoardClient, ImageSpec, ModelDescriptor
from requests import HTTPError


IMAGE_EXTENSIONS = {".jpg", ".jpeg", ".png", ".webp", ".gif", ".bmp", ".tif", ".tiff"}

# Configuration - modify these variables as needed
BASE_URL = "http://localhost:8080"
EVAL_BOARD_PASSWORD = "briaeval"
DATASET_NAME = "benchmark"
BATCH_SIZE = 1000
PROMPTS_DIR = "/home/ubuntu/custom_dataset/benchmark/bench_prompts"

# List of (model_name, s3_prefix) tuples
MODELS = [
    ("fibo_base", "s3://hot-data-foundations-useast1/shivam/eval/benchmark/fibo/"),
    ("fibo-cfg-distill", "s3://hot-data-foundations-useast1/shivam/eval/benchmark/fibo-cfg-distill/1024x1024/"),

    # ("fibo_base_512px", "s3://hot-data-foundations-useast1/shivam/eval/benchmark/fibo_base_512px/"),
    # ("fibo_base_4steps", "s3://hot-data-foundations-useast1/shivam/eval/benchmark/fibo_base_4steps/"),
    # ("fibo_base_512px_4steps", "s3://hot-data-foundations-useast1/shivam/eval/benchmark/fibo_base_512px_4steps/"),

    # ("dmd_infer_step1000", "s3://hot-data-foundations-useast1/shivam/eval/benchmark/dmd_infer_step1000/"),
    # ("dmd_infer_step2000", "s3://hot-data-foundations-useast1/shivam/eval/benchmark/dmd_infer_step2000/"),
    # ("dmd_infer_step2500", "s3://hot-data-foundations-useast1/shivam/eval/benchmark/dmd_infer_step2500/"),
    # ("dmd_infer_step3000", "s3://hot-data-foundations-useast1/shivam/eval/benchmark/dmd_infer_step3000/"),

    # ("dmd_infer_step1000_1024", "s3://hot-data-foundations-useast1/shivam/eval/benchmark/dmd_infer_step1000_1024/"),
    # ("dmd_infer_step2000_1024", "s3://hot-data-foundations-useast1/shivam/eval/benchmark/dmd_infer_step2000_1024/"),
    # ("dmd_infer_step2500_1024", "s3://hot-data-foundations-useast1/shivam/eval/benchmark/dmd_infer_step2500_1024/"),
    # ("dmd_infer_step3000_1024", "s3://hot-data-foundations-useast1/shivam/eval/benchmark/dmd_infer_step3000_1024/"),

    # ("dmd_infer_fs10_step1000", "s3://hot-data-foundations-useast1/shivam/eval/benchmark/dmd_infer_fs10_step1000/"),
    # ("dmd_infer_fs10_step2000", "s3://hot-data-foundations-useast1/shivam/eval/benchmark/dmd_infer_fs10_step2000/"),
    # ("dmd_infer_fs10_step2500", "s3://hot-data-foundations-useast1/shivam/eval/benchmark/dmd_infer_fs10_step2500/"),
    # ("dmd_infer_fs10_step3000", "s3://hot-data-foundations-useast1/shivam/eval/benchmark/dmd_infer_fs10_step3000/"),

    # ("dmd_infer_fs10_step1000_1024", "s3://hot-data-foundations-useast1/shivam/eval/benchmark/dmd_infer_fs10_step1000_1024/"),
    # ("dmd_infer_fs10_step2000_1024", "s3://hot-data-foundations-useast1/shivam/eval/benchmark/dmd_infer_fs10_step2000_1024/"),
    # ("dmd_infer_fs10_step2500_1024", "s3://hot-data-foundations-useast1/shivam/eval/benchmark/dmd_infer_fs10_step2500_1024/"),
    # ("dmd_infer_fs10_step3000_1024", "s3://hot-data-foundations-useast1/shivam/eval/benchmark/dmd_infer_fs10_step3000_1024/"),

    # ("dmd_infer_1024data_step1000_1024", "s3://hot-data-foundations-useast1/shivam/eval/benchmark/dmd_infer_1024data_step1000_1024/"),
    # ("dmd_infer_1024data_step2000_1024", "s3://hot-data-foundations-useast1/shivam/eval/benchmark/dmd_infer_1024data_step2000_1024/"),
    # ("dmd_infer_1024data_step3000_1024", "s3://hot-data-foundations-useast1/shivam/eval/benchmark/dmd_infer_1024data_step3000_1024/"),
    # ("dmd_infer_1024data_step4000_1024", "s3://hot-data-foundations-useast1/shivam/eval/benchmark/dmd_infer_1024data_step4000_1024/"),

    # ("dmd_infer_init3000_step1000_1024", "s3://hot-data-foundations-useast1/shivam/eval/benchmark/dmd_infer_init3000_step1000_1024/"),
    # ("dmd_infer_init3000_step2000_1024", "s3://hot-data-foundations-useast1/shivam/eval/benchmark/dmd_infer_init3000_step2000_1024/"),
    # ("dmd_infer_init3000_step3000_1024", "s3://hot-data-foundations-useast1/shivam/eval/benchmark/dmd_infer_init3000_step3000_1024/"),
    # ("dmd_infer_init3000_step4000_1024", "s3://hot-data-foundations-useast1/shivam/eval/benchmark/dmd_infer_init3000_step4000_1024/"),
    # ("dmd_infer_init3000_step5000_1024", "s3://hot-data-foundations-useast1/shivam/eval/benchmark/dmd_infer_init3000_step5000_1024/"),

    # ("dmd_infer_init3000_ema_step4000_1024", "s3://hot-data-foundations-useast1/shivam/eval/benchmark/dmd_infer_init3000_ema_step4000_1024/"),
    # ("dmd_infer_init3000_ema_step5000_1024", "s3://hot-data-foundations-useast1/shivam/eval/benchmark/dmd_infer_init3000_ema_step5000_1024/"),

    # ("dmd_infer_init3000_r128norm_step1000_1024", "s3://hot-data-foundations-useast1/shivam/eval/benchmark/dmd_infer_init3000_r128norm_step1000_1024/"),
    # ("dmd_infer_init3000_r128norm_ema_step1000_1024", "s3://hot-data-foundations-useast1/shivam/eval/benchmark/dmd_infer_init3000_r128norm_ema_step1000_1024/"),
    # ("dmd_infer_init3000_r128norm_step2000_1024", "s3://hot-data-foundations-useast1/shivam/eval/benchmark/dmd_infer_init3000_r128norm_step2000_1024/"),
    # ("dmd_infer_init3000_r128norm_ema_step2000_1024", "s3://hot-data-foundations-useast1/shivam/eval/benchmark/dmd_infer_init3000_r128norm_ema_step2000_1024/"),
    # ("dmd_infer_init3000_r128norm_step3000_1024", "s3://hot-data-foundations-useast1/shivam/eval/benchmark/dmd_infer_init3000_r128norm_step3000_1024/"),
    # ("dmd_infer_init3000_r128norm_ema_step3000_1024", "s3://hot-data-foundations-useast1/shivam/eval/benchmark/dmd_infer_init3000_r128norm_ema_step3000_1024/"),
    # ("dmd_infer_init3000_r128norm_step4000_1024", "s3://hot-data-foundations-useast1/shivam/eval/benchmark/dmd_infer_init3000_r128norm_step4000_1024/"),
    # ("dmd_infer_init3000_r128norm_ema_step4000_1024", "s3://hot-data-foundations-useast1/shivam/eval/benchmark/dmd_infer_init3000_r128norm_ema_step4000_1024/"),
    # ("dmd_infer_init3000_r128norm_step5000_1024", "s3://hot-data-foundations-useast1/shivam/eval/benchmark/dmd_infer_init3000_r128norm_step5000_1024/"),
    # ("dmd_infer_init3000_r128norm_ema_step5000_1024", "s3://hot-data-foundations-useast1/shivam/eval/benchmark/dmd_infer_init3000_r128norm_ema_step5000_1024/"),
    # ("dmd_infer_init3000_r128norm_step12000_1024", "s3://hot-data-foundations-useast1/shivam/eval/benchmark/dmd_infer_init3000_r128norm_step12000_1024/"),
    # ("dmd_infer_init3000_r128norm_ema_step12000_1024", "s3://hot-data-foundations-useast1/shivam/eval/benchmark/dmd_infer_init3000_r128norm_ema_step12000_1024/"),
    # ("dmd_infer_init3000_r128norm_step15000_1024", "s3://hot-data-foundations-useast1/shivam/eval/benchmark/dmd_infer_init3000_r128norm_step15000_1024/"),
    # ("dmd_infer_init3000_r128norm_ema_step15000_1024", "s3://hot-data-foundations-useast1/shivam/eval/benchmark/dmd_infer_init3000_r128norm_ema_step15000_1024/"),
    # ("dmd_infer_init3000_r128norm_ema_step15000_lora0p8_1024", "s3://hot-data-foundations-useast1/shivam/eval/benchmark/dmd_infer_init3000_r128norm_ema_step15000_lora0p8_1024/"),
    # ("dmd_infer_init3000_r128norm_ema_step5000_lora0p7_1024", "s3://hot-data-foundations-useast1/shivam/eval/benchmark/dmd_infer_init3000_r128norm_ema_step5000_lora0p7_1024/"),
    # ("dmd_infer_init3000_r128norm_ema_step5000_lora0p8_1024", "s3://hot-data-foundations-useast1/shivam/eval/benchmark/dmd_infer_init3000_r128norm_ema_step5000_lora0p8_1024/"),
    # ("dmd_infer_init3000_r128norm_ema_step5000_lora0p9_1024", "s3://hot-data-foundations-useast1/shivam/eval/benchmark/dmd_infer_init3000_r128norm_ema_step5000_lora0p9_1024/"),
    # ("dmd_infer_fullft_step4000_1024", "s3://hot-data-foundations-useast1/shivam/eval/benchmark/dmd_infer_fullft_step4000_1024/"),
    

    # ("draft-realgen-hpsv3-300", "s3://hot-data-foundations-useast1/shivam/eval/benchmark/draft-realgen-hpsv3/ckpt_000300-lora-1.0-attn-mask/1024x1024/"),
    # ("draft-realgen-hpsv3-500", "s3://hot-data-foundations-useast1/shivam/eval/benchmark/draft-realgen-hpsv3/ckpt_000500-lora-1.0-attn-mask/1024x1024/"),
    # ("draft-realgen-hpsv3-700", "s3://hot-data-foundations-useast1/shivam/eval/benchmark/draft-realgen-hpsv3/ckpt_000700-lora-1.0-attn-mask/1024x1024/"),
    # ("draft-realgen-hpsv3-1000", "s3://hot-data-foundations-useast1/shivam/eval/benchmark/draft-realgen-hpsv3/ckpt_001000-lora-1.0-attn-mask/1024x1024/"),

    # ("draft-dreamsim-hpsv3-300", "s3://hot-data-foundations-useast1/shivam/eval/benchmark/draft-dreamsim-hpsv3/ckpt_000300-lora-1.0/1024x1024/"),
    # ("draft-dreamsim-hpsv3-500", "s3://hot-data-foundations-useast1/shivam/eval/benchmark/draft-dreamsim-hpsv3/ckpt_000500-lora-1.0/1024x1024/"),
    # ("draft-dreamsim-hpsv3-700-attn-mask", "s3://hot-data-foundations-useast1/shivam/eval/benchmark/draft-dreamsim-hpsv3/ckpt_000700-lora-1.0-attn-mask/1024x1024/"),
]


def load_prompt(filename: str) -> tuple[str | None, Dict[str, Any]]:
    prompt_path = Path(PROMPTS_DIR) / f"{Path(filename).stem}.json"
    if not prompt_path.is_file():
        return None, {}

    with prompt_path.open() as f:
        prompt_json = json.load(f)

    prompt = json.dumps(prompt_json, ensure_ascii=False)
    return prompt, {"prompt_file": str(prompt_path)}


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
        source_uri = f"s3://{bucket}/{obj['key']}"
        filename = obj["filename"]
        if "_checkpoint" in model_name:
            base, ext = os.path.splitext(filename)
            filename = str(int(base)-1) + ext
        prompt, prompt_metadata = load_prompt(filename)
        metadata = {
            "model": model_name,
            "s3_key": obj["key"],
            "s3_bucket": bucket,
            **prompt_metadata,
        }
        images.append(
            ImageSpec(
                filename=filename,
                source_url=source_uri,
                prompt=prompt,
                metadata=metadata,
            )
        )
    return images


def main() -> None:
    s3 = boto3.client("s3", config=Config(signature_version="s3v4"))
    dataset = DatasetDescriptor(name=DATASET_NAME)
    client = EvalBoardClient(base_url=BASE_URL, password=EVAL_BOARD_PASSWORD)
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
