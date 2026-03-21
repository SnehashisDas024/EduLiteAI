# EduLiteAI 

> AI-powered education platform designed for students. Upload your textbooks, get instant AI-tutored answers, auto-generate structured study notes in multiple styles, and take adaptive MCQ tests — all powered by a fully local embedding pipeline and Google Gemini.

<div align="center">

![Python](https://img.shields.io/badge/Python-3.11+-3776AB?style=flat&logo=python&logoColor=white)
![FastAPI](https://img.shields.io/badge/FastAPI-0.111-009688?style=flat&logo=fastapi&logoColor=white)
![SQLite](https://img.shields.io/badge/SQLite-003B57?style=flat&logo=sqlite&logoColor=white)
![ChromaDB](https://img.shields.io/badge/ChromaDB-Vector_Store-FF6B35?style=flat)
![Google Gemini](https://img.shields.io/badge/Google_Gemini-2.5_Flash-4285F4?style=flat&logo=google&logoColor=white)
![FastEmbed](https://img.shields.io/badge/FastEmbed-ONNX_CPU-76B900?style=flat)
![PyMuPDF](https://img.shields.io/badge/PyMuPDF-C_Library-CC0000?style=flat)
![LangChain](https://img.shields.io/badge/LangChain-0.2-1C3C3C?style=flat)
![JWT](https://img.shields.io/badge/JWT-Auth-000000?style=flat&logo=jsonwebtokens&logoColor=white)
![HTML5](https://img.shields.io/badge/HTML5-E34F26?style=flat&logo=html5&logoColor=white)
![CSS3](https://img.shields.io/badge/CSS3-1572B6?style=flat&logo=css3&logoColor=white)
![JavaScript](https://img.shields.io/badge/JavaScript-ES6+-F7DF1E?style=flat&logo=javascript&logoColor=black)
![License](https://img.shields.io/badge/License-MIT-green?style=flat)

</div>

---

## Table of Contents

- [Features](#features)
- [Tech Stack](#tech-stack)
- [Project Structure](#project-structure)
- [Quick Start](#quick-start)
- [Environment Variables](#environment-variables)
- [API Reference](#api-reference)
- [How It Works](#how-it-works)
- [Data Storage](#data-storage)
- [Performance Notes](#performance-notes)
- [Troubleshooting](#troubleshooting)
- [License](#license)

---

## Features

| Feature | Description |
|---|---|
| **AI Tutor Chat** | Ask questions about your uploaded books — answers grounded in your own documents via RAG |
| **Notes Generator** | Generate structured study notes in 4 styles: Brief, Detailed, Exam Ready, Visual |
| **Test Generator** | Auto-generate MCQ tests with configurable question count (5–20), difficulty, and timer |
| **Test Review** | Revisit past tests with full answer review and explanations |
| **Saved Notes Library** | All generated notes saved locally (up to 20), viewable and downloadable as PDF |
| **Analytics Dashboard** | Track test scores, averages, and performance trends over time |
| **My PDFs** | Manage uploaded books and notes; filter by type |
| **JWT Authentication** | Secure per-user sessions; each user sees only their own documents |
| **Local Embeddings** | ONNX-based FastEmbed runs entirely on CPU — no GPU, no external embedding API calls |

---

## Tech Stack

### Backend

| Component | Technology |
|---|---|
| Web framework | FastAPI 0.111 |
| ASGI server | Uvicorn |
| ORM / Database | SQLAlchemy 2.0 + SQLite |
| Vector store | ChromaDB 0.5 (persistent, local) |
| Embeddings | FastEmbed `BAAI/bge-small-en-v1.5` via ONNX Runtime |
| PDF extraction | PyMuPDF (`fitz`) — C-based MuPDF library |
| Text splitting | LangChain `RecursiveCharacterTextSplitter` |
| LLM | Google Gemini 2.5 Flash via `google-generativeai` |
| Retry logic | Tenacity (exponential backoff, up to 5 retries) |
| Auth | JWT (`python-jose`) + bcrypt (`passlib`) |
| HTTP client | httpx (async, for optional ScaleDown compression) |

### Frontend

| Component | Technology |
|---|---|
| UI | Vanilla HTML5 + CSS3 (no framework dependency) |
| API calls | Fetch API + XMLHttpRequest (for upload progress tracking) |
| State | `localStorage` (JWT token, saved notes, test history) |
| Theme | CSS custom properties, dark/light mode toggle |
| PDF export | Browser `window.print()` via Blob URL |

---

## Project Structure

```
EduLiteAI/
│
├── README.md
├── requirements.txt               # Python dependencies (pinned versions)
│
├── backend/
│   ├── main.py                    # FastAPI app entry point, CORS, router registration
│   ├── config.py                  # Centralised settings via pydantic-settings + .env
│   ├── database.py                # SQLAlchemy engine + ChromaDB client initialisation
│   ├── models.py                  # ORM models: User, Document, QuizResult
│   │
│   ├── routers/
│   │   ├── __init__.py
│   │   ├── auth.py                # POST /api/auth/register  POST /api/auth/login
│   │   ├── documents.py           # POST /api/documents/upload  GET /  DELETE /{id}
│   │   ├── chat.py                # POST /api/chat/message  (full RAG pipeline)
│   │   ├── tests.py               # POST /api/tests/generate  /submit  GET /results
│   │   └── analytics.py           # GET /api/analytics/summary
│   │
│   ├── services/
│   │   ├── __init__.py
│   │   ├── ai_service.py          # FastEmbed embeddings + Gemini calls + quiz builder
│   │   └── file_service.py        # PyMuPDF extraction + LangChain chunking + ScaleDown
│   │
│   ├── data/                      # Runtime data — created automatically on first run
│   │   ├── pathshala.db           # SQLite database
│   │   └── chroma_db/             # ChromaDB vector store
│   │
│   └── .env.example               # Template — copy to .env and fill in keys
│
├── frontend/
│   ├── index.html                 # Landing page
│   ├── login.html                 # Login form
│   ├── register.html              # Registration form
│   ├── dashboard.html             # Main dashboard with live stats
│   ├── upload.html                # Book upload with drag-and-drop + progress bar
│   ├── chat.html                  # AI tutor chat interface with document switcher
│   ├── notes.html                 # Notes generator + saved notes library
│   ├── test.html                  # Test generator + history panel + review modal
│   ├── pdfs.html                  # My PDFs — books, notes, tests in one place
│   ├── analytics.html             # Performance analytics and score trends
│   │
│   ├── css/
│   │   └── styles.css             # All styles, CSS variables, dark/light themes
│   │
│   └── js/
│       ├── api.js                 # All backend API calls + localStorage helpers
│       ├── app.js                 # Theme toggle, toasts, animations, mobile menu
│       └── layout.js              # Shared sidebar + navbar injected into every page
│
└── docs/
    ├── architecture.md            # System design, data flows, component diagrams
    ├── api.md                     # Complete REST API reference with schemas
    ├── data-models.md             # Database schema, relationships, ChromaDB structure
    └── setup-guide.md             # Detailed setup for Windows, macOS, and Linux
```

---

## Quick Start

### Prerequisites

- Python 3.11 or higher
- A free Google Gemini API key → [aistudio.google.com](https://aistudio.google.com/app/apikey)

### 1. Clone and install

```bash
git clone https://github.com/SnehashisDas024/EduLiteAI
cd EduLiteAI

# Create and activate virtual environment
python -m venv .venv
source .venv/bin/activate        # Windows: .venv\Scripts\activate

# Install all dependencies
pip install -r requirements.txt
```

> **Note:** On first embedding call, `fastembed` downloads `BAAI/bge-small-en-v1.5` (~25 MB) to `~/.cache/fastembed/`. This happens once automatically.

### 2. Configure environment

```bash
cd backend
cp .env.example .env
```

Edit `backend/.env` and set at minimum:

```env
GEMINI_API_KEY=your_gemini_key_here
SECRET_KEY=your_random_64_char_hex_here
```

Generate a secure `SECRET_KEY`:

```bash
python -c "import secrets; print(secrets.token_hex(32))"
```

### 3. Start the backend

```bash
# Run from inside the backend/ directory
uvicorn main:app --reload --port 8000
```

Interactive API docs available at: **http://localhost:8000/docs**

### 4. Start the frontend

```bash
# Open a new terminal, run from the frontend/ directory
cd frontend
python -m http.server 3000
```

Open **http://localhost:3000** in your browser.

> ⚠️ Always open via `http://localhost:...` — not `file://`. Browsers block cross-origin API calls from `file://` URLs.

---

## Environment Variables

All variables live in `backend/.env`. Copy `backend/.env.example` to create it.

| Variable | Required | Default | Description |
|---|---|---|---|
| `GEMINI_API_KEY` | ✅ | — | Google AI API key — free at [aistudio.google.com](https://aistudio.google.com/app/apikey) |
| `GEMINI_MODEL` | No | `gemini-2.5-flash-preview-04-17` | Gemini model name. Use `gemini-1.5-flash` for faster/cheaper responses |
| `SECRET_KEY` | ✅ | `insecure-dev-secret-change-me` | JWT signing secret. **Must be changed in production** |
| `ALGORITHM` | No | `HS256` | JWT signing algorithm |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | No | `60` | JWT token lifetime in minutes |
| `SCALEDOWN_API_KEY` | No | `""` | Optional PDF compression service. Leave blank to disable |
| `SCALEDOWN_API_URL` | No | `https://api.scaledown.io/v1/compress` | ScaleDown API endpoint |
| `DATABASE_URL` | No | `sqlite:///./data/pathshala.db` | SQLAlchemy database URL |
| `CHROMA_DB_PATH` | No | `./data/chroma_db` | ChromaDB persistence directory |

---

## API Reference

See [`docs/api.md`](docs/api.md) for full request/response schemas. Summary:

### Authentication
| Method | Endpoint | Auth | Description |
|---|---|---|---|
| `POST` | `/api/auth/register` | None | Create a new account |
| `POST` | `/api/auth/login` | None | Returns JWT bearer token |

### Documents
| Method | Endpoint | Auth | Description |
|---|---|---|---|
| `POST` | `/api/documents/upload` | Bearer | Upload PDF/TXT — runs full ingestion pipeline |
| `GET` | `/api/documents/` | Bearer | List current user's documents |
| `DELETE` | `/api/documents/{id}` | Bearer | Delete document and its vectors |

### Chat (RAG)
| Method | Endpoint | Auth | Description |
|---|---|---|---|
| `POST` | `/api/chat/message` | Bearer | RAG-grounded answer + source citations |

### Tests
| Method | Endpoint | Auth | Description |
|---|---|---|---|
| `POST` | `/api/tests/generate` | Bearer | Generate N MCQs from a document |
| `POST` | `/api/tests/submit` | Bearer | Submit answers, get score, persist result |
| `GET` | `/api/tests/results` | Bearer | List all past quiz attempts |

### Analytics
| Method | Endpoint | Auth | Description |
|---|---|---|---|
| `GET` | `/api/analytics/summary` | Bearer | Aggregated stats: docs, quiz count, avg/best score |

### Health
| Method | Endpoint | Auth | Description |
|---|---|---|---|
| `GET` | `/health` | None | Liveness probe — returns `{"status": "ok"}` |

---

## How It Works

### Document Ingestion Pipeline

```
Upload request
     │
     ├─ Validate (MIME type, 20 MB limit)
     ├─ Optional: ScaleDown PDF compression
     ├─ PyMuPDF: extract text page-by-page (C library, ~100ms per PDF)
     ├─ LangChain RecursiveCharacterTextSplitter
     │    chunk_size=750 chars, chunk_overlap=100 chars
     │    splits on: \n\n → \n → ". " → " " → ""
     ├─ FastEmbed: batch-embed all chunks (ONNX, CPU-only, ~384-dim vectors)
     ├─ ChromaDB: store vectors + metadata (user_id, document_id, chunk_index)
     └─ SQLite: store file metadata (filename, size, chunk_count)
```

### RAG Chat Pipeline

```
User message
     │
     ├─ FastEmbed: embed_query() — same model as indexing
     ├─ ChromaDB: cosine similarity search
     │    n_results=3, filtered by user_id (+ optional document_id)
     ├─ Build RAG prompt:
     │    "You are Vidya... Answer using ONLY the context below..."
     │    [Chunk 1]...[Chunk 2]...[Chunk 3]
     │    === QUESTION === {user message}
     ├─ Gemini API call (Tenacity: up to 5 retries, 4s→32s backoff)
     └─ Return answer + source chunk citations
```

### Quiz Generation Pipeline

```
Generate request (document_id, num_questions)
     │
     ├─ Verify document belongs to user (SQLite)
     ├─ ChromaDB .get() — retrieve ALL chunks for document
     ├─ Sort chunks by chunk_index → join into full_text
     ├─ Build quiz prompt:
     │    "Generate exactly N MCQs... Return ONLY valid JSON..."
     │    [full_text truncated to 12,000 chars]
     ├─ Gemini API call
     ├─ Strip markdown fences (` ```json `)
     ├─ Strip trailing commas (Gemini quirk: re.sub fix)
     ├─ json.loads() → validate list
     └─ Return GenerateResponse with structured question objects
```

---

## Data Storage

### SQLite — `backend/data/pathshala.db`

Three tables (auto-created on startup):

- **`users`** — `id`, `username`, `email`, `hashed_password`, `created_at`, `is_active`
- **`documents`** — `id`, `user_id`, `filename`, `original_size`, `compressed_size`, `chunk_count`, `doc_type`, `uploaded_at`
- **`quiz_results`** — `id`, `user_id`, `document_id`, `score`, `total_questions`, `taken_at`, `questions_json`

### ChromaDB — `backend/data/chroma_db/`

Single collection `pathshala_documents` with cosine similarity space.

Each chunk stored with:
- **vector**: 384-dimensional float array (BAAI/bge-small-en-v1.5)
- **document**: raw chunk text
- **metadata**: `user_id`, `document_id`, `doc_uuid`, `chunk_index`, `filename`

### Browser localStorage

- `padhlo_token` — JWT bearer token
- `padhlo_user` — `{username, user_id}` JSON
- `saved_notes` — array of up to 20 generated notes (title, style, content, timestamp)
- `saved_tests` — array of up to 20 test records (questions, user answers, score, time)

---

## Performance Notes

The embedding stack was specifically chosen to avoid PyTorch and run efficiently on CPU:

| Concern | Old approach | New approach | Result |
|---|---|---|---|
| Embedding cold start | `sentence-transformers` + PyTorch JIT | `fastembed` + ONNX Runtime | ~40s → ~1–2s |
| PDF extraction speed | `PyPDF2` pure Python | `PyMuPDF` C/MuPDF | ~10–20× faster |
| Chunk quality | Manual character split | LangChain `RecursiveCharacterTextSplitter` | No mid-sentence cuts |
| Gemini rate limits | No retry | Tenacity exponential backoff | Handles 15 RPM free tier gracefully |

A PDF that previously took ~45 seconds to process now takes ~2–4 seconds on a standard laptop CPU.

---

## Troubleshooting

**`GEMINI_API_KEY is not set` warning**
→ Copy `backend/.env.example` to `backend/.env` and add your key.

**Model downloads every restart**
→ It shouldn't — `fastembed` caches to `~/.cache/fastembed/`. Check disk space.

**ChromaDB dimension mismatch error**
→ You switched embedding models on an existing collection. Delete `backend/data/chroma_db/` and re-upload your documents.

**`Failed to fetch` / NetworkError in browser**
→ Backend is not running on port 8000, or you opened the frontend via `file://` instead of `http://localhost:3000`.

**Quiz returns 502 "AI returned unexpected format"**
→ Gemini returned malformed JSON. The parser auto-fixes trailing commas. Retry once.

**Only 5 questions generated when I selected 10**
→ Ensure you are on the latest version. The `num_questions` parameter now flows from the frontend dropdown through `TestsAPI.generate(documentId, numQuestions)` → `POST /api/tests/generate` → `generate_quiz(text, num_questions)` → the Gemini prompt.

---

## License

MIT
