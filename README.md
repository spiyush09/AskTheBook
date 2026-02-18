# AskTheBook

A RAG-based study tool I built for my final project. You upload a PDF or DOCX file and then ask questions about it. The answers come only from your document, not from general internet knowledge, so it's actually useful for studying specific course material.

## What it does

- Upload a PDF or DOCX (one at a time)
- Ask questions in plain English
- Get answers cited back to your document
- Three response modes:
  - Standard — just answers the question directly
  - ELI5 — gives a simple analogy alongside the technical answer
  - Study Buddy — guides you with questions instead of giving the answer away (Socratic method)
- Exam Predictor — looks at your material and guesses likely exam questions

## How it works

When you upload a document, it gets split into chunks and stored in a local vector database (ChromaDB). When you ask a question, the most relevant chunks are retrieved and sent to the language model along with your question. The model can only answer using that context, which is what keeps it grounded.

The context gets compressed using Scaledown before going to the LLM, which helps keep costs down and improves response quality.

## Stack

- FastAPI — backend
- ChromaDB — vector storage (runs locally)
- Groq (Llama 3) — language model
- Scaledown — context compression
- Vanilla JS and CSS — frontend, no framework

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

3. Add your API keys — copy `.env.example` to `.env` and fill in:

```
GROQ_API_KEY=your_key_here
SCALEDOWN_API_KEY=your_key_here
```

4. Run the app

```
# Windows
run_app.bat

# Or manually
uvicorn backend.main:app --reload
```

5. Open `http://localhost:8000` in your browser

## Notes

- Only one document at a time — uploading a new one replaces the old one
- Document storage is local only, so if the server restarts the uploads are cleared but ChromaDB persists on disk
- Scanned PDFs (image-based) won't work since there's no OCR — needs a text-based PDF
- Max file size is 20MB

## What I learned

This was my first time building a full RAG pipeline from scratch. The trickiest parts were getting the chunking overlap right so context doesn't get cut off mid-sentence, and handling the Socratic mode which needs to remember the conversation history without sending too much text to the model each time.