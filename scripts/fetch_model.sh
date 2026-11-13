#!/usr/bin/env bash
#
# Fetch the fine-tuned BERT model into outputs/models/imdb_bert/.
#
# The model (~419 MB) is tracked with Git LFS. GitHub's free tier allows
# 1 GB of LFS bandwidth per month, so a clone can fail to fetch it. This
# script falls back to the GitHub Release mirror of the exact same file.
#
# Usage:
#   ./scripts/fetch_model.sh
#
set -euo pipefail

REPO="ACADEMIC-AND-PERSONAL-PROJECTS/IMDb-SENTIMENT-ANALYSIS"
RELEASE="v1.0.0"
ASSET_URL="https://github.com/${REPO}/releases/download/${RELEASE}/model.safetensors"
EXPECTED_SHA256="54f7e97085075513ace22dcf0c576302e83816e429236eed46a2b3cae22d4553"
MIN_SIZE_BYTES=$((400 * 1024 * 1024))

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
TARGET_DIR="${REPO_ROOT}/outputs/models/imdb_bert"
TARGET="${TARGET_DIR}/model.safetensors"

log() { printf '[fetch_model] %s\n' "$1"; }

# Size in bytes, portable between GNU coreutils (-c) and BSD/macOS (-f).
# Returns 0 when the file is missing or unreadable.
file_size() {
    stat -c%s "$1" 2>/dev/null || stat -f%z "$1" 2>/dev/null || echo 0
}

# --- 1. Already present as a real file? -------------------------------
if [[ -f "${TARGET}" ]]; then
    size=$(file_size "${TARGET}")
    if [[ "${size}" -ge "${MIN_SIZE_BYTES}" ]]; then
        log "model already present (${size} bytes) — nothing to do."
        exit 0
    fi
    if head -c 64 "${TARGET}" | grep -q "git-lfs.github.com/spec"; then
        log "Found an unresolved LFS pointer, fetching the real file..."
    else
        log "Found a truncated model file (${size} bytes), re-fetching..."
    fi
    rm -f "${TARGET}"
fi

# --- 2. Try Git LFS first (keeps the git object store consistent) ----
if command -v git >/dev/null 2>&1 && git lfs version >/dev/null 2>&1; then
    log "Trying git lfs pull..."
    if git -C "${REPO_ROOT}" lfs pull --include="outputs/models/imdb_bert/model.safetensors" 2>/dev/null; then
        size=$(file_size "${TARGET}")
        if [[ "${size}" -ge "${MIN_SIZE_BYTES}" ]]; then
            log "Model fetched via Git LFS."
            exit 0
        fi
        log "LFS pull did not materialise the file, falling back to the Release."
        rm -f "${TARGET}"
    else
        log "git lfs pull failed (quota or network), falling back to the Release."
    fi
fi

# --- 3. Fall back to the GitHub Release mirror ------------------------
log "Downloading from the GitHub Release mirror..."
mkdir -p "${TARGET_DIR}"

TMP="${TARGET}.part"
rm -f "${TMP}"

if command -v curl >/dev/null 2>&1; then
    curl -fL --retry 3 --retry-delay 2 --silent --show-error -o "${TMP}" "${ASSET_URL}"
elif command -v wget >/dev/null 2>&1; then
    wget -q --show-progress -O "${TMP}" "${ASSET_URL}"
else
    log "ERROR: neither curl nor wget is available."
    exit 1
fi

# --- 4. Verify integrity ---------------------------------------------
size=$(file_size "${TMP}")
if [[ "${size}" -lt "${MIN_SIZE_BYTES}" ]]; then
    log "ERROR: downloaded file is too small (${size} bytes)."
    rm -f "${TMP}"
    exit 1
fi

if command -v sha256sum >/dev/null 2>&1; then
    actual=$(sha256sum "${TMP}" | awk '{print $1}')
elif command -v shasum >/dev/null 2>&1; then
    actual=$(shasum -a 256 "${TMP}" | awk '{print $1}')
else
    actual=""
fi

if [[ -n "${actual}" && "${actual}" != "${EXPECTED_SHA256}" ]]; then
    log "ERROR: SHA-256 mismatch."
    log "  expected: ${EXPECTED_SHA256}"
    log "  actual:   ${actual}"
    rm -f "${TMP}"
    exit 1
fi

mv "${TMP}" "${TARGET}"
log "Model installed at ${TARGET} (sha256 ${EXPECTED_SHA256})."
log "You can now run: docker compose up --build"
