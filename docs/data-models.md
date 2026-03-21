# Data Models — EduLiteAI

EduLiteAI uses two backend persistence layers plus browser localStorage.

---

## SQLite — Relational Data

Database file: `backend/data/pathshala.db`
ORM: SQLAlchemy 2.0 (defined in `backend/models.py`)
Auto-created on first startup via `Base.metadata.create_all()`.

### Entity Relationship Diagram

```
┌─────────────────────────────────┐
│            users                │
├─────────────────────────────────┤
│ id            INTEGER PK        │
│ username      VARCHAR(50) UNIQUE│
│ email         VARCHAR(120) UNIQUE│
│ hashed_password VARCHAR(200)    │
│ created_at    DATETIME          │
│ is_active     BOOLEAN           │
└────────────┬────────────────────┘
             │ 1
             │
             │ N
┌────────────▼────────────────────┐
│           documents             │
├─────────────────────────────────┤
│ id            INTEGER PK        │
│ user_id       INTEGER FK→users  │
│ filename      VARCHAR(255)      │
│ original_size INTEGER (bytes)   │
│ compressed_size INTEGER (bytes) │
│ chunk_count   INTEGER           │
│ doc_type      VARCHAR(10)       │
│               ("pdf"|"txt"|"md")│
│ uploaded_at   DATETIME          │
└────────────┬────────────────────┘
             │ 1
             │
             │ N
┌────────────▼────────────────────┐
│          quiz_results           │
├─────────────────────────────────┤
│ id              INTEGER PK      │
│ user_id         INTEGER FK→users│
│ document_id     INTEGER FK→docs │
│ score           FLOAT (0–100)   │
│ total_questions INTEGER         │
│ taken_at        DATETIME        │
│ questions_json  TEXT (JSON)     │
└─────────────────────────────────┘
```

### Table Details

#### `users`

| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | INTEGER | PRIMARY KEY, AUTO | Internal user ID |
| `username` | VARCHAR(50) | UNIQUE, NOT NULL, INDEX | Login name |
| `email` | VARCHAR(120) | UNIQUE, NOT NULL, INDEX | Email address |
| `hashed_password` | VARCHAR(200) | NOT NULL | bcrypt hash |
| `created_at` | DATETIME | DEFAULT utcnow | Account creation time |
| `is_active` | BOOLEAN | DEFAULT True | Soft-disable without deletion |

#### `documents`

| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | INTEGER | PRIMARY KEY, AUTO | Internal document ID |
| `user_id` | INTEGER | FK → users.id, NOT NULL | Owner |
| `filename` | VARCHAR(255) | NOT NULL | Original uploaded filename |
| `original_size` | INTEGER | | Bytes before compression |
| `compressed_size` | INTEGER | | Bytes after ScaleDown (same as original if not used) |
| `chunk_count` | INTEGER | DEFAULT 0 | Number of text chunks stored in ChromaDB |
| `doc_type` | VARCHAR(10) | | `"pdf"` or `"txt"` |
| `uploaded_at` | DATETIME | DEFAULT utcnow | Upload timestamp |

#### `quiz_results`

| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | INTEGER | PRIMARY KEY, AUTO | Internal result ID |
| `user_id` | INTEGER | FK → users.id, NOT NULL | Who took the quiz |
| `document_id` | INTEGER | FK → documents.id, NOT NULL | Which document was tested |
| `score` | FLOAT | | Percentage 0.0–100.0 |
| `total_questions` | INTEGER | DEFAULT 5 | How many questions were in this attempt |
| `taken_at` | DATETIME | DEFAULT utcnow | When the quiz was submitted |
| `questions_json` | TEXT | | Full JSON array of questions + correct answers (for replay) |

### Cascade Rules

- Deleting a `User` cascades to delete all their `Document` and `QuizResult` rows
- Deleting a `Document` cascades to delete all associated `QuizResult` rows
- ChromaDB vectors are **not** automatically cascaded — `documents.py` DELETE handler must explicitly call `chroma_collection.delete()`

