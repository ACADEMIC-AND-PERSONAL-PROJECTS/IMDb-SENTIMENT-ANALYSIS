"""Ensure a usable model.safetensors is present in the image.

The fine-tuned model is tracked with Git LFS. When the repository is cloned
without LFS (or when LFS bandwidth is exhausted), ``model.safetensors`` is
only a ~134-byte pointer file and the model cannot be loaded. This script
downloads the real weights from the GitHub Release mirror in that case.
"""

from __future__ import annotations

import hashlib
import os
import pathlib
import sys
import urllib.request

MODEL_URL = os.environ.get(
    "MODEL_RELEASE_URL",
    "https://github.com/ACADEMIC-AND-PERSONAL-PROJECTS/"
    "IMDb-SENTIMENT-ANALYSIS/releases/download/v1.0.0/model.safetensors",
)
EXPECTED_SHA256 = "54f7e97085075513ace22dcf0c576302e83816e429236eed46a2b3cae22d4553"
MIN_SIZE_BYTES = 400 * 1024 * 1024
CHUNK_SIZE = 1024 * 1024

TARGET = pathlib.Path("/app/models/imdb_bert/model.safetensors")
USER_AGENT = "cinescope-backend-build"


def sha256_of(path: pathlib.Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(CHUNK_SIZE), b""):
            digest.update(chunk)
    return digest.hexdigest()


def is_usable(path: pathlib.Path) -> bool:
    return path.is_file() and path.stat().st_size >= MIN_SIZE_BYTES


def download(destination: pathlib.Path) -> None:
    request = urllib.request.Request(MODEL_URL, headers={"User-Agent": USER_AGENT})
    temporary = destination.with_suffix(destination.suffix + ".part")
    with urllib.request.urlopen(request) as response, temporary.open("wb") as out:
        while True:
            chunk = response.read(CHUNK_SIZE)
            if not chunk:
                break
            out.write(chunk)

    if not is_usable(temporary):
        temporary.unlink(missing_ok=True)
        raise RuntimeError("Downloaded model file is too small to be valid.")

    actual = sha256_of(temporary)
    if actual != EXPECTED_SHA256:
        temporary.unlink(missing_ok=True)
        raise RuntimeError(
            f"SHA-256 mismatch for downloaded model.\n"
            f"  expected: {EXPECTED_SHA256}\n  actual:   {actual}"
        )

    temporary.replace(destination)


def main() -> int:
    if is_usable(TARGET):
        print(f"model.safetensors already present ({TARGET.stat().st_size} bytes).")
        return 0

    if TARGET.exists():
        print(
            f"model.safetensors is only {TARGET.stat().st_size} bytes "
            "(unresolved Git LFS pointer?)."
        )

    print(f"Downloading model from {MODEL_URL}")
    download(TARGET)
    print(f"Model ready ({TARGET.stat().st_size} bytes).")
    return 0


if __name__ == "__main__":
    try:
        sys.exit(main())
    except Exception as exc:  # noqa: BLE001 - surface a clear build failure
        print(f"ERROR: {exc}", file=sys.stderr)
        sys.exit(1)
