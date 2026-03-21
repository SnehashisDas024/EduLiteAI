// api.js — All backend API calls for PadhloAI
const API_BASE = 'http://localhost:8000';

// ─── Token helpers ────────────────────────────────────────────────
const Auth = {
  getToken: () => localStorage.getItem('padhlo_token'),
  getUser:  () => { try { return JSON.parse(localStorage.getItem('padhlo_user') || 'null'); } catch(e) { return null; } },
  setSession: (token, user) => {
    localStorage.setItem('padhlo_token', token);
    localStorage.setItem('padhlo_user', JSON.stringify(user));
  },
  clearSession: () => {
    localStorage.removeItem('padhlo_token');
    localStorage.removeItem('padhlo_user');
  },
  isLoggedIn: () => !!localStorage.getItem('padhlo_token'),
};

// ─── Base fetch wrapper ───────────────────────────────────────────
async function apiFetch(path, options = {}) {
  const token = Auth.getToken();
  const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  if (options.body instanceof FormData) delete headers['Content-Type'];

  const res = await fetch(`${API_BASE}${path}`, { ...options, headers });

  if (res.status === 401) {
    Auth.clearSession();
    window.location.href = 'login.html';
    return;
  }

  const data = res.headers.get('content-type')?.includes('application/json')
    ? await res.json()
    : await res.text();

  if (!res.ok) {
    const msg = data?.detail || data || `HTTP ${res.status}`;
    throw new Error(typeof msg === 'string' ? msg : JSON.stringify(msg));
  }
  return data;
}

