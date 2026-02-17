from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional
from backend.core.config import settings
from backend.core.rag import ingest_document, query_documents
from backend.services.features import get_eli5_answer, get_socratic_tutor, predict_exam_questions

app = FastAPI(title="EduRAG Assistant")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class ChatRequest(BaseModel):
    query: str
    mode: str = "normal"  # normal, eli5, socratic
    
class ExamRequest(BaseModel):
    context_id: str = "default" # simplified for now

# Mount static files (Frontend) - moved to end to avoid blocking API
# app.mount("/", StaticFiles(directory="frontend", html=True), name="static")

@app.get("/api/health")
async def health_check():
    return {"status": "ok"}

@app.post("/api/upload")
async def upload_file(file: UploadFile = File(...)):
    try:
        result = await ingest_document(file)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/chat")
async def chat_endpoint(request: ChatRequest):
    # 1. Retrieve Context
    context, sources = await query_documents(request.query)
    
    if not context:
        return {"answer": "I couldn't find any relevant information in your uploaded documents.", "sources": []}
        
    # 2. Generate Response based on Mode
    if request.mode == "eli5":
        response = await get_eli5_answer(request.query, context)
    elif request.mode == "socratic":
        response = await get_socratic_tutor(request.query, context)
    else:
        # Default/Normal mode
        # Re-using eli5 function for now as it includes technical too, or just basic RAG
        response = await get_eli5_answer(request.query, context) 

    return {"answer": response, "sources": sources}

@app.post("/api/exam")
async def exam_endpoint():
    # In a real app, we'd query the whole doc or random chunks.
    # For now, let's just query for "important concepts" to get context
    context, _ = await query_documents("important concepts summary conclusion")
    response = await predict_exam_questions(context)
    return {"questions": response}

app.mount("/", StaticFiles(directory="frontend", html=True), name="static")
