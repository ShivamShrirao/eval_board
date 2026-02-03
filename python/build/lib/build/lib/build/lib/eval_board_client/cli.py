from __future__ import annotations

import json
from pathlib import Path
from typing import List, Optional

import typer
from rich.console import Console
from rich.table import Table

from .client import DatasetDescriptor, EvalBoardClient, ImageSpec, ModelDescriptor
from .s3_manifest import S3ManifestBuilder

console = Console()
app = typer.Typer(help="Eval Board ingestion CLI")


def _load_manifest(path: Path) -> List[ImageSpec]:
    data = json.loads(path.read_text())
    images = data.get("images", [])
    specs: List[ImageSpec] = []
    for idx, item in enumerate(images, start=1):
        source = item.get("source_url") or item.get("sourceUrl")
        if not source:
            raise ValueError(f"Manifest entry {idx} missing 'source_url'")
        specs.append(
            ImageSpec(
                filename=item["filename"],
                source_url=source,
                prompt=item.get("prompt"),
                metadata=item.get("metadata") or {},
                width=item.get("width"),
                height=item.get("height"),
            )
        )
    return specs


@app.command()
def ingest(
    base_url: str = typer.Option(..., help="Eval Board base URL (e.g. http://localhost:3000)"),
    api_key: Optional[str] = typer.Option(None, help="API token for authenticated environments"),
    model: str = typer.Option(..., help="Model name to register"),
    dataset: str = typer.Option(..., help="Dataset name to register"),
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

    images: List[ImageSpec] = []

    if manifest:
        console.log(f"Loading manifest from [bold]{manifest}[/]")
        images.extend(_load_manifest(manifest))

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

    table = Table(title="Images to ingest")
    table.add_column("Filename")
    table.add_column("Source URL")
    table.add_column("Prompt", overflow="fold")
    for image in images[:10]:
        table.add_row(image.filename, image.source_url, image.prompt or "")
    if len(images) > 10:
        table.caption = f"Showing first 10 of {len(images)} images."
    console.print(table)

    with EvalBoardClient(base_url=base_url, api_key=api_key) as client:
        payload = client.ingest(
            model=ModelDescriptor(name=model),
            dataset=DatasetDescriptor(name=dataset),
            images=images,
            dry_run=dry_run,
        )
    if dry_run:
        console.print_json(data=payload)
    else:
        console.print("[green]Ingestion submitted successfully.[/]")