---

## ChromaDB — Vector Store

Directory: `backend/data/chroma_db/`
Client: `chromadb.PersistentClient` (disk-backed)
Collection: `pathshala_documents`
Distance metric: **cosine similarity**

### Collection Schema

Each chunk is stored as one record:

| Field | Type | Description |
|---|---|---|
| `id` | string | `"{doc_uuid}_chunk_{i}"` — unique per chunk |
| `embedding` | float[384] | BAAI/bge-small-en-v1.5 vector |
| `document` | string | Raw chunk text (750 chars typical) |
| `metadata.user_id` | string | Owner's user ID (for query isolation) |
| `metadata.document_id` | string | SQLite document ID (for cross-reference) |
| `metadata.doc_uuid` | string | UUID generated at upload time |
| `metadata.chunk_index` | int | Position of chunk within document |
| `metadata.filename` | string | Original filename (for source citations) |

### Key Operations

**Index (on upload)**
```python
chroma_collection.add(
    ids=chunk_ids,
    embeddings=embeddings,       # list of 384-dim float vectors
    documents=chunks,            # list of chunk text strings
    metadatas=metadatas_with_db_id
)
```
Note: ChromaDB doesn't support bulk updates, so the upload pipeline does a delete-then-re-add after the SQLite ID is known.

**Search (on chat message)**
```python
chroma_collection.query(
    query_embeddings=[query_vector],
    n_results=3,
    where={"user_id": str(current_user.id)},    # isolation filter
    include=["documents", "metadatas", "distances"]
)
```

**Fetch all chunks (for quiz generation)**
```python
chroma_collection.get(
    where={"document_id": str(document_id)},
    include=["documents", "metadatas"]
)
# Results sorted by metadata.chunk_index before joining
```

**Delete (on document delete)**
```python
results = chroma_collection.get(where={"document_id": str(document_id)})
chroma_collection.delete(ids=results["ids"])
```

### Embedding Model Details

| Property | Value |
|---|---|
| Model | `BAAI/bge-small-en-v1.5` |
| Dimensions | 384 |
| Max input tokens | 512 |
| Runtime | ONNX Runtime (no PyTorch) |
| Cache location | `~/.cache/fastembed/` |
| Download size | ~25 MB |
| Query vs document | Uses different instruction prefix for queries (improves retrieval accuracy) |

---

## Browser localStorage

The frontend stores three categories of data locally. None of this data is synced to the server.

### Auth Session

| Key | Type | Description |
|---|---|---|
| `padhlo_token` | string | JWT bearer token |
| `padhlo_user` | JSON string | `{"username": "alice", "user_id": 1}` |

Cleared on logout or 401 response.

### Saved Notes (`saved_notes`)

Array of up to 20 note objects, stored as JSON string.

```typescript
interface SavedNote {
  id: number;          // Date.now() at creation time
  title: string;       // Chapter / topic name entered by user
  style: "brief" | "detailed" | "exam" | "visual";
  content: string;     // Full markdown text returned by Gemini
  savedAt: string;     // ISO 8601 timestamp
}
```

Deduplication: if a note with the same `title` (case-insensitive) + `style` already exists, it is updated in place rather than creating a duplicate. Capped at 20 entries (oldest dropped).

### Test History (`saved_tests`)

Array of up to 20 test records, stored as JSON string.

```typescript
interface SavedTest {
  id: number;           // Date.now() at submission time (used as unique ID)
  docId: number;        // SQLite document ID
  docName: string;      // Display name from the subject selector
  score: number;        // Percentage 0–100
  total: number;        // Total question count
  timeSec: number;      // Elapsed seconds
  questions: Question[]; // Full question objects (for review)
  userAnswers: number[]; // Index of selected option per question (-1 = unanswered)
  takenAt: string;       // ISO 8601 timestamp
}
```

Deduplication: skips save if a test with the same `docId` + `score` was saved within the last 30 seconds (prevents double-save on retry). Capped at 20 entries.
