# Setup Guide — EduLiteAI

Step-by-step installation for Windows, macOS, and Linux.

---

## Prerequisites

| Requirement | Minimum | Notes |
|---|---|---|
| Python | 3.11 | 3.12 also works |
| RAM | 2 GB free | FastEmbed ONNX model uses ~200 MB at runtime |
| Disk | 500 MB free | ~300 MB for dependencies, ~25 MB for FastEmbed model |
| Internet | Required once | To download the FastEmbed model on first run, and for Gemini API calls |
| Gemini API key | Required | Free at [aistudio.google.com](https://aistudio.google.com/app/apikey) |

---

## Step 1 — Get the Code

```bash
git clone https://github.com/SnehashisDas024/EduLiteAI
cd EduLiteAI
```

Or download and extract the ZIP from GitHub.

---

## Step 2 — Create a Virtual Environment

### macOS / Linux

```bash
python3 -m venv .venv
source .venv/bin/activate
```

### Windows (Command Prompt)

```cmd
python -m venv .venv
.venv\Scripts\activate.bat
```

### Windows (PowerShell)

```powershell
python -m venv .venv
.venv\Scripts\Activate.ps1
```

> If PowerShell blocks the script, run: `Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser`

You should see `(.venv)` at the start of your terminal prompt after activation.

---

## Step 3 — Install Dependencies

```bash
pip install -r requirements.txt
```

This installs approximately 2 GB of packages including FastAPI, ChromaDB, FastEmbed, PyMuPDF, and LangChain. It may take several minutes on the first run.

> **No PyTorch required.** The old `sentence-transformers` approach needed PyTorch (~700 MB). The new FastEmbed stack uses ONNX Runtime and is much lighter.

---

## Step 4 — Configure the Backend

```bash
cd backend
cp .env.example .env
```

Open `backend/.env` in a text editor and fill in:

```env
# Required — get free key at https://aistudio.google.com/app/apikey
GEMINI_API_KEY=AIzaSy...your_key_here...

# Required — change this to a random secret before deploying
SECRET_KEY=change_me_to_something_random_and_long
```

Generate a secure `SECRET_KEY`:

```bash
python -c "import secrets; print(secrets.token_hex(32))"
```

### Optional settings

```env
# Gemini model — faster/cheaper alternative
GEMINI_MODEL=gemini-1.5-flash

# How long users stay logged in (minutes)
ACCESS_TOKEN_EXPIRE_MINUTES=120

# PDF compression service (leave blank to skip)
SCALEDOWN_API_KEY=
```

---

## Step 5 — Start the Backend

Make sure you are inside the `backend/` directory and your virtual environment is active:

```bash
# From the backend/ directory:
uvicorn main:app --reload --port 8000
```

You should see output like:

```
INFO:     PathShalaAI starting up…
INFO:     SQLite tables ready.
INFO:     Application startup complete.
INFO:     Uvicorn running on http://127.0.0.1:8000 (Press CTRL+C to quit)
```

**First embedding call** (when you upload your first document) will show:
```
INFO: Initialising FastEmbed (BAAI/bge-small-en-v1.5) — first run downloads ~25MB...
INFO: FastEmbed ready.
```
This ~25 MB download happens once and is cached in `~/.cache/fastembed/`.

Visit **http://localhost:8000/docs** to confirm the backend is running and explore the API.

---

## Step 6 — Start the Frontend

Open a **new terminal window** (keep the backend running in the first one). Navigate to the `frontend/` directory:

```bash
cd frontend
python -m http.server 3000
```

Open your browser and go to: **http://localhost:3000**

> ⚠️ **Always use `http://localhost:3000`** — not `file:///path/to/frontend/index.html`. Browsers block cross-origin `fetch()` calls from `file://` URLs, which would prevent the frontend from reaching the backend.

---

## Step 7 — Create an Account and Upload a Book

1. Click **Get Started** on the landing page
2. Register a new account
3. Log in
4. Go to **Upload Book** in the sidebar
5. Upload a PDF or text file (up to 20 MB)
6. Wait for indexing to complete (a <1 MB PDF takes ~2–4 seconds)
7. Go to **AI Tutor Chat** and ask a question about your book

---

## Troubleshooting

### `ModuleNotFoundError: No module named 'fastapi'`

Your virtual environment is not activated. Run the activate command for your platform (Step 2).

### `GEMINI_API_KEY is not set` warning on startup

`backend/.env` is missing or `GEMINI_API_KEY` is not set. Check Step 4.

### `Error: listen EADDRINUSE` or `Address already in use`

Port 8000 or 3000 is occupied by another process. Stop the conflicting process, or change the port:
```bash
uvicorn main:app --reload --port 8001    # backend
python -m http.server 3001               # frontend
```
If you change the backend port, update `API_BASE` in `frontend/js/api.js`.

### `chromadb.errors.InvalidDimensionException`

You switched the embedding model while an existing ChromaDB collection has vectors of a different dimension. Fix:
```bash
rm -rf backend/data/chroma_db/
```
Then re-upload your documents.

### Upload succeeds but chat returns "I don't have any uploaded documents"

The document's ChromaDB vectors were stored with a different `user_id` than the logged-in user. This can happen if you reset the SQLite database but kept ChromaDB. Fix:
```bash
rm backend/data/pathshala.db
rm -rf backend/data/chroma_db/
```
Restart the backend — tables will be recreated. Re-register and re-upload.

### Quiz generation returns 502

Gemini returned malformed JSON (usually trailing commas in options). The parser attempts to auto-fix these. If it fails, simply retry — Gemini output varies between calls.

### Slow first upload

FastEmbed is downloading the ~25 MB ONNX model on first use. Subsequent uploads are fast.

---

## Upgrading

When pulling new code:

```bash
git pull
pip install -r requirements.txt   # pick up any new dependencies
```

If the database schema changed, delete `backend/data/pathshala.db` — it will be recreated on startup.

---

## Running Without a Virtual Environment (not recommended)

If you're testing quickly and don't want a venv:

```bash
pip install --user -r requirements.txt
```

Be aware this installs packages globally for your user and may conflict with other projects.
