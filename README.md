# PadhloAI 📚

AI-powered education platform for rural India. Upload your state-board textbooks, get instant curriculum-aligned answers, auto-generated notes, and practice tests — optimized for low bandwidth.

---

## Quick Start

### 1. Backend Setup

```bash
cd backend

# Create and activate virtual environment
python -m venv venv
source venv/bin/activate        # Windows: venv\Scripts\activate

# Install dependencies
pip install -r ../requirements.txt

# Configure environment
cp .env.example .env
# → Open .env and set your GEMINI_API_KEY
# → Get a free key at: https://aistudio.google.com/app/apikey

# Start the backend
uvicorn main:app --reload --port 8000
```

API docs auto-generated at: **http://localhost:8000/docs**

### 2. Frontend

```bash
cd frontend
python -m http.server 3000
# Open: http://localhost:3000
```

> ⚠️ Always open via **http://localhost:...** not `file://` — browsers block API calls from `file://`.

---

## Environment Variables (`backend/.env`)

| Variable | Required | Notes |
|---|---|---|
| `GEMINI_API_KEY` | ✅ | Free at [aistudio.google.com](https://aistudio.google.com/app/apikey) |
| `GEMINI_MODEL` | No | Default: `gemini-1.5-flash`. Change to `gemini-1.5-pro` for better quality |
| `SECRET_KEY` | ✅ | Change in production! Run: `python -c "import secrets; print(secrets.token_hex(32))"` |
| `SCALEDOWN_API_KEY` | No | Leave blank to skip PDF compression |

---

## Architecture

```
frontend/
  js/api.js        ← All backend calls + Auth (JWT) session management + NotesAPI
  js/app.js        ← Theme, toasts, animations
  js/layout.js     ← Sidebar + navbar (reads real username from localStorage)

backend/
  routers/auth.py       ← POST /api/auth/register  /login
  routers/documents.py  ← POST /api/documents/upload  GET  DELETE
  routers/chat.py       ← POST /api/chat/message  (RAG pipeline → Gemini)
  routers/tests.py      ← POST /api/tests/generate  /submit  GET /results
  routers/analytics.py  ← GET /api/analytics/summary
  services/ai_service.py    ← Gemini 1.5 Flash + HuggingFace embeddings
  services/file_service.py  ← PDF text extraction + chunking
```

## License

MIT
