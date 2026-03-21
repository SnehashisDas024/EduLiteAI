# System Architecture — EduLiteAI

## Overview

EduLiteAI is a single-server RAG (Retrieval-Augmented Generation) application. A FastAPI backend handles all data processing, storage, and AI coordination. A pure-HTML/JS frontend communicates with the backend exclusively via REST. There are no external services except the Google Gemini API for LLM inference.

```
┌─────────────────────────────────────────────────────────────────┐
│                         BROWSER                                 │
│                                                                 │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────────┐   │
│  │index.html│  │ chat.html│  │notes.html│  │  test.html   │   │
│  │login.html│  │upload.html  │pdfs.html │  │analytics.html│   │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘  └──────┬───────┘   │
│       │              │              │                │           │
│  ┌────▼──────────────▼──────────────▼────────────────▼───────┐  │
│  │                    js/api.js                               │  │
│  │  Auth │ Documents │ Chat │ Tests │ Analytics │ Notes       │  │
│  │                    + localStorage                          │  │
│  └────────────────────────┬────────────────────────────────┘  │
└───────────────────────────┼─────────────────────────────────────┘
                            │  HTTP/REST  (localhost:8000)
                            │  Authorization: Bearer <JWT>
┌───────────────────────────▼─────────────────────────────────────┐
│                     FastAPI Backend                              │
│                                                                  │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │                    main.py                               │    │
│  │  CORS Middleware → Router Registration → Lifespan       │    │
│  └──┬──────────┬──────────┬──────────┬──────────┬──────────┘    │
│     │          │          │          │          │                │
│  ┌──▼──┐  ┌───▼──┐  ┌────▼──┐  ┌───▼───┐  ┌──▼────────┐       │
│  │auth │  │ docs │  │ chat  │  │ tests │  │ analytics │       │
│  │.py  │  │ .py  │  │  .py  │  │  .py  │  │    .py    │       │
│  └──┬──┘  └───┬──┘  └────┬──┘  └───┬───┘  └──┬────────┘       │
│     │         │           │         │          │                │
│  ┌──▼─────────▼───────────▼─────────▼──────────▼────────────┐   │
│  │              Services Layer                                │   │
│  │  ┌─────────────────────┐    ┌───────────────────────┐    │   │
│  │  │   ai_service.py     │    │   file_service.py     │    │   │
│  │  │  FastEmbed ONNX     │    │  PyMuPDF extraction   │    │   │
│  │  │  Gemini API calls   │    │  LangChain chunking   │    │   │
│  │  │  Quiz builder       │    │  ScaleDown (optional) │    │   │
│  │  └──────────┬──────────┘    └───────────────────────┘    │   │
│  └─────────────┼──────────────────────────────────────────┘   │
│                │                                                │
│  ┌─────────────▼──────────────────────────────────────────┐    │
│  │              Persistence Layer                          │    │
│  │  ┌────────────────────┐    ┌──────────────────────┐    │    │
│  │  │  SQLite (SQLAlchemy│    │  ChromaDB (local)    │    │    │
│  │  │  users             │    │  document chunks     │    │    │
│  │  │  documents         │    │  384-dim vectors     │    │    │
│  │  │  quiz_results      │    │  cosine similarity   │    │    │
│  │  └────────────────────┘    └──────────────────────┘    │    │
│  └────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────┘
                            │
              ┌─────────────▼──────────────┐
              │    Google Gemini API        │
              │  gemini-2.5-flash (LLM)     │
              │  - Chat / RAG answers       │
              │  - Quiz generation          │
              │  - Notes generation         │
              └────────────────────────────┘
```

---

## Component Breakdown

### Frontend Layer

**`js/api.js`** — All network communication. Contains:
- `Auth` — localStorage token helpers
- `AuthAPI` — login, register
- `DocumentsAPI` — upload (XHR with progress), list, delete
- `ChatAPI` — send message
- `TestsAPI` — generate quiz, submit answers, get results, local history
- `NotesAPI` — generate notes (via chat endpoint), save/load/delete from localStorage
- `AnalyticsAPI` — fetch summary stats
- `apiFetch()` — base wrapper handling auth headers, 401 redirect, error extraction

**`js/app.js`** — Pure UI utilities:
- Theme toggle (dark/light, persisted in localStorage)
- Toast notification system
- Card entrance animations (skips dynamic containers)
- Mobile sidebar menu
- Progress bar animations

**`js/layout.js`** — Shared chrome. `renderLayout(pageTitle, activeHref)` injects the sidebar and navbar into every protected page at runtime, pulling real username from localStorage.

---

### Backend Layer

