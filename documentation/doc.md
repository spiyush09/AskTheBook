# AskTheBook — Project Documentation

**Repository:** [github.com/spiyush09/AskTheBook](https://github.com/spiyush09/AskTheBook)

**Stack:** Python, FastAPI, ChromaDB, Groq, Scaledown, Vanilla JS

**Built as part of:** GenAI4GenZ program by HPE

## What is this project?

AskTheBook is a RAG-based study tool I built as a practical challenge in the GenAI4GenZ program by HPE. The idea is simple — instead of asking an AI that knows everything, you ask one that only knows your material. You upload a PDF or DOCX and ask questions about it in plain English. Every answer comes strictly from your document, no hallucinations, always cited back to the source.

Going in I barely knew what RAG meant. Coming out I understand vector databases, context retrieval, prompt engineering, API integration, and how to wire a full stack Python app together. Building something real just hits different compared to watching tutorials.

## The problem it solves

Reading through a 300 page textbook to find one specific concept is really slow. General AI tools will answer your question but sometimes pull from unrelated sources or just make things up — not useful when you're studying specific assigned material. AskTheBook stays grounded in whatever you upload. If the answer isn't in the document, it says so instead of guessing.

## How it works (simple version)

```
You:
    upload a PDF or DOCX
    text gets split into smaller chunks
    chunks go into ChromaDB (vector database)
    you ask a question
    ChromaDB finds the most relevant chunks
    chunks get compressed to reduce noise (Scaledown)
    compressed text + your question goes to Groq (Llama 3)
    you get an answer with a citation showing where it came from
```

## How it works (technical)

The architecture is RAG — Retrieval Augmented Generation. It splits the job into two parts: first find the relevant content, then generate an answer from only that content.

**Ingestion (when you upload)**

Text gets extracted from the file and split into chunks of 1000 characters with a 200 character overlap between chunks. The overlap makes sure that if a concept falls on the boundary between two chunks, it still appears fully in at least one of them. I tried without overlap first and kept getting cut-off answers — that's how I figured out it mattered.

Each chunk gets stored in ChromaDB which converts the text into vector embeddings — numerical representations of what the text means semantically, not just the words it contains.

**Retrieval (when you ask something)**

Your question also gets converted into a vector and ChromaDB finds the 3 chunks that are semantically closest to it. This is why it works even when you phrase the question differently from how the document is written.

**Context compression**

Before sending the retrieved chunks to the language model, they go through Scaledown which strips redundancy and noise while keeping the important information. This reduces token count, lowers API cost, and gives the model cleaner input. I originally skipped this step and the answers were noticeably worse — adding it made a real difference.

**Generation**

The compressed context and your question go to Groq running Llama 3.3 70B. The model is told to only answer from what's in the context. Groq runs on LPU hardware so responses are fast, usually under a second.

**Caching**

After the first time a question is answered, the result gets cached. Same question asked again returns instantly without hitting the API again. Cache holds 500 entries and drops the oldest 100 when full.

## Features

**Core**

- Upload PDF or DOCX up to 20MB
- Ask questions in plain English
- Every answer cites the source file and chunk number
- One document at a time — uploading a new one replaces the old
- Repeated questions served from cache instantly
- Warns before replacing an existing document

**Three response modes**

Standard mode answers directly from the document. Best for quick lookups.

ELI5 mode gives two answers together — a technical answer using proper terminology, and a simplified analogy version of the same thing. Useful when the formal definition alone isn't enough to actually understand something.

Study Buddy mode uses the Socratic method — it doesn't give you the answer, it asks guiding questions to lead you there yourself. Tracks the last 6 turns of conversation so it knows what it already asked. Better for retention than just looking things up.

**Exam Predictor**

Analyzes the document and generates 3 predicted exam questions with difficulty ratings (Easy, Medium, Hard) based on what concepts appear most in the material.

## Stack

| Tool | What I used it for |
|---|---|
| Python | Backend |
| FastAPI | Web framework, auto-generates /docs which helped a lot during testing |
| ChromaDB | Vector database, runs locally and persists on disk |
| Groq | AI inference — LPU hardware, very fast |
| Llama 3.3 70B | The language model, free via Groq |
| Scaledown | Compresses retrieved context before sending to the model |
| pypdf | Extracts text from PDFs |
| python-docx | Extracts text from Word files |
| Vanilla JS | Frontend, no framework |
| uvicorn | Runs the FastAPI server |

## Project structure

```
AskTheBook/
├── backend/
│   ├── core/
│   │   ├── cache.py          # caching logic
│   │   ├── config.py         # loads API keys from .env
│   │   └── rag.py            # ingestion, chunking, retrieval
│   ├── services/
│   │   ├── features.py       # prompts for each mode
│   │   ├── groq_service.py   # Groq API call
│   │   └── llm.py            # pipeline: cache → compress → generate
│   └── main.py               # API routes
├── frontend/
│   ├── index.html            # landing page
│   ├── app.html              # main chat UI
│   ├── style.css             # all styles
│   └── script.js             # all frontend logic
├── chroma_db/                # auto-created, stores embeddings
├── response_cache.json       # auto-created, stores cached responses
├── requirements.txt
├── run_app.bat               # windows launcher
└── .env                      # API keys, don't commit this
```

## Backend files

**main.py** — all API routes and mounts the frontend as static files so everything runs from one server. Routes: `/api/upload`, `/api/chat`, `/api/documents`, `/api/exam`.

**rag.py** — the core of the backend. Reads text from PDFs and DOCX files, splits into chunks, stores in ChromaDB, handles querying and deletion.

**llm.py** — runs the full pipeline per question. Checks cache → compresses with Scaledown → generates with Groq → saves to cache → returns answer.

**features.py** — four prompt templates, one per mode. The Socratic prompt passes conversation history in the query so the model knows what it already asked.

**groq_service.py** — handles the Groq API call, raises HTTP 502 on failure so the frontend always gets a structured error.

**cache.py** — JSON file cache. Keys are SHA-256 hashes of query + prompt + context + model combined so different questions with the same context still get separate cache entries.

**config.py** — loads keys from `.env` and prints a clear warning at startup if any are missing.

## Frontend files

**index.html** — landing page with a "Start Studying" button.

**app.html** — main interface. Left sidebar has upload zone, document library, mode selector, exam button. Right side is the chat area.

**style.css** — dark theme with amber accents. Only the messages panel scrolls, everything else is fixed.

**script.js** — handles uploads, message sending, response rendering, mode switching, Socratic history, document deletion, exam generation. Document list is built with DOM APIs instead of innerHTML to avoid XSS.

## Challenges I ran into

**Chunk overlap** — this was the first thing that broke things in a way I didn't expect. Without overlap, answers would sometimes be half a sentence because the relevant part was split across two chunks. Took me a while to realize that was the problem and not something wrong with the retrieval logic.

**Socratic mode history** — the Socratic mode needs to remember what it already asked so it doesn't repeat itself. But you can't just keep appending the full conversation to every request or you'll blow through the token limit fast. I ended up capping it at 6 turns and shifting old ones out. It's not perfect but it works well enough for a study session.

**Scanned PDFs silently failing** — if someone uploads a scanned PDF (image-based, no selectable text), pypdf just returns empty text and the app indexes nothing without telling the user why. I added a check that throws an error if no text is extracted, but I only realized this was needed after testing with a few different files.

**Cache key collisions** — early version of the cache just hashed the context and model, which meant two different questions on the same document could theoretically return the same cached answer. Fixed it by including the query text in the hash so the key is always unique per question.

**ChromaDB on server restart** — uploaded files are stored in memory and cleared on restart, but ChromaDB persists to disk. This means after a restart the document list shows empty but the vectors are still there. I ended up just clearing ChromaDB on every new upload to keep things consistent, which also enforces the single document policy cleanly.

## API reference

| Method | Endpoint | What it does |
|---|---|---|
| GET | /api/health | check server is running |
| GET | /api/documents | list indexed documents |
| POST | /api/upload | upload and index a file |
| DELETE | /api/documents/{filename} | remove a document |
| POST | /api/chat | ask a question |
| GET | /api/exam | generate exam predictions |

FastAPI also auto-generates interactive docs at `/docs` which I used constantly during development to test the endpoints without needing a frontend.

**POST /api/chat**
```json
{
  "query": "What is skewness?",
  "mode": "normal"
}
```
Modes: `normal`, `eli5`, `socratic`

```json
{
  "answer": "Skewness measures the asymmetry...",
  "sources": ["lecture3.pdf §2", "lecture3.pdf §5"]
}
```

## Setup

Requires Python 3.10+, a Groq API key (console.groq.com) and a Scaledown API key (scaledown.xyz).

```bash
git clone https://github.com/spiyush09/AskTheBook.git
cd AskTheBook
pip install -r requirements.txt
```

Copy `.env.example` to `.env` and fill in your keys:
```
GROQ_API_KEY=your_key_here
SCALEDOWN_API_KEY=your_key_here
```

```bash
# Windows
run_app.bat

# Mac/Linux
uvicorn backend.main:app --reload
```

Open `http://localhost:8000`

## Limitations

- One document at a time
- No OCR — scanned/image-based PDFs won't work, needs selectable text
- No authentication, built for single user use
- 20MB file size limit
- Uploaded files don't survive a server restart but ChromaDB index persists on disk

## What I learned

This was my first time building a full RAG pipeline from scratch as part of the GenAI4GenZ program by HPE. A lot of the challenges are documented above but the bigger picture thing is that I went from not really understanding what RAG meant to having a working mental model of how retrieval, compression, and generation fit together as a pipeline.

The Scaledown integration was a surprise — I added it late expecting it to be a small optimization and it ended up making a noticeable difference to answer quality. That was a good reminder that the stuff between retrieval and generation matters as much as the retrieval itself.

Had some help from AI along the way for certain parts, but the learning was very much real. A lot of things clicked that just wouldn't have from watching tutorials. Building something real and running into actual bugs is just a different kind of learning.