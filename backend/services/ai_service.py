# services/ai_service.py
# FastEmbed ONNX embeddings (no PyTorch) + Gemini calls with Tenacity retry.

import json
import logging
from functools import lru_cache

import google.generativeai as genai
from tenacity import retry, stop_after_attempt, wait_exponential, retry_if_exception_type, before_sleep_log
from fastapi import HTTPException
from config import settings

logger = logging.getLogger(__name__)

genai.configure(api_key=settings.GEMINI_API_KEY)
gemini_model = genai.GenerativeModel(settings.GEMINI_MODEL)
logger.info("Gemini model loaded: %s", settings.GEMINI_MODEL)


@lru_cache(maxsize=1)
def _get_fastembed_embeddings():
    from langchain_community.embeddings.fastembed import FastEmbedEmbeddings
    logger.info("Initialising FastEmbed (BAAI/bge-small-en-v1.5) — first run downloads ~25MB...")
    emb = FastEmbedEmbeddings(model_name="BAAI/bge-small-en-v1.5", max_length=512)
    logger.info("FastEmbed ready.")
    return emb

def get_embedding_model():
    return _get_fastembed_embeddings()

def embed_texts(texts: list[str]) -> list[list[float]]:
    return _get_fastembed_embeddings().embed_documents(texts)

def embed_query(query: str) -> list[float]:
    return _get_fastembed_embeddings().embed_query(query)


@retry(retry=retry_if_exception_type(Exception), stop=stop_after_attempt(5),
       wait=wait_exponential(multiplier=2, min=4, max=32),
       before_sleep=before_sleep_log(logger, logging.WARNING), reraise=False)
def _call_gemini_with_retry(prompt: str) -> str:
    if settings.GEMINI_API_KEY == "MISSING_GEMINI_KEY":
        raise HTTPException(status_code=503, detail=(
            "GEMINI_API_KEY not configured. Set it in backend/.env. "
            "Free key at https://aistudio.google.com/app/apikey"))
    return gemini_model.generate_content(prompt).text

def call_gemini(prompt: str) -> str:
    try:
        return _call_gemini_with_retry(prompt)
    except HTTPException:
        raise
    except Exception as exc:
        logger.error("Gemini failed after all retries: %s", exc)
        raise HTTPException(status_code=429, detail=(
            f"AI rate-limited (15 RPM free tier). Wait 60s. "
            f"Model: {settings.GEMINI_MODEL}. Error: {type(exc).__name__}: {exc}"))

def build_rag_prompt(query: str, context_chunks: list[str]) -> str:
    ctx = "\n\n---\n\n".join(f"[Chunk {i+1}]\n{c}" for i, c in enumerate(context_chunks))
    return (
        "You are Vidya, a friendly AI tutor for students in India.\n"
        "Answer using ONLY the context below. Be clear and use simple language.\n"
        "If not in context say: \"I couldn't find that in your uploaded materials.\"\n\n"
        f"=== CONTEXT ===\n{ctx}\n\n=== QUESTION ===\n{query}\n\n=== YOUR ANSWER ==="
    )

def _build_quiz_prompt(num_questions: int, text: str) -> str:
    return (
        f"You are an expert educator. Generate exactly {num_questions} multiple-choice questions from the study material below.\n"
        "RULES: Each question must have exactly 4 options (A, B, C, D). Exactly one option is correct. Test understanding, not memorisation.\n"
        f"You MUST generate exactly {num_questions} questions — no more, no less.\n"
        "Return ONLY a valid JSON array — no markdown fences, no extra text.\n\n"
        'FORMAT: [{"question":"?","options":{"A":"...","B":"...","C":"...","D":"..."},'
        '"correct_answer":"A","explanation":"why A is correct"}]\n\n'
        "=== STUDY MATERIAL ===\n"
        + text[:12000]
        + "\n\n=== JSON QUIZ ==="
    )

def generate_quiz(document_text: str, num_questions: int = 5) -> list[dict]:
    raw = call_gemini(_build_quiz_prompt(num_questions, document_text))
    cleaned = raw.strip()
    if cleaned.startswith("```"):
        cleaned = cleaned.split("```")[1]
        if cleaned.startswith("json"): cleaned = cleaned[4:]
    cleaned = cleaned.strip()
    try:
        import re
        cleaned = re.sub(r',\s*([}\]])', r'\1', cleaned)
        questions = json.loads(cleaned)
        if not isinstance(questions, list) or not questions:
            raise ValueError("Not a list")
        return questions
    except (json.JSONDecodeError, ValueError) as exc:
        logger.error("Quiz parse failed: %s\nRaw: %s", exc, raw)
        raise HTTPException(status_code=502, detail="AI returned unexpected format. Try again.")
