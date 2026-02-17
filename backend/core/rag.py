import shutil
import os
from typing import List
from fastapi import UploadFile
import chromadb
from chromadb.utils import embedding_functions
from pypdf import PdfReader
from docx import Document

# Initialize ChromaDB
chroma_client = chromadb.Client()
collection = chroma_client.create_collection(name="course_materials")

# Use a default embedding function (e.g., all-MiniLM-L6-v2)
# In production, might want a better one or use the LLM's embedding if available.
emb_fn = embedding_functions.DefaultEmbeddingFunction()

async def ingest_document(file: UploadFile):
    """
    Reads a PDF or DOCX, chunks it, and stores in ChromaDB.
    """
    content = ""
    file_location = f"temp_{file.filename}"
    
    # Save temp file
    with open(file_location, "wb+") as file_object:
        shutil.copyfileobj(file.file, file_object)
        
    try:
        if file.filename.endswith(".pdf"):
            reader = PdfReader(file_location)
            for page in reader.pages:
                content += page.extract_text() + "\n"
        elif file.filename.endswith(".docx"):
            doc = Document(file_location)
            for para in doc.paragraphs:
                content += para.text + "\n"
                
        # Simple chunking
        chunks = [content[i:i+1000] for i in range(0, len(content), 1000)]
        ids = [f"{file.filename}_{i}" for i in range(len(chunks))]
        metadatas = [{"source": file.filename, "chunk_id": i} for i in range(len(chunks))]
        
        # Add to Chroma
        collection.add(
            documents=chunks,
            metadatas=metadatas,
            ids=ids
        )
        
        return {"status": "success", "chunks_processed": len(chunks)}
        
    finally:
        if os.path.exists(file_location):
            os.remove(file_location)

async def query_documents(query: str, n_results: int = 3):
    """
    Retrieves relevant chunks for a query.
    """
    results = collection.query(
        query_texts=[query],
        n_results=n_results
    )
    
    # helper to format context
    context = ""
    sources = []
    if results["documents"]:
        for i, doc in enumerate(results["documents"][0]):
            meta = results["metadatas"][0][i]
            context += f"Source ({meta['source']}):\n{doc}\n\n"
            sources.append(meta['source'])
            
    return context, list(set(sources))
