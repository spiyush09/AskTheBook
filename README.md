# AskTheBook

A RAG-based study tool I built as a practical challenge in the GenAI4GenZ program by HPE. You upload a PDF or DOCX and ask questions about it in plain English. Answers come only from your document, not from general internet knowledge — which makes it actually useful when you're studying for a specific exam or going through dense course content instead of getting generic answers.

The idea was simple: instead of asking an AI that knows everything, ask one that only knows your material.

## What it does

- Upload a PDF or DOCX (one at a time)
- Ask questions about it in plain English
- Get answers cited back to your document with chunk references
- Three response modes:
  - **Standard** — answers the question directly
  - **ELI5** — gives a simple analogy alongside the technical answer
  - **Study Buddy** — guides you with Socratic questions instead of giving the answer away
- **Exam Predictor** — scans your material and predicts likely exam questions with difficulty ratings

## How it works

When you upload a document, the text gets extracted and split into 1000-character chunks with 200-character overlap (the overlap matters — without it answers get cut off mid-concept). Those chunks go into ChromaDB which stores them as vector embeddings.

When you ask a question, ChromaDB finds the 3 most relevant chunks using semantic similarity and those get sent to the language model along with your question. The model is told to only answer from that context, which keeps it grounded.

Before the chunks go to the LLM they get compressed using Scaledown, which strips noise and redundancy. I added this late and it made a noticeable difference to answer quality.

## Stack

- **FastAPI** — backend
- **ChromaDB** — local vector storage, persists to disk
- **Groq (Llama 3.3 70B)** — language model, fast because of LPU hardware
- **Scaledown** — context compression before sending to the model
- **Vanilla JS and CSS** — frontend, no framework

## Setup

1. Clone the repo

```
git clone https://github.com/spiyush09/AskTheBook.git
cd AskTheBook
```

2. Install dependencies

```
pip install -r requirements.txt
```

3. Copy `.env.example` to `.env` and fill in your API keys

```
GROQ_API_KEY=your_key_here
SCALEDOWN_API_KEY=your_key_here
```

Get a Groq key at [console.groq.com](https://console.groq.com) (free tier works fine).
Get a Scaledown key at [scaledown.xyz](https://scaledown.xyz).

4. Run the app

```
# Windows
run_app.bat

# Mac/Linux
uvicorn backend.main:app --reload
```

5. Open `http://localhost:8000`

## Notes

- Only one document at a time — uploading a new one replaces the old one (you get a confirmation prompt)
- ChromaDB persists on disk so the index survives server restarts, but uploaded files don't
- Scanned/image-based PDFs won't work — needs selectable text, there's no OCR
- Max file size is 20MB
- Repeated questions are served from a local JSON cache instantly

## Folder structure

```
AskTheBook/
├── backend/
│   ├── core/
│   │   ├── cache.py        # response caching
│   │   ├── config.py       # loads env vars
│   │   └── rag.py          # document ingestion and retrieval
│   ├── services/
│   │   ├── features.py     # prompts for each mode
│   │   ├── groq_service.py # Groq API call
│   │   └── llm.py          # cache → compress → generate pipeline
│   └── main.py             # API routes
├── frontend/
│   ├── index.html          # landing page
│   ├── app.html            # main chat UI
│   ├── style.css
│   └── script.js
├── requirements.txt
├── run_app.bat
└── .env.example
```

## What I learned

Going in I barely knew what RAG meant. Coming out I understand vector databases, context retrieval, prompt engineering, API integration, and how to wire a full stack Python app together. Had some help from AI along the way for certain parts, but the learning was very much real. A lot of things clicked that just wouldn't have from watching tutorials — building something real and running into actual bugs is a different kind of learning.