// ─── Auth API ─────────────────────────────────────────────────────
const AuthAPI = {
  async login(username, password) {
    const form = new URLSearchParams();
    form.append('username', username);
    form.append('password', password);
    const res = await fetch(`${API_BASE}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: form,
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.detail || 'Login failed');
    return data; // { access_token, token_type, username, user_id }
  },

  async register(username, email, password) {
    return apiFetch('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({ username, email, password }),
    });
  },
};

// ─── Documents API ────────────────────────────────────────────────
const DocumentsAPI = {
  async upload(file, onProgress) {
    const token = Auth.getToken();
    const formData = new FormData();
    formData.append('file', file);
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open('POST', `${API_BASE}/api/documents/upload`);
      xhr.setRequestHeader('Authorization', `Bearer ${token}`);
      if (onProgress) xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100));
      };
      xhr.onload = () => {
        let data;
        try { data = JSON.parse(xhr.responseText); } catch(e) { data = {}; }
        if (xhr.status === 201) resolve(data);
        else reject(new Error(data.detail || 'Upload failed'));
      };
      xhr.onerror = () => reject(new Error('Network error during upload'));
      xhr.send(formData);
    });
  },
  async list() { return apiFetch('/api/documents/'); },
  async delete(id) { return apiFetch(`/api/documents/${id}`, { method: 'DELETE' }); },
};

// ─── Chat API ─────────────────────────────────────────────────────
const ChatAPI = {
  async sendMessage(message, documentId = null) {
    return apiFetch('/api/chat/message', {
      method: 'POST',
      body: JSON.stringify({ message, document_id: documentId }),
    });
  },
};

// ─── Tests API ────────────────────────────────────────────────────
const TestsAPI = {
  async generate(documentId, numQuestions = 5) {
    return apiFetch('/api/tests/generate', {
      method: 'POST',
      body: JSON.stringify({ document_id: documentId, num_questions: numQuestions }),
    });
  },
  async submit(documentId, answers, questions) {
    return apiFetch('/api/tests/submit', {
      method: 'POST',
      body: JSON.stringify({ document_id: documentId, answers, questions }),
    });
  },
  async results() { return apiFetch('/api/tests/results'); },

  // Local test history (max 20). Dedup: same docId + same score within 30s = same test.
  saveTest(docId, docName, score, total, timeSec, questions, userAnswers) {
    const tests = JSON.parse(localStorage.getItem('saved_tests') || '[]');
    const now = Date.now();
    // Dedup: skip if identical docId+score submitted within last 30 seconds
    const isDup = tests.some(t => t.docId === docId && t.score === score && (now - t.id) < 30000);
    if (isDup) return null;
    tests.unshift({ id: now, docId, docName, score, total, timeSec, questions, userAnswers, takenAt: new Date().toISOString() });
    localStorage.setItem('saved_tests', JSON.stringify(tests.slice(0, 20)));
    return now;
  },
  getSavedTests() { return JSON.parse(localStorage.getItem('saved_tests') || '[]'); },
  deleteSavedTest(id) {
    const tests = JSON.parse(localStorage.getItem('saved_tests') || '[]');
    localStorage.setItem('saved_tests', JSON.stringify(tests.filter(t => t.id !== id)));
  },
};

// ─── Analytics API ────────────────────────────────────────────────
const AnalyticsAPI = {
  async summary() { return apiFetch('/api/analytics/summary'); },
};

// ─── Notes API  (calls /api/chat/message with a notes prompt) ─────
const NotesAPI = {
  async generate(documentId, chapterTitle, style) {
    const styleGuides = {
      brief: `You are an expert teacher creating COMPREHENSIVE study notes. Generate DETAILED notes (aim for 800-1200 words minimum) for the chapter: "${chapterTitle}".

Structure your notes with ALL of the following sections:
## 📌 Overview
(2-3 paragraph introduction explaining the topic, its importance, and real-world relevance)

## 🔑 Key Concepts
(List and FULLY explain every major concept — at least 8-12 concepts with 2-4 sentence explanations each)

## 📖 Detailed Explanations
(For each concept, provide thorough explanation with examples, analogies, and how it connects to other concepts)

## ⚗️ Important Definitions
(Define every technical term with clear, precise definitions — minimum 10 definitions)

## 🔢 Formulas & Laws
(List ALL relevant formulas, laws, equations with: the formula itself, what each variable means, units, and a worked example)

## 📊 Key Points & Facts
(20+ bullet points of important facts, relationships, and exam-worthy information)

## 💡 Real-World Applications
(At least 5 real-life examples showing how this chapter's concepts are applied)

## 📝 Exam Tips
(10-15 specific tips: common exam mistakes to avoid, frequently tested topics, trick questions)

## 🔄 Summary
(A concise paragraph tying everything together)

Use ## for section headings, ### for sub-sections. Use **bold** for important terms. Use formulas in the format: Formula: F = ma`,

      detailed: `You are an expert teacher. Create an IN-DEPTH, COMPREHENSIVE reference guide (aim for 1500-2500 words) for the chapter: "${chapterTitle}".

Include ALL of the following with maximum detail:

## 📌 Introduction & Background
(Full introduction — history, context, why this topic matters)

## 🏗️ Core Concepts (Detailed)
For EACH concept provide:
- **Definition**: precise definition
- **Explanation**: 3-5 sentences of thorough explanation
- **Example**: a concrete worked example
- **Common Misconceptions**: what students often get wrong

## 📐 Mathematical Framework
(All formulas with full derivations where possible, units, dimensional analysis, worked numerical examples)

## 🔬 Mechanisms & Processes
(Step-by-step explanation of how things work, cause-and-effect relationships)

## 📊 Comparisons & Classifications
(Tables or structured comparisons between related concepts)

## 🌍 Applications & Examples
(Minimum 8 real-world applications with detailed explanation)

## ⚡ Advanced Concepts
(Deeper topics, extensions, connections to other chapters)

## 📝 Practice Problems with Solutions
(5-8 solved example problems of varying difficulty)

## 🎯 Exam Strategy
(15+ exam tips, common question patterns, marks-scoring strategies)

Use **bold** for definitions, *italics* for emphasis. Formula format: **Formula**: [equation] where [variable definitions]`,

      exam: `You are an expert exam coach. Generate an EXTENSIVE Q&A study guide (minimum 200-500 questions) for: "${chapterTitle}".

Format as follows:

## 📝 1-Mark Questions (Very Short Answer)
Generate 80-100 questions like:
**Q1.** [Question]
**Ans:** [Precise 1-line answer]

## 📄 2-Mark Questions (Short Answer)
Generate 60-80 questions like:
**Q1.** [Question]
**Ans:** [2-3 sentence answer covering key points]

## 📃 3-Mark Questions (Short Answer)
Generate 40-60 questions like:
**Q1.** [Question]
**Ans:** [Detailed answer with 3 clear points]

## 📜 5-Mark Questions (Long Answer)
Generate 20-30 questions like:
**Q1.** [Question]
**Ans:** [Full detailed answer with introduction, numbered points, examples, and conclusion]

## 🔢 Numerical Problems (if applicable)
Generate 15-20 numerical problems with full step-by-step solutions.

## 🎯 MCQ Practice
Generate 30-40 MCQs with 4 options each, mark the correct answer with ✓

Cover ALL topics: definitions, concepts, processes, applications, formulas, comparisons, diagrams, exceptions, and real-world examples.`,

      visual: `You are an expert teacher creating a VISUAL study guide with ASCII diagrams and mind-map style notes for: "${chapterTitle}".

## 🗺️ Mind Map: ${chapterTitle}
Create a hierarchical mind map using text art:
\`\`\`
[MAIN TOPIC: ${chapterTitle}]
    ├── [Subtopic 1]
    │       ├── Concept A → explanation
    │       ├── Concept B → explanation
    │       └── Concept C → explanation
    ├── [Subtopic 2]
    │       ├── ...
    └── [Subtopic 3]
            └── ...
\`\`\`

## 📊 Concept Comparison Tables
Create comparison tables like:
| Property | Concept A | Concept B |
|----------|-----------|-----------|
| ...      | ...       | ... |

## 🔄 Process Flow Diagrams
Show step-by-step processes as:
Step 1: [Name] → Step 2: [Name] → Step 3: [Name] → Result

## 🕸️ Relationship Web
Show how concepts connect:
**Concept A** ←causes→ **Concept B** ←leads to→ **Concept C**

## 📐 Formula Visual Breakdown
For each formula:
\`\`\`
     Force (F)
         ↑
  F = m × a
  ↙         ↘
Mass(m)  Acceleration(a)
(kg)        (m/s²)
\`\`\`

## 🗂️ Category Cards
Group related concepts in visual boxes:
┌─────────────────────────┐
│  📦 CATEGORY NAME       │
├─────────────────────────┤
│  • Item 1: explanation  │
│  • Item 2: explanation  │
│  • Item 3: explanation  │
└─────────────────────────┘

## 📝 Quick-Reference Visual Summary
Create a one-page visual summary with emojis, arrows, and structured layout.

Generate at least 10 different visual diagrams/tables/maps covering all major aspects of the chapter.`,
    };

    const message = styleGuides[style] || styleGuides.brief;
    return apiFetch('/api/chat/message', {
      method: 'POST',
      body: JSON.stringify({ message, document_id: documentId }),
    });
  },

  // Save generated notes to localStorage
  saveNote(title, style, content) {
    const notes = JSON.parse(localStorage.getItem('saved_notes') || '[]');
    // Dedup: same title+style → update existing instead of creating duplicate
    const existingIdx = notes.findIndex(n =>
      n.title.trim().toLowerCase() === title.trim().toLowerCase() && n.style === style
    );
    const entry = {
      id: existingIdx >= 0 ? notes[existingIdx].id : Date.now(),
      title, style, content, savedAt: new Date().toISOString()
    };
    if (existingIdx >= 0) {
      notes[existingIdx] = entry;
    } else {
      notes.unshift(entry);
    }
    localStorage.setItem('saved_notes', JSON.stringify(notes.slice(0, 20)));
    return entry.id;
  },

  getSavedNotes() {
    return JSON.parse(localStorage.getItem('saved_notes') || '[]');
  },

  deleteNote(id) {
    const notes = JSON.parse(localStorage.getItem('saved_notes') || '[]');
    localStorage.setItem('saved_notes', JSON.stringify(notes.filter(n => n.id !== id)));
  },
};

// ─── Auth guard ───────────────────────────────────────────────────
function requireAuth() {
  if (!Auth.isLoggedIn()) {
    window.location.href = 'login.html';
    return false;
  }
  return true;
}

// ─── Exports ──────────────────────────────────────────────────────
window.Auth = Auth;
window.AuthAPI = AuthAPI;
window.DocumentsAPI = DocumentsAPI;
window.ChatAPI = ChatAPI;
window.TestsAPI = TestsAPI;
window.AnalyticsAPI = AnalyticsAPI;
window.NotesAPI = NotesAPI;
window.requireAuth = requireAuth;
