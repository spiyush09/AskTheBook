from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from backend.core.config import settings
from backend.core.rag import ingest_document, query_documents, get_indexed_documents, is_collection_empty, delete_document
from backend.services.features import get_standard_answer, get_eli5_answer, get_socratic_tutor, predict_exam_questions

app = FastAPI(title="AskTheBook")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class ChatRequest(BaseModel):
    query: str
    mode: str = "normal"

@app.get("/api/health")
async def health_check():
    return {"status": "ok"}

@app.get("/api/documents")
async def get_documents():
    """Returns list of currently indexed documents."""
    docs = get_indexed_documents()
    return {"documents": docs}

@app.post("/api/upload")
async def upload_file(file: UploadFile = File(...)):
    if not (file.filename.endswith(".pdf") or file.filename.endswith(".docx")):
        raise HTTPException(status_code=400, detail="Only PDF and DOCX files are supported.")
    try:
        result = await ingest_document(file)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.delete("/api/documents/{filename}")
async def delete_document_endpoint(filename: str):
    # Determine if synchronous or asynchronous
    # content is available
    if await is_collection_empty():
         raise HTTPException(status_code=404, detail="No documents found")
    
    # Since delete_document is sync, run it directly or in threadpool if needed
    # For now assuming simple sync execution is fine for this lightweight op
    try:
        success = delete_document(filename)
        if success:
            return {"status": "success", "message": f"Deleted {filename}"}
        else:
             raise HTTPException(status_code=404, detail="Document not found")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/chat")
async def chat_endpoint(request: ChatRequest):
    # Guard: no documents uploaded yet
    if is_collection_empty():
        return {
            "answer": "No documents are indexed yet. Please upload a PDF or DOCX file first.",
            "sources": []
        }

    context, sources = await query_documents(request.query)

    if not context:
        return {
            "answer": "I couldn't find relevant information in your documents for that question.",
            "sources": []
        }

    if request.mode == "eli5":
        response = await get_eli5_answer(request.query, context)
    elif request.mode == "socratic":
        response = await get_socratic_tutor(request.query, context)
    else:
        response = await get_standard_answer(request.query, context)

    return {"answer": response, "sources": sources}

@app.post("/api/exam")
async def exam_endpoint():
    if is_collection_empty():
        return {"questions": "No documents indexed yet. Please upload a file first."}

    context, _ = await query_documents("important concepts key terms definitions summary conclusion", n_results=5)
    response = await predict_exam_questions(context)
    return {"questions": response}

app.mount("/", StaticFiles(directory="frontend", html=True), name="static")
