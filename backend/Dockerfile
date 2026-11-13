# syntax=docker/dockerfile:1

FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1 \
    HF_HUB_OFFLINE=1 \
    TRANSFORMERS_OFFLINE=1 \
    TOKENIZERS_PARALLELISM=false \
    MODEL_PATH=/app/models/imdb_bert

WORKDIR /app

# libgomp is required by the CPU build of PyTorch.
RUN apt-get update \
    && apt-get install -y --no-install-recommends libgomp1 \
    && rm -rf /var/lib/apt/lists/*

COPY backend/requirements.txt ./requirements.txt

# CPU wheel: much smaller than the default PyPI build and enough for BERT inference.
RUN pip install --no-cache-dir --index-url https://download.pytorch.org/whl/cpu torch==2.6.0+cpu \
    && pip install --no-cache-dir -r requirements.txt

RUN useradd --create-home --uid 1000 appuser

COPY --chown=appuser:appuser app ./app
COPY --chown=appuser:appuser outputs/models/imdb_bert ./models/imdb_bert

USER appuser

EXPOSE 8088

HEALTHCHECK --interval=30s --timeout=5s --start-period=150s --retries=3 \
    CMD python -c "import urllib.request; urllib.request.urlopen('http://127.0.0.1:8088/health', timeout=4)"

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8088", "--workers", "1"]