#### `main.py`
FastAPI application entry point. Responsibilities:
- Registers CORS middleware (wide open for local dev — tighten for production)
- Registers all 5 routers
- Lifespan hook: creates all SQLite tables on startup via `Base.metadata.create_all()`
- Exposes `/health` liveness probe

#### `config.py`
Centralised settings using `pydantic-settings`. Reads from `backend/.env` using an absolute path derived from `__file__` — works regardless of which directory uvicorn is invoked from. Emits a warning on startup if `GEMINI_API_KEY` is missing.

#### `database.py`
Initialises both storage backends:
- SQLAlchemy engine + `SessionLocal` factory
- ChromaDB `PersistentClient` with the `pathshala_documents` collection (cosine distance space)
- Exports `chroma_collection` and `get_db()` dependency for use in routers

---

### Routers

#### `auth.py` — `/api/auth`

```
POST /register  →  validate unique username/email  →  bcrypt hash  →  INSERT users
POST /login     →  lookup user  →  verify bcrypt  →  create JWT  →  return TokenResponse
```

JWT payload: `{"sub": str(user_id), "exp": timestamp}`
Token lifetime: configurable via `ACCESS_TOKEN_EXPIRE_MINUTES` (default 60 min)

`get_current_user()` is a reusable FastAPI dependency that decodes the JWT and returns the `User` ORM object. Used by every protected endpoint.

#### `documents.py` — `/api/documents`

Full ingestion pipeline on upload (see detailed flow below).
Delete cascade: removes ChromaDB vectors via metadata filter `{document_id: str(id)}`, then deletes the SQLite row.

#### `chat.py` — `/api/chat`

Single endpoint `POST /message`. Accepts optional `document_id` to scope retrieval to one book. Returns `answer` (string) + `sources` (list of chunk snippets with filenames).

#### `tests.py` — `/api/tests`

- `generate`: pulls all chunks for a document from ChromaDB (metadata `.get()`, no embedding needed), sorts by `chunk_index`, joins into one text blob, calls `generate_quiz(text, num_questions)`
- `submit`: grades answers server-side, stores `QuizResult` with full `questions_json` for replay
- `results`: returns list ordered by `taken_at DESC`

#### `analytics.py` — `/api/analytics`

Single SQL query with `COUNT`, `AVG`, `MAX` aggregations on `quiz_results`. Also fetches last 10 scores for a trend line.

---

### Services

#### `ai_service.py`

**Embeddings (FastEmbed)**
```python
@lru_cache(maxsize=1)          # Load once per process lifetime
def _get_fastembed_embeddings():
    return FastEmbedEmbeddings(
        model_name="BAAI/bge-small-en-v1.5",
        max_length=512
    )

embed_texts(texts)  →  embed_documents()   # batch, for indexing
embed_query(query)  →  embed_query()        # single, query-specific prefix
```

Model: `BAAI/bge-small-en-v1.5`
- 33M parameters, 384-dimensional output
- ONNX Runtime backend — no PyTorch required
- ~25 MB model file, cached in `~/.cache/fastembed/`

**Gemini calls**
```python
@retry(stop=stop_after_attempt(5),
       wait=wait_exponential(multiplier=2, min=4, max=32))
def _call_gemini_with_retry(prompt):
    return gemini_model.generate_content(prompt).text

def call_gemini(prompt):
    # Wraps retry, re-raises as HTTPException(429) on exhaustion
```

**Quiz builder**
```python
def _build_quiz_prompt(num_questions, text):
    # String concatenation (NOT .format()) to avoid KeyError on JSON braces in prompt
    return PREFIX + text[:12000] + SUFFIX

def generate_quiz(document_text, num_questions=5):
    raw = call_gemini(_build_quiz_prompt(num_questions, document_text))
    cleaned = strip_fences(raw)
    cleaned = re.sub(r',\s*([}\]])', r'\1', cleaned)  # fix Gemini trailing commas
    return json.loads(cleaned)
```

#### `file_service.py`

**PDF extraction (PyMuPDF)**
```python
def _extract_pdf_pymupdf(file_bytes):
    doc = fitz.open(stream=file_bytes, filetype="pdf")  # in-memory, no temp file
    pages = [f"[Page {i+1}]\n{page.get_text('text')}" for page in doc]
    return "\n\n".join(pages)
```

**Chunking (LangChain)**
```python
RecursiveCharacterTextSplitter(
    chunk_size=750,       # ~150-200 tokens — fits bge-small 512-token window
    chunk_overlap=100,    # context preservation across boundaries
    separators=["\n\n", "\n", ". ", " ", ""]  # paragraph → sentence → word
)
```

**ScaleDown (optional)**
If `SCALEDOWN_API_KEY` is set, uploads PDF bytes to ScaleDown API before extraction. Falls back silently to uncompressed on any error.

