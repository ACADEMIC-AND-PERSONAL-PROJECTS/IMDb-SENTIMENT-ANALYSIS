"""IMDb sentiment analysis API.

Loads a fine-tuned BERT model once at startup and exposes a small HTTP API.
The model path, sequence length and allowed CORS origins are configurable
through environment variables so the same code runs locally and in Docker.
"""

import logging
import os
import time
from contextlib import asynccontextmanager
from pathlib import Path
from typing import Literal

import torch
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from transformers import AutoModelForSequenceClassification, AutoTokenizer

# --------------------------------------------------------------------------- #
# Configuration
# --------------------------------------------------------------------------- #

PROJECT_ROOT = Path(__file__).resolve().parents[1]

MODEL_PATH = Path(
    os.getenv("MODEL_PATH", PROJECT_ROOT / "outputs" / "models" / "imdb_bert")
)
MAX_LENGTH = int(os.getenv("MAX_LENGTH", "256"))

CORS_ORIGINS = [
    origin.strip()
    for origin in os.getenv("CORS_ORIGINS", "*").split(",")
    if origin.strip()
]

IDX2LABEL = {0: "negative", 1: "positive"}

logging.basicConfig(
    level=os.getenv("LOG_LEVEL", "INFO"),
    format="%(asctime)s | %(levelname)s | %(name)s | %(message)s",
)
logger = logging.getLogger("imdb-sentiment")

# Populated during startup. Kept in a module-level dict so the inference
# helpers stay dependency-free and easy to test.
runtime: dict[str, object] = {}


# --------------------------------------------------------------------------- #
# Model lifecycle
# --------------------------------------------------------------------------- #

def load_model() -> None:
    """Load the tokenizer and classifier, then warm the model up once."""
    if not MODEL_PATH.exists():
        raise RuntimeError(f"Model directory not found: {MODEL_PATH}")

    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")

    logger.info("Loading tokenizer from %s", MODEL_PATH)
    tokenizer = AutoTokenizer.from_pretrained(str(MODEL_PATH))

    logger.info("Loading classifier from %s", MODEL_PATH)
    classifier = AutoModelForSequenceClassification.from_pretrained(str(MODEL_PATH))
    classifier.to(device)
    classifier.eval()

    runtime.update(
        {
            "tokenizer": tokenizer,
            "classifier": classifier,
            "device": device,
            "loaded_at": time.time(),
        }
    )

    # A first forward pass avoids paying the lazy-init cost on the first
    # real request (roughly one second on CPU with BERT-base).
    _predict("Warm-up review: a quiet, beautiful film.")
    logger.info("Model ready on %s", device)


@asynccontextmanager
async def lifespan(_: FastAPI):
    load_model()
    try:
        yield
    finally:
        runtime.clear()
        logger.info("Model released")


# --------------------------------------------------------------------------- #
# Schemas
# --------------------------------------------------------------------------- #

class PredictionRequest(BaseModel):
    text: str = Field(
        min_length=1,
        max_length=20_000,
        description="Movie review to analyze",
        json_schema_extra={
            "examples": ["This movie was absolutely fantastic! I loved every minute."]
        },
    )


class Probabilities(BaseModel):
    negative: float
    positive: float


class PredictionResponse(BaseModel):
    sentiment: Literal["positive", "negative"]
    confidence: float
    probabilities: Probabilities


# --------------------------------------------------------------------------- #
# Inference
# --------------------------------------------------------------------------- #

def _predict(text: str) -> dict:
    tokenizer = runtime["tokenizer"]
    classifier = runtime["classifier"]
    device = runtime["device"]

    inputs = tokenizer(
        text,
        return_tensors="pt",
        truncation=True,
        max_length=MAX_LENGTH,
    )
    inputs = {key: value.to(device) for key, value in inputs.items()}

    with torch.inference_mode():
        logits = classifier(**inputs).logits

    probabilities = torch.softmax(logits, dim=1)[0]
    predicted_class = int(torch.argmax(probabilities).item())

    return {
        "sentiment": IDX2LABEL[predicted_class],
        "confidence": float(probabilities[predicted_class].item()),
        "probabilities": {
            IDX2LABEL[index]: float(probabilities[index].item())
            for index in range(len(IDX2LABEL))
        },
    }


# --------------------------------------------------------------------------- #
# Application
# --------------------------------------------------------------------------- #

app = FastAPI(
    title="IMDb Sentiment Analysis API",
    description=(
        "Sentiment analysis of movie reviews using a BERT-base model "
        "fine-tuned on IMDb."
    ),
    version="1.1.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_credentials=False,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["*"],
)


@app.get("/", tags=["meta"])
def root() -> dict:
    return {
        "name": "IMDb Sentiment Analysis API",
        "version": app.version,
        "docs": "/docs",
        "endpoints": {
            "health": "/health",
            "predict": "POST /predict",
        },
    }


@app.get("/health", tags=["meta"])
def health_check() -> dict:
    classifier = runtime.get("classifier")
    loaded_at = runtime.get("loaded_at")

    return {
        "status": "healthy" if classifier is not None else "starting",
        "model_loaded": classifier is not None,
        "device": str(runtime.get("device", "unknown")),
        "model": MODEL_PATH.name,
        "max_length": MAX_LENGTH,
        "uptime_seconds": round(time.time() - loaded_at, 1) if loaded_at else 0,
    }


@app.post("/predict", response_model=PredictionResponse, tags=["inference"])
def predict(request: PredictionRequest) -> dict:
    text = request.text.strip()

    if not text:
        raise HTTPException(
            status_code=400,
            detail="Review text cannot be empty.",
        )

    started = time.perf_counter()
    try:
        result = _predict(text)
    except Exception as exc:  # pragma: no cover - defensive guard
        logger.exception("Inference failed")
        raise HTTPException(
            status_code=500,
            detail="The model could not process this review.",
        ) from exc

    elapsed_ms = (time.perf_counter() - started) * 1000
    logger.info(
        "predicted=%s confidence=%.4f chars=%d latency=%.0fms",
        result["sentiment"],
        result["confidence"],
        len(text),
        elapsed_ms,
    )
    return result
