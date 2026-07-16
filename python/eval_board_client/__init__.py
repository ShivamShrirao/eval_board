from .client import (
    BenchmarkDescriptor,
    DatasetDescriptor,
    EvalBoardClient,
    ImageSpec,
    ModelDescriptor,
)

__all__ = [
    "EvalBoardClient",
    "ImageSpec",
    "ModelDescriptor",
    "BenchmarkDescriptor",
    # Deprecated alias, retained for backward compatibility.
    "DatasetDescriptor",
]