---

## Data Flow Diagrams

### Document Upload Flow

```
Browser                    FastAPI                 Services              Storage
   │                          │                       │                     │
   │── POST /upload ──────────►│                       │                     │
   │   multipart/form-data     │                       │                     │
   │                          │── validate ──────────►│                     │
   │                          │   (type, size)         │                     │
   │                          │                       │                     │
   │                          │── compress_file() ───►│                     │
   │                          │   (ScaleDown or noop) │                     │
   │                          │                       │                     │
   │                          │── extract_text() ────►│                     │
   │                          │                       │── PyMuPDF ─────────►│
   │                          │                       │   (fitz.open)       │
   │                          │                       │◄── full_text ───────│
   │                          │◄── full_text ─────────│                     │
   │                          │                       │                     │
   │                          │── chunk_text() ───────►│                     │
   │                          │                       │── RecursiveChunk ──►│
   │                          │◄── [chunk1..chunkN] ──│                     │
   │                          │                       │                     │
   │                          │── embed_texts() ──────►│                     │
   │                          │                       │── FastEmbed ONNX ──►│
   │                          │◄── [[v1]..[vN]] ──────│                     │
   │                          │                       │                     │
   │                          │── chroma.add() ───────────────────────────►│
   │                          │   (ids, embeddings,                         │── ChromaDB
   │                          │    documents, metadata)                     │
   │                          │                       │                     │
   │                          │── db.add(Document) ──────────────────────►│── SQLite
   │                          │── db.commit()                               │
   │                          │                       │                     │
   │◄── 201 {document} ───────│                       │                     │
```

### RAG Chat Flow

```
Browser                    FastAPI                 Services              Storage
   │                          │                       │                     │
   │── POST /chat/message ────►│                       │                     │
   │   {message, document_id} │                       │                     │
   │                          │── embed_query() ──────►│                     │
   │                          │                       │── FastEmbed ONNX ──►│
   │                          │◄── query_vector ──────│                     │
   │                          │                       │                     │
   │                          │── chroma.query() ─────────────────────────►│── ChromaDB
   │                          │   n_results=3                               │   cosine sim
   │                          │◄── [chunk1, chunk2, chunk3] ───────────────│
   │                          │                       │                     │
   │                          │── build_rag_prompt()  │                     │
   │                          │   "You are Vidya..."  │                     │
   │                          │   [Chunk 1]...        │                     │
   │                          │   === QUESTION ===    │                     │
   │                          │                       │                     │
   │                          │── call_gemini() ──────────────────────────────────►│ Gemini
   │                          │   (with Tenacity retry)                             │ API
   │                          │◄── answer_text ───────────────────────────────────│
   │                          │                       │                     │
   │◄── {answer, sources} ────│                       │                     │
```

### Authentication Flow

```
Browser                         FastAPI
   │                               │
   │── POST /api/auth/login ───────►│
   │   username=x&password=y        │── lookup User by username
   │   (x-www-form-urlencoded)      │── bcrypt.verify(password, hashed)
   │                               │── create_access_token({"sub": user_id})
   │◄── {access_token, username} ──│
   │                               │
   │   store in localStorage        │
   │                               │
   │── GET /api/documents/ ────────►│
   │   Authorization: Bearer <jwt>  │── jwt.decode(token, SECRET_KEY)
   │                               │── db.query(User).filter(id=sub)
   │                               │── return User object
   │◄── [{id, filename, ...}] ─────│
```

---

## Security Model

- **Passwords** hashed with bcrypt (salt auto-generated, truncated to 72 bytes for bcrypt safety)
- **JWT** signed with HS256 using `SECRET_KEY` from environment
- **Data isolation** enforced at the query layer: every ChromaDB query and SQLite query filters by `current_user.id`
- **CORS** currently set to `allow_origins=["*"]` for local development — must be restricted to the actual frontend origin in production
- **File uploads** validated for MIME type and capped at 20 MB
- No user input is ever executed as code or passed unsanitised to SQL (SQLAlchemy ORM + parameterised queries)

---

## Deployment Considerations

For production deployment, change the following from their development defaults:

| Setting | Development | Production |
|---|---|---|
| `SECRET_KEY` | `insecure-dev-secret-change-me` | 64+ char random hex |
| `allow_origins` | `["*"]` | `["https://yourdomain.com"]` |
| SQLite | `sqlite:///./data/pathshala.db` | PostgreSQL recommended for multi-user load |
| ChromaDB | Local `PersistentClient` | Chroma server or managed vector DB |
| Frontend | `python -m http.server` | nginx / CDN |
| uvicorn | `--reload` (dev mode) | `--workers 4` (no reload) |
