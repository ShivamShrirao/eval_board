# Eval Board Client (Python)

Installable SDK + CLI for registering generated images with the Eval Board dashboard.

## Installation
```bash
uv pip install ./python
# or
pip install ./python
```

## Quick Start
```python
from eval_board_client import EvalBoardClient, ImageSpec

client = EvalBoardClient(base_url="http://localhost:3000", api_key="dev-token")

images = [
    ImageSpec(
        filename="sample.png",
        source_url="s3://bucket/run123/sample.png",
        prompt="a cat reading a book",
        metadata={"guidance_scale": 7.5, "steps": 30},
        width=1024,
        height=1024,
    )
]

client.ingest(
    model={"name": "stable-diffusion-v4"},
    dataset={"name": "coco-validation"},
    images=images,
)
```

## CLI
```bash
eval-board ingest \
  --base-url http://localhost:3000 \
  --model "stable-diffusion-v4" \
  --dataset "coco-validation" \
  --manifest ./samples/manifest.json
```

`manifest.json` structure:
```json
{
  "images": [
    {
      "filename": "sample.png",
      "source_url": "s3://bucket/run123/sample.png",
      "prompt": "a cat reading a book",
      "width": 1024,
      "height": 1024,
      "metadata": {
        "guidance_scale": 7.5
      }
    }
  ]
}
```

## Example Script
- `python/examples/ingest_basic.py` demonstrates SDK usage with `ImageSpec`, dry-run payload preview, and metadata fields.
- Run it after installing the package locally: `python python/examples/ingest_basic.py`.

## S3 Helpers
- `eval_board_client.s3_manifest.S3ManifestBuilder` can crawl S3 prefixes, reuse JSON metadata, and emit `ImageSpec` objects.
- Mirrors naming conventions from `ref_script/s3_image_json_report.py`.

## Testing
```bash
uv pip install -e ./python[dev]
pytest
```

Tests are not yet implemented; add under `python/tests/`.
