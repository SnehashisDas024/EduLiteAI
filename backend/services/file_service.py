# services/file_service.py — PyMuPDF + RecursiveCharacterTextSplitter

import logging
import httpx
from config import settings

logger = logging.getLogger(__name__)

async def compress_file(file_bytes: bytes, filename: str) -> tuple[bytes, int]:
    if settings.SCALEDOWN_API_KEY:
        return await _compress_via_scaledown(file_bytes, filename)
    return file_bytes, len(file_bytes)

async def _compress_via_scaledown(file_bytes: bytes, filename: str) -> tuple[bytes, int]:
    try:
        async with httpx.AsyncClient(timeout=60.0) as client:
            r = await client.post(settings.SCALEDOWN_API_URL,
                files={"file": (filename, file_bytes, "application/octet-stream")},
                headers={"Authorization": f"Bearer {settings.SCALEDOWN_API_KEY}"})
            r.raise_for_status()
            return r.content, len(r.content)
    except (httpx.HTTPStatusError, httpx.RequestError) as e:
        logger.warning("ScaleDown fallback: %s", e)
        return file_bytes, len(file_bytes)

def extract_text(file_bytes: bytes, filename: str) -> str:
    if filename.lower().endswith(".pdf"):
        return _extract_pdf_pymupdf(file_bytes)
    try:
        return file_bytes.decode("utf-8")
    except UnicodeDecodeError:
        return file_bytes.decode("latin-1", errors="replace")

def _extract_pdf_pymupdf(file_bytes: bytes) -> str:
    try:
        import fitz
        doc = fitz.open(stream=file_bytes, filetype="pdf")
        pages = [f"[Page {i+1}]\n{doc.load_page(i).get_text('text').strip()}"
                 for i in range(len(doc)) if doc.load_page(i).get_text("text").strip()]
        doc.close()
        full = "\n\n".join(pages)
        if not full.strip():
            logger.warning("PyMuPDF: no text — may be image-based PDF.")
        return full
    except Exception as exc:
        logger.error("PyMuPDF failed: %s", exc)
        return ""

def chunk_text(text: str, chunk_size: int = 750, chunk_overlap: int = 100) -> list[str]:
    if not text.strip():
        return []
    from langchain.text_splitter import RecursiveCharacterTextSplitter
    splitter = RecursiveCharacterTextSplitter(
        chunk_size=chunk_size, chunk_overlap=chunk_overlap,
        separators=["\n\n", "\n", ". ", " ", ""], length_function=len)
    return [c.strip() for c in splitter.split_text(text) if c.strip()]
