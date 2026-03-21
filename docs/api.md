# REST API Reference — EduLiteAI

Base URL: `http://localhost:8000`

All endpoints except `/health`, `/api/auth/register`, and `/api/auth/login` require:
```
Authorization: Bearer <access_token>
```

Interactive Swagger UI: `http://localhost:8000/docs`
ReDoc: `http://localhost:8000/redoc`

---

## Authentication

### POST `/api/auth/register`

Create a new user account.

**Request body** (`application/json`)
```json
{
  "username": "alice",
  "email": "alice@example.com",
  "password": "strongpassword123"
}
```

**Response** `201 Created`
```json
{
  "id": 1,
  "username": "alice",
  "email": "alice@example.com"
}
```

**Errors**
- `400` — Username already taken
- `400` — Email already registered
- `422` — Validation error (invalid email format, missing fields)

---

### POST `/api/auth/login`

Authenticate and receive a JWT token.

**Request body** (`application/x-www-form-urlencoded`)
```
username=alice&password=strongpassword123
```

**Response** `200 OK`
```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "token_type": "bearer",
  "username": "alice",
  "user_id": 1
}
```

**Errors**
- `401` — Incorrect username or password

---

## Documents

### POST `/api/documents/upload`

Upload a textbook or document. Runs the full ingestion pipeline (extract → chunk → embed → index).

**Request** `multipart/form-data`
- `file` — PDF, TXT, or Markdown file (max 20 MB)

**Response** `201 Created`
```json
{
  "message": "'physics.pdf' uploaded and indexed successfully.",
  "document": {
    "id": 42,
    "filename": "physics.pdf",
    "original_size": 2048000,
    "compressed_size": 2048000,
    "chunk_count": 187,
    "doc_type": "pdf"
  }
}
```

**Errors**
- `400` — Empty file
- `413` — File exceeds 20 MB limit
- `415` — Unsupported file type
- `422` — No extractable text (scanned PDF or empty document)

---

### GET `/api/documents/`

List all documents belonging to the current user.

**Response** `200 OK`
```json
[
  {
    "id": 42,
    "filename": "physics.pdf",
    "original_size": 2048000,
    "compressed_size": 2048000,
    "chunk_count": 187,
    "doc_type": "pdf"
  },
  {
    "id": 43,
    "filename": "chemistry-notes.txt",
    "original_size": 45000,
    "compressed_size": 45000,
    "chunk_count": 24,
    "doc_type": "txt"
  }
]
```

---

### DELETE `/api/documents/{document_id}`

Delete a document. Removes the SQLite metadata row and all ChromaDB vectors for this document.

**Response** `204 No Content`

**Errors**
- `404` — Document not found (or belongs to another user)

---

## Chat (RAG)

### POST `/api/chat/message`

Send a message. Returns an AI-generated answer grounded in the user's uploaded documents, plus source citations.

**Request body** (`application/json`)
```json
{
  "message": "What is Newton's second law?",
  "document_id": 42
}
```

`document_id` is optional. If omitted, searches across all of the user's documents.

**Response** `200 OK`
```json
{
  "answer": "Newton's second law states that the acceleration of an object is directly proportional to the net force acting on it and inversely proportional to its mass. It is expressed as F = ma, where F is force in Newtons, m is mass in kilograms, and a is acceleration in m/s².",
  "sources": [
    {
      "chunk_text": "Newton's Second Law of Motion: The acceleration of a body is directly proportional to...",
      "document_filename": "physics.pdf",
      "chunk_index": 23
    }
  ]
}
```

**Errors**
- `400` — Empty message
- `429` — Gemini rate limited (free tier: 15 RPM). Wait 60 seconds.
- `500` — ChromaDB query failed

---

## Tests

### POST `/api/tests/generate`

Generate MCQ questions from a document using Gemini.

**Request body** (`application/json`)
```json
{
  "document_id": 42,
  "num_questions": 10
}
```

`num_questions` is optional, defaults to `5`. Accepted range: 1–20.

**Response** `200 OK`
```json
{
  "document_id": 42,
  "questions": [
    {
      "question": "According to Newton's first law, what happens to a body at rest when no external force acts on it?",
      "options": {
        "A": "It begins to move slowly",
        "B": "It remains at rest",
        "C": "It accelerates uniformly",
        "D": "It gains potential energy"
      },
      "correct_answer": "B",
      "explanation": "Newton's first law states that a body at rest remains at rest unless acted upon by an external force."
    }
  ]
}
```

**Errors**
- `404` — Document not found
- `422` — No text content found in document (try re-uploading)
- `429` — Gemini rate limited
- `502` — AI returned unparseable JSON (retry)

---

### POST `/api/tests/submit`

Submit quiz answers, calculate the score, and persist the result.

**Request body** (`application/json`)
```json
{
  "document_id": 42,
  "answers": {
    "0": "B",
    "1": "C",
    "2": "A",
    "3": "D",
    "4": "B"
  },
  "questions": [
    {
      "question": "...",
      "options": {"A": "...", "B": "...", "C": "...", "D": "..."},
      "correct_answer": "B",
      "explanation": "..."
    }
  ]
}
```

`answers` maps question index (0-based, as string) to the selected option letter.
`questions` is the full question array returned by `/generate` — sent back so grading requires no second Gemini call.

**Response** `200 OK`
```json
{
  "score": 80.0,
  "correct": 4,
  "total": 5,
  "result_id": 17
}
```

---

### GET `/api/tests/results`

List all quiz attempts for the current user, most recent first.

**Response** `200 OK`
```json
[
  {
    "id": 17,
    "document_id": 42,
    "document_filename": "physics.pdf",
    "score": 80.0,
    "total_questions": 5,
    "taken_at": "2025-03-21T14:30:00"
  }
]
```

---

## Analytics

### GET `/api/analytics/summary`

Return aggregated learning statistics for the current user.

**Response** `200 OK`
```json
{
  "total_documents": 3,
  "total_quizzes_taken": 12,
  "average_score": 72.5,
  "best_score": 95.0,
  "recent_scores": [95.0, 80.0, 60.0, 75.0, 85.0]
}
```

`recent_scores` contains up to 10 scores ordered most-recent-first, for use in trend charts.

---

## Health

### GET `/health`

Liveness probe. No authentication required.

**Response** `200 OK`
```json
{
  "status": "ok",
  "service": "PathShalaAI"
}
```
