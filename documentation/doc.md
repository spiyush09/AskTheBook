# AskTheBook — Project Documentation

**Repository:** [github.com/spiyush09/AskTheBook](https://github.com/spiyush09/AskTheBook)  
**Built for:** GenAI4GenZ program by HPE  
**Stack:** Python, FastAPI, ChromaDB, Groq, Scaledown, Vanilla JS

---

## What is this

AskTheBook is a RAG-based study tool I built as a practical challenge in the GenAI4GenZ program by HPE. You upload a PDF or DOCX, ask questions about it in plain English, and the answers come only from your document — not from general knowledge. Every answer cites the exact chunk it came from so you can verify it.

The idea was simple: instead of asking an AI that knows everything, ask one that only knows your material. General AI tools will answer study questions but sometimes pull from unrelated sources or just hallucinate something that sounds right — not useful when you're going through specific assigned content. Grounding the model in your document fixes that.

---

## Architecture

The system is RAG — Retrieval Augmented Generation. The idea is to split the job into two separate steps: first find the relevant content from your document, then generate an answer from only that content. The model never touches anything outside what you uploaded.

The full pipeline per question looks like this:

```
upload document
  → extract text
  → split into chunks with overlap
  → store chunks as vector embeddings in ChromaDB

ask a question
  → embed the question
  → ChromaDB finds the 3 most relevant chunks
  → chunks get compressed by Scaledown
  → compressed context + question → Groq (Llama 3.3 70B)
  → answer + source citations returned to frontend
  → result saved to cache
```

### Ingestion

When you upload a file, text gets extracted with `pypdf` (for PDFs) or `python-docx` (for DOCX). That text gets split into chunks of 1000 characters with 200 characters of overlap between consecutive chunks.

The overlap was something I figured out by breaking things first. Without it, if a concept fell on the boundary between two chunks it would get cut in half and the retrieval would return incomplete context. 200 characters of overlap means each chunk shares its tail with the start of the next one, so nothing important disappears at a boundary. I tried without overlap first and kept getting half-answers — that's how I figured out it mattered.

Each chunk gets stored in ChromaDB with metadata: the source filename and the chunk index. The chunk index is what shows up in citations so you can trace exactly where an answer came from.

ChromaDB converts the text into vector embeddings automatically using its default embedding model. These are numerical representations of meaning, not just the words — which is what makes semantic search work.

### Retrieval

When you ask a question, it also gets converted into a vector and ChromaDB finds the 3 chunks that are semantically closest to it. This works even when your phrasing is completely different from how the document is written, because the comparison is on meaning rather than keyword matching.

The number 3 is configurable in `query_documents()` but 3 chunks worked well in testing — enough context without flooding the model with irrelevant content.

### Compression

Before the retrieved chunks go to the LLM they go through Scaledown, which compresses the context by removing redundancy and noise while keeping the important information. I added this fairly late in the build expecting it to be a small optimization. It made a more noticeable difference than I expected — cleaner input to the model means more focused answers, less rambling, and lower token usage.

The Scaledown call includes the retrieved context and a hint prompt telling it to retain key technical details. If the call fails for any reason, the pipeline falls back to sending the raw context and logs the error. Nothing breaks for the user.

### Generation

Compressed context + your question go to Groq running Llama 3.3 70B. The model is always given a system instruction to only answer from the provided context — if the answer isn't there, it should say so rather than guessing.

Each response mode (Standard, ELI5, Socratic) has a different prompt in `features.py`. The prompt is what changes the behaviour, the underlying model call is identical across all three.

Groq uses LPU hardware so responses come back fast, usually under a second even for the 70B model.

### Caching

After the first time a question gets answered, the result gets saved to a local JSON file. The cache key is a SHA-256 hash of the query, prompt, context, and model name combined. All four have to be in the hash — earlier version only hashed context and model, which meant two different questions on the same document could theoretically collide to the same key and return the wrong cached answer. Including the query text in the hash makes every key unique per question.

Cache holds 500 entries and evicts the oldest 100 when it hits the limit. Not sophisticated but it works fine for local single-user use.

---

## Features

### Response modes

There are three modes and you can switch between them at any point. Switching clears the Socratic conversation history since it would be confusing to carry that across modes.

**Standard**  
Answers directly from the document. The prompt tells the model to be concise and cite where the information came from. Best for quick factual lookups — "what does X mean", "what are the steps for Y", that kind of thing.

**ELI5**  
Returns two answers together in the same response. First a technical answer using proper terminology from the document, then a simplified analogy version that explains the same concept without jargon. Useful when the formal definition alone isn't enough to actually understand something. The two-part structure is enforced in the prompt with `[Technical]` and `[ELI5]` section tags, which the frontend detects and styles differently.

**Study Buddy**  
Socratic method. The model doesn't give you the answer — it asks guiding questions to lead you there yourself. On the first message it asks a foundational question based on the context. If you answer, it tells you whether you're right, partially right, or off track, then either asks a follow-up or confirms you got there.

The frontend tracks the last 6 turns of conversation and sends the full history with each new message so the model knows what it already asked. Capped at 6 turns to keep the request size from growing unbounded. Old turns get shifted out as new ones come in.

The Socratic prompt also has a rule for simple definitional questions — if you just ask "what is X", it answers directly first rather than responding with a question, since that would be annoying.

### Exam Predictor

Sends a broad query to ChromaDB to pull the 5 most relevant chunks about important concepts from the document, then asks the model to identify the 3 most emphasized concepts and write one exam question for each with a difficulty rating (Easy, Medium, Hard).

The difficulty rating is based on conceptual complexity — Easy is usually definitional, Hard usually requires applying or connecting multiple concepts. It's not guaranteed to be accurate but it's a decent indicator of what the material is actually emphasizing.

### Single document policy

Only one document can be indexed at a time. Uploading a new one wipes the database first and re-indexes from scratch. The frontend shows a confirmation dialog before doing this so you don't accidentally replace something you wanted to keep.

This was a deliberate design choice. Supporting multiple documents would have meant adding per-document filtering to every query, dealing with potentially conflicting context from different sources, and making the UI more complicated. Keeping it to one document keeps the answers clean and the code simple.

---

## File breakdown

### Project structure

```
AskTheBook/
├── backend/
│   ├── core/
│   │   ├── cache.py          # response caching
│   │   ├── config.py         # loads env vars, validates keys at startup
│   │   └── rag.py            # ingestion, chunking, retrieval, deletion
│   ├── services/
│   │   ├── features.py       # prompt templates for each mode
│   │   ├── groq_service.py   # Groq API call
│   │   └── llm.py            # full pipeline: cache → compress → generate
│   └── main.py               # all API routes
├── frontend/
│   ├── index.html            # landing page
│   ├── app.html              # main chat UI
│   ├── style.css             # all styles
│   └── script.js             # all frontend logic
├── chroma_db/                # auto-created on first upload
├── response_cache.json       # auto-created on first cached response
├── requirements.txt
├── render.yaml               # Render deployment config
├── run_app.bat               # windows launcher
└── .env.example
```

### Backend files

**`main.py`**  
All the API routes and the static file mount. FastAPI serves both the API and the frontend from the same server — the frontend is mounted as a static directory at `/`. Routes are `/api/upload`, `/api/chat`, `/api/documents`, `/api/exam`, and `/api/health`.

FastAPI auto-generates interactive docs at `/docs`. I used this constantly while building — you can test every endpoint directly in the browser without needing Postman or touching the frontend. Saved a lot of time during development.

The upload route reads the file content once, checks the size limit (20MB), then passes the bytes to `ingest_document()`. The delete route uses `{filename:path}` as the path parameter type — the `:path` type lets filenames with dots be captured correctly, without it FastAPI truncates at the dot.

**`rag.py`**  
The core of the backend. Handles everything related to the vector database: text extraction, chunking, storing, querying, deleting, and clearing.

`ingest_document()` is async and takes the original filename and raw bytes. It extracts text, chunks it, generates IDs and metadata for each chunk, then calls `collection.add()`. If no text is extracted at all — which happens with scanned PDFs — it raises a 422 before trying to add anything.

`query_documents()` embeds the query and calls `collection.query()`. It caps `n_results` at however many chunks are actually in the collection to avoid ChromaDB throwing an error when the document is very short.

`get_collection()` is a helper that either gets the existing collection or creates a new one. It's called fresh each time instead of holding a module-level reference — that way a cleared collection doesn't leave a stale reference sitting around causing errors on the next call.

`clear_database()` gets all document IDs from the collection and deletes them in one call. It checks `count()` first so it doesn't try to delete from an already empty collection.

**`llm.py`**  
Runs the full pipeline for every question. Checks cache first, then compresses with Scaledown if the context is over 500 characters, then calls Groq, then saves to cache. The Scaledown call is wrapped in try/except so if the API is down or returns an error the pipeline continues with the raw uncompressed context.

**`features.py`**  
Four async functions, one per feature. Each builds a prompt string and calls `generate_response()` from `llm.py`.

`get_standard_answer()` — direct answer prompt. Concise, cite the source.

`get_eli5_answer()` — forces `[Technical]` and `[ELI5]` tags in the output which the frontend uses for styling.

`get_socratic_tutor()` — the most complex prompt. Has explicit rules about when to ask a question versus when to answer directly, how to respond to a student's answer, and how to move through follow-ups. Conversation history arrives via the query string from the frontend.

`predict_exam_questions()` — takes context only, no real user query. Uses a fixed string `"__exam_predict__"` as the query for the cache key since there's no actual user question to hash.

**`groq_service.py`**  
Makes the Groq API call. Builds the full prompt by combining context and the mode instruction, sends it to `llama-3.3-70b-versatile`, and returns the response text. Raises an HTTP 502 on any exception so the frontend always gets a structured error response instead of an unhandled crash.

**`cache.py`**  
JSON file cache. Loads the file into memory on startup as `_memory_cache`. All reads and writes go to the in-memory dict, and every write also persists to disk. The cache key is `sha256(query + "|" + prompt + "|" + context + "|" + model)` — all four fields joined with a separator before hashing to prevent accidental collisions between different combinations.

When the cache hits 500 entries it deletes the first 100 keys in insertion order. Simple FIFO, not LRU. Fine for this use case.

**`config.py`**  
Loads `GROQ_API_KEY` and `SCALEDOWN_API_KEY` from `.env` using `python-dotenv`. Calls `validate_settings()` at import time which prints a clear warning at startup if either key is missing. Means you find out immediately instead of getting a cryptic error on the first API call.

### Frontend files

**`index.html`**  
Landing page. Shows what the app does with a three-step breakdown and links to `app.html`. No logic here.

**`app.html`**  
Main app interface. Sidebar on the left has the upload zone, document library, mode selector, and exam button. Chat area on the right has the message feed and input box at the bottom. Everything is static HTML — JavaScript handles all the dynamic parts.

**`style.css`**  
Dark theme with amber accents throughout. Uses CSS custom properties for all colors. The messages panel is the only scrolling element — header, sidebar, and input zone are all fixed. Has breakpoints at 768px (sidebar stacks above chat on mobile) and 1024px (narrower sidebar on tablets).

**`script.js`**  
All frontend logic in one file. The main things it handles:

*Uploads* — reads the selected file, hits `/api/upload` with FormData, updates the document list and status message on response. Before uploading it fetches the current document list and shows a confirmation dialog if one is already indexed.

*Chat* — `sendMessage()` reads the input, adds the user message to the DOM, posts to `/api/chat`, then renders the response. For Socratic mode it prepends the conversation history to the query before sending. Sources come back as an array and get rendered as a styled pill below the response bubble.

*Socratic history* — stored in `socraticHistory` as an array of `{question, answer}` objects. Max 6 entries, oldest gets shifted out when the limit is hit. Resets on mode switch and on new document upload.

*Document list* — built with DOM APIs (`createElement`, `appendChild`) rather than injecting into `innerHTML`. This avoids XSS issues if a filename contains HTML characters.

*Mode switching* — clicking a mode item updates `currentMode`, clears Socratic history, updates the badge in the chat topbar, and adds a system message.

*Exam predictor* — calls `/api/exam`, disables the button while waiting to prevent double-clicks, re-enables in the `finally` block after the response arrives.

---

## Setup

### Requirements

- Python 3.10 or higher
- A Groq API key — [console.groq.com](https://console.groq.com), free tier is fine
- A Scaledown API key — [scaledown.xyz](https://scaledown.xyz)

### Local

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

Start the server:

```bash
# Windows
run_app.bat

# Mac/Linux
uvicorn backend.main:app --reload
```

Open `http://localhost:8000`. The `run_app.bat` script also runs pip install and opens the browser automatically.

### Deploying to Render

There's a `render.yaml` in the repo that handles Render deployment. It sets up a 1GB persistent disk at `/opt/render/project/src/chroma_db` so ChromaDB survives deploys and restarts. The `CHROMA_PATH` env var points the app at that path.

Add `GROQ_API_KEY` and `SCALEDOWN_API_KEY` as environment variables in the Render dashboard — they're marked `sync: false` in the yaml so they don't get accidentally committed.

---

## API reference

| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/health` | check server is running |
| GET | `/api/documents` | list currently indexed documents |
| POST | `/api/upload` | upload and index a PDF or DOCX |
| DELETE | `/api/documents/{filename}` | delete a document by filename |
| POST | `/api/chat` | ask a question |
| GET | `/api/exam` | generate predicted exam questions |

**POST `/api/upload`**  
Multipart form data with a `file` field. Returns chunk count and filename on success. Returns 400 for unsupported file types, 413 if over 20MB, 422 if no text could be extracted (scanned PDF), 500 for anything else.

**POST `/api/chat`**

Request:
```json
{
  "query": "What is skewness?",
  "mode": "normal"
}
```

`mode` is optional, defaults to `"normal"`. Other values: `"eli5"`, `"socratic"`.

Response:
```json
{
  "answer": "Skewness measures the asymmetry of a distribution...",
  "sources": ["lecture3.pdf §2", "lecture3.pdf §5"]
}
```

Sources are `filename §chunk_index` strings. The chunk index reflects the order the text appeared in the original document, so §2 is earlier than §10.

**GET `/api/exam`**  
No request body. Returns a `questions` string with 3 numbered questions and difficulty ratings. Returns a plain message if no document is indexed.

**DELETE `/api/documents/{filename}`**  
URL-encode the filename before sending. Returns 404 if not found, 200 on success.

The interactive docs at `/docs` are easier for testing than writing raw requests manually.

---

## Problems I ran into

**Chunk overlap**  
First thing that broke in a way I didn't expect. Without overlap, answers would sometimes be half a sentence because the relevant content was split across a chunk boundary. Took me longer than I'd like to admit to figure out the problem was in chunking and not somewhere in the retrieval or the model. 200 characters of overlap fixed it.

**Socratic mode history**  
The model needs to know what it already asked so it doesn't repeat itself. But you can't keep appending the full conversation to every request or the token count blows up fast. Capping at 6 turns and shifting old ones out was the simplest fix that still works well enough for a normal study session.

**Scanned PDFs silently failing**  
If someone uploads a scanned PDF — the kind where text is an image, not selectable — `pypdf` returns empty text with no error. The app would index nothing and then give completely wrong "I couldn't find information" responses without ever telling the user why. Only discovered this after testing with a few different files. Fixed by raising a 422 with a clear message if no text is extracted.

**Cache key collisions**  
Early version of the cache only hashed context and model, so two different questions on the same document could theoretically return the same cached answer. Fixed by including the query text in the hash. The separator character between fields matters too — without it `"abc" + "def"` and `"ab" + "cdef"` would produce the same hash input.

**ChromaDB state after restart**  
Uploaded files live in memory and disappear on restart, but ChromaDB persists to disk. This created a confusing state where the document library showed empty but the vectors were still there — meaning the app would answer questions from a document you couldn't see. Clearing ChromaDB on every new upload fixed it and also naturally enforces the single-document policy without needing separate logic.

**Stale collection reference**  
Early version held a single collection object at module level. After `clear_database()` was called, that reference sometimes pointed to a deleted collection and the next query would crash. Switched to calling `get_collection()` fresh on every operation, which avoids the stale reference entirely.

---

## Limitations

- One document at a time — uploading a new one replaces the old
- No OCR — scanned or image-based PDFs won't work, needs selectable text
- No authentication — fine for local use, not suitable for public deployment without adding auth
- 20MB file size limit
- Uploaded file bytes don't survive a server restart (ChromaDB index does)
- Cache is local JSON — works fine for single user, wouldn't scale to multiple concurrent users

---

## What I learned

Going in I barely knew what RAG meant. Coming out I understand vector databases, context retrieval, prompt engineering, API integration, and how to wire a full stack Python app together. Had some help from AI along the way for certain parts, but the learning was very much real — a lot of things clicked that just wouldn't have from watching tutorials.

The Scaledown integration was a good example of that. I added it late expecting a minor optimization and it ended up making a real difference to answer quality, which taught me that the stuff between retrieval and generation matters as much as the retrieval itself. The chunking overlap was another one — I'd never have understood why it matters if I hadn't seen answers break without it first.

Building something real is just a different kind of learning.