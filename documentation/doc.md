# AskTheBook — Project Documentation

**Educational Content Assistant**

**Repository:** [github.com/spiyush09/AskTheBook](https://github.com/spiyush09/AskTheBook)  
**Stack:** Python · FastAPI · ChromaDB · Groq · Scaledown · Vanilla JS

---

## Table of Contents

1. [What is AskTheBook?](#1-what-is-askthebook)
2. [Problem Statement](#2-problem-statement)
3. [How It Works — Overview](#3-how-it-works--overview)
4. [How It Works — Technical](#4-how-it-works--technical)
5. [Features](#5-features)
6. [Tech Stack](#6-tech-stack)
7. [Project Structure](#7-project-structure)
8. [Backend](#8-backend)
9. [Frontend](#9-frontend)
10. [The RAG Pipeline](#10-the-rag-pipeline)
11. [API Reference](#11-api-reference)
12. [Setup & Running](#12-setup--running)
13. [Limitations](#13-limitations)
14. [Future Scope](#14-future-scope)

---

## 1. What is AskTheBook?

AskTheBook is a document-based Q&A system built on a RAG (Retrieval Augmented Generation) pipeline. You upload a PDF or DOCX file and ask questions about it in plain English. The system retrieves relevant sections from the document and generates answers using a large language model — strictly from your document, not from general internet knowledge.

Every response is cited back to the source document by filename and chunk number.

The system has three response modes and an exam prediction feature, each designed around a different study strategy.

---

## 2. Problem Statement

Studying from long documents is inefficient. A 300-page textbook contains one answer to your question somewhere, but finding it manually takes time. General-purpose AI tools like ChatGPT will answer confidently but may pull from outside sources or generate incorrect information — which is not useful when you need to study specific assigned material.

AskTheBook keeps the AI grounded. It cannot answer from outside knowledge. If the answer is not in your document, it says so.

---

## 3. How It Works — Overview

```
Upload a PDF or DOCX
        ↓
Document is read and split into chunks
        ↓
Chunks are stored in ChromaDB (vector database)
        ↓
You ask a question
        ↓
ChromaDB retrieves the 3 most relevant chunks
        ↓
Chunks are compressed via Scaledown API
        ↓
Compressed context + question → Groq (Llama 3.3 70B)
        ↓
Answer is returned with source citations
```

---

## 4. How It Works — Technical

The core architecture is **RAG — Retrieval Augmented Generation**. RAG separates the AI response process into two distinct steps.

**Retrieval**

When a document is uploaded, the text is extracted and split into chunks of 1000 characters with a 200 character overlap. The overlap ensures sentences that fall across chunk boundaries are not cut off. Each chunk is stored in ChromaDB, which converts text into vector embeddings — numerical representations of semantic meaning. When a question is submitted, ChromaDB converts the question into a vector and finds the 3 most semantically similar chunks. This is not keyword matching — it understands meaning, so differently-phrased questions still find the right content.

**Context Compression**

Before the retrieved chunks reach the language model, they are passed through the Scaledown API. Scaledown removes redundancy and noise from the raw text while keeping all technically relevant information. This reduces token count, lowers API cost, and improves answer quality by giving the model cleaner input.

**Generation**

The compressed context and the original question are sent to Groq's API running Llama 3.3 70B. The model is instructed to answer only from the provided context. Groq is used for its inference speed — responses typically return in under a second.

**Caching**

Every unique query-context combination is cached after its first response. Repeated questions return instantly from cache without making an API call. The cache holds up to 500 entries and evicts the oldest 100 when the limit is reached.

---

## 5. Features

### Core

| Feature | Description |
|---|---|
| Document Upload | Upload any PDF or DOCX, up to 20MB |
| Ask Anything | Questions in plain English |
| Cited Answers | Every response shows the source filename and chunk |
| Single Document Focus | One document at a time for retrieval accuracy |
| Context Compression | Scaledown compresses retrieved chunks before sending to LLM |
| Response Caching | Repeated questions are served instantly from cache |
| Upload Guard | Warns before replacing an existing document |

### Study Modes

**Standard**
Direct answer from the document. Best for quick lookups and definitions.

**ELI5 (Explain Like I'm 5)**
Returns two answers together — a technical answer using proper terminology, and a simplified analogy-based explanation of the same concept. Useful when a formal definition alone is hard to grasp.

**Study Buddy (Socratic)**
Does not answer directly. Instead, asks guiding questions that lead you toward the answer — following the Socratic method. Maintains conversation state across the last 6 turns so follow-up questions are contextually aware. This mode is designed for retention, not just lookup.

**Exam Predictor**
Analyzes the document for the most emphasized concepts and generates 3 predicted exam questions with difficulty ratings — Easy, Medium, or Hard. Questions are based on what the document actually covers, not generic templates.

---

## 6. Tech Stack

| Tool | Role | Reason |
|---|---|---|
| Python | Backend language | Standard for AI/backend work |
| FastAPI | Web framework | Fast, modern, auto-generates `/docs` |
| ChromaDB | Vector database | Local, persistent, semantic search |
| Groq | AI inference API | LPU hardware, extremely fast responses |
| Llama 3.3 70B | Language model | Open source, high quality, free via Groq |
| Scaledown | Context compression | Reduces token noise before LLM call |
| pypdf | PDF parser | Extracts text from PDF files |
| python-docx | DOCX parser | Extracts text from Word files |
| Vanilla JS | Frontend logic | No framework overhead |
| HTML + CSS | Frontend UI | Built from scratch, dark amber theme |
| uvicorn | ASGI server | Runs FastAPI locally |

---

## 7. Project Structure

```
AskTheBook/
│
├── backend/
│   ├── core/
│   │   ├── cache.py          # Response caching with LRU eviction
│   │   ├── config.py         # Environment variable loading and validation
│   │   └── rag.py            # Document ingestion, chunking, querying
│   │
│   ├── services/
│   │   ├── features.py       # Prompt logic for all 4 modes
│   │   ├── groq_service.py   # Groq API integration
│   │   └── llm.py            # Pipeline: cache → compress → generate
│   │
│   └── main.py               # API routes and app entry point
│
├── frontend/
│   ├── index.html            # Landing page
│   ├── app.html              # Main chat interface
│   ├── style.css             # All styles and theming
│   └── script.js             # All frontend logic
│
├── chroma_db/                # Auto-created — vector embeddings stored here
├── response_cache.json       # Auto-created — cached AI responses
├── requirements.txt          # Python dependencies
├── run_app.bat               # Windows one-click launcher
├── .env                      # API keys — never commit this
├── .env.example              # Template showing required keys
└── README.md                 # Quick start guide
```

---

## 8. Backend

### `main.py`

Entry point. Defines all API routes — `/api/upload`, `/api/chat`, `/api/documents`, `/api/exam`. Also mounts the frontend as static files so the whole app is served from one server.

### `rag.py`

The core of the system. Handles:
- Reading text from PDF and DOCX files
- Splitting text into overlapping chunks
- Storing chunks in ChromaDB with metadata
- Vector similarity search on incoming questions
- Document deletion and database clearing

### `llm.py`

Orchestrates the full response pipeline for every question:
1. Check cache — return instantly if found
2. Compress context with Scaledown
3. Send to Groq for generation
4. Save result to cache
5. Return answer

### `features.py`

Contains the four prompt templates — one per mode. Each prompt defines the AI's persona, rules, and output format. The Socratic prompt carries conversation history in the query so the AI knows what it already asked.

### `groq_service.py`

Handles the actual Groq API call. Raises an HTTP 502 exception on failure so the frontend always receives a structured error rather than raw text.

### `cache.py`

File-based caching using a JSON file. Cache keys are SHA-256 hashes of the query, prompt, context, and model — ensuring collisions are not possible across different questions or documents.

### `config.py`

Loads API keys from `.env` using `python-dotenv`. Validates both keys at startup and prints a clear warning if any are missing.

---

## 9. Frontend

### `index.html`

Landing page with a hero section explaining the product. Has a "Start Studying" CTA that links to `app.html`.

### `app.html`

Main interface. Split into two columns:
- **Left sidebar** — upload zone, document library panel, mode selector, exam predictor button
- **Right chat area** — message thread, input box, send button, mode badge, clear button

### `style.css`

All visual styling. Uses CSS custom properties for the full color theme. Key design decisions: fixed header, locked viewport layout, only the messages panel scrolls internally. Dark background with amber/gold accent colors.

### `script.js`

Handles all interactivity:
- File uploads with size and type validation
- Chat message sending and rendering
- Mode switching with Socratic history reset
- ELI5 and Technical tag formatting in AI responses
- XSS-safe document list rendering using DOM APIs
- URL-encoded filenames on delete requests
- Exam generation with button disabled state during load
- Auto-scroll to latest message

---

## 10. The RAG Pipeline

### Ingestion

1. File is read into memory — `pypdf` for PDF, `python-docx` for DOCX
2. Text is split into chunks of **1000 characters** with **200 character overlap**
3. Each chunk is assigned a unique ID and metadata — `{ source: filename, chunk_id: n }`
4. ChromaDB stores the chunks and automatically generates vector embeddings
5. Single document policy is enforced — the database is cleared before any new upload

### Why Overlap Matters

Without overlap, a concept that spans a chunk boundary gets split between two chunks. Neither chunk contains the full idea. With 200 characters of overlap, the next chunk starts before the boundary, ensuring the concept appears in full in at least one chunk.

### Embedding and Retrieval

ChromaDB uses sentence transformers to convert text into high-dimensional vectors. When a question is submitted, it is also embedded. ChromaDB returns the 3 chunks with the smallest cosine distance to the question vector — the most semantically similar content.

### Context Compression

The 3 retrieved chunks are combined and passed to Scaledown. Scaledown identifies and removes redundancy, keeping only the content relevant to the question. The compressed output goes to Groq.

### Generation

The model receives:
- A system prompt defining its role and constraints
- The compressed context as retrieved content
- The user's original question

It is instructed to answer only from the context. If the answer is not present, it must say so.

---

## 11. API Reference

| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/health` | Server health check |
| GET | `/api/documents` | List currently indexed documents |
| POST | `/api/upload` | Upload and index a PDF or DOCX (max 20MB) |
| DELETE | `/api/documents/{filename}` | Remove a document from the index |
| POST | `/api/chat` | Submit a question and receive an answer |
| GET | `/api/exam` | Generate predicted exam questions |

### POST `/api/chat`

**Request body:**
```json
{
  "query": "What is skewness?",
  "mode": "normal"
}
```

**Modes:** `normal` · `eli5` · `socratic`

**Response:**
```json
{
  "answer": "Skewness measures the asymmetry of a probability distribution...",
  "sources": ["lecture3.pdf §2", "lecture3.pdf §5"]
}
```

### GET `/api/exam`

**Response:**
```json
{
  "questions": "1. Define the central limit theorem. (Difficulty: Medium)\n2. ..."
}
```

---

## 12. Setup & Running

### Requirements

- Python 3.10 or higher
- Groq API key — [console.groq.com](https://console.groq.com)
- Scaledown API key — [scaledown.xyz](https://scaledown.xyz)

### Steps

**1. Clone the repository**
```bash
git clone https://github.com/spiyush09/AskTheBook.git
cd AskTheBook
```

**2. Install dependencies**
```bash
pip install -r requirements.txt
```

**3. Configure environment**

Copy `.env.example` to `.env` and fill in your keys:
```
GROQ_API_KEY=your_key_here
SCALEDOWN_API_KEY=your_key_here
```

**4. Run the server**
```bash
# Windows
run_app.bat

# Mac / Linux
uvicorn backend.main:app --reload
```

**5. Open in browser**

Navigate to `http://localhost:8000`

---

## 13. Limitations

- **One document at a time** — uploading a new file replaces the existing one
- **No OCR support** — scanned or image-based PDFs are not supported; the file must contain selectable text
- **Local file storage** — uploaded files are stored temporarily; redeploying the server clears them (ChromaDB index persists on disk)
- **No authentication** — designed for single-user or self-hosted use
- **Max file size** — 20MB per upload

---

