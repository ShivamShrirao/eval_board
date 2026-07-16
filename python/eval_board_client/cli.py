from __future__ import annotations

import json
from pathlib import Path
from typing import List, Optional, Tuple

import typer
from rich.console import Console
from rich.table import Table

from .client import BenchmarkDescriptor, EvalBoardClient, ImageSpec, ModelDescriptor
from .s3_manifest import S3ManifestBuilder

console = Console()
app = typer.Typer(help="Eval Board ingestion CLI")


def _load_manifest(path: Path) -> Tuple[List[ImageSpec], str]:
    data = json.loads(path.read_text())
    images = data.get("images", [])
    default_type = data.get("model", {}).get("type") or data.get("model_type") or "image"
    if default_type not in {"image", "text"}:
        raise ValueError(f"Manifest has invalid model type {default_type!r}")
    specs: List[ImageSpec] = []
    for idx, item in enumerate(images, start=1):
        source = item.get("source_url") or item.get("sourceUrl")
        item_type = item.get("type") or default_type
        content = item.get("content") or item.get("text")
        if item_type not in {"image", "text"}:
            raise ValueError(f"Manifest entry {idx} has invalid type {item_type!r}")
        if item_type == "image" and not source:
            raise ValueError(f"Manifest entry {idx} missing 'source_url'")
        if item_type == "text" and not content:
            raise ValueError(f"Manifest entry {idx} missing 'content'")
        specs.append(
            ImageSpec(
                filename=item["filename"],
                source_url=source,
                type=item_type,
                content=content,
                prompt=item.get("prompt"),
                metadata=item.get("metadata") or {},
                width=item.get("width"),
                height=item.get("height"),
            )
        )
    return specs, default_type


@app.command()
def ingest(
    base_url: str = typer.Option(..., help="Eval Board base URL (e.g. http://localhost:8080)"),
    api_key: Optional[str] = typer.Option(None, help="API token for authenticated environments"),
    password: Optional[str] = typer.Option(
        None,
        envvar="EVAL_BOARD_PASSWORD",
        help="Site password (sent as x-eval-board-password). Defaults to EVAL_BOARD_PASSWORD env.",
    ),
    model: str = typer.Option(..., help="Model name to register"),
    model_type: Optional[str] = typer.Option(None, help="Artifact type for this model: image or text."),
    benchmark: Optional[str] = typer.Option(None, help="Benchmark name to register"),
    dataset: Optional[str] = typer.Option(
        None, help="Deprecated alias for --benchmark; kept for backward compatibility."
    ),
    manifest: Optional[Path] = typer.Option(None, exists=True, file_okay=True, dir_okay=False),
    image_prefix: Optional[List[str]] = typer.Option(
        None,
        help="S3 prefixes containing images (e.g. s3://bucket/path/). May be repeated.",
    ),
    metadata_prefix: Optional[str] = typer.Option(
        None, help="S3 prefix containing JSON metadata aligned with image filenames."
    ),
    public_base_url: Optional[str] = typer.Option(
        None,
        help="If provided, convert s3:// URIs to HTTPS by prefixing with this base URL (e.g. https://bucket.s3.amazonaws.com).",
    ),
    dry_run: bool = typer.Option(False, help="Print payload without sending to server"),
) -> None:
    if not manifest and not image_prefix:
        raise typer.BadParameter("Provide either --manifest or at least one --image-prefix.")
    if model_type is not None and model_type not in {"image", "text"}:
        raise typer.BadParameter("--model-type must be either 'image' or 'text'.")

    if benchmark is None:
        if dataset is None:
            raise typer.BadParameter("--benchmark is required.")
        console.print("[yellow]--dataset is deprecated; use --benchmark instead.[/]")
        benchmark = dataset

    images: List[ImageSpec] = []
    resolved_model_type = model_type or "image"

    if manifest:
        console.log(f"Loading manifest from [bold]{manifest}[/]")
        manifest_images, manifest_model_type = _load_manifest(manifest)
        images.extend(manifest_images)
        if model_type is None:
            resolved_model_type = manifest_model_type

    if resolved_model_type == "text" and image_prefix:
        raise typer.BadParameter("--image-prefix can only be used with image models.")

    if image_prefix:
        console.log("Scanning S3 prefixes...")
        builder = S3ManifestBuilder(public_base_url=public_base_url)
        images.extend(
            builder.build(
                image_prefixes=image_prefix,
                metadata_prefix=metadata_prefix,
            )
        )

    if not images:
        console.print("[red]No images discovered; aborting.[/]")
        raise typer.Exit(code=1)

    table = Table(title="Artifacts to ingest")
    table.add_column("Filename")
    table.add_column("Source URL / Content")
    table.add_column("Prompt", overflow="fold")
    for image in images[:10]:
        table.add_row(image.filename, image.source_url or image.content or "", image.prompt or "")
    if len(images) > 10:
        table.caption = f"Showing first 10 of {len(images)} images."
    console.print(table)

    with EvalBoardClient(base_url=base_url, api_key=api_key, password=password) as client:
        payload = client.ingest(
            model=ModelDescriptor(name=model, type=resolved_model_type),
            benchmark=BenchmarkDescriptor(name=benchmark),
            images=images,
            dry_run=dry_run,
        )
    if dry_run:
        console.print_json(data=payload)
    else:
        console.print("[green]Ingestion submitted successfully.[/]")
