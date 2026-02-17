import shutil
import os
from typing import List
from fastapi import UploadFile
import chromadb
from chromadb.utils import embedding_functions
from pypdf import PdfReader
from docx import Document

# Persistent client — survives server restarts
chroma_client = chromadb.PersistentClient(path="./chroma_db")

# Get or create collection
try:
    collection = chroma_client.get_collection(name="course_materials")
except:
    collection = chroma_client.create_collection(name="course_materials")

def get_indexed_documents() -> list[str]:
    """Returns a list of unique source filenames currently indexed."""
    try:
        results = collection.get(include=["metadatas"])
        sources = list({m["source"] for m in results["metadatas"]})
        return sources
    except:
        return []

def is_collection_empty() -> bool:
    try:
        return collection.count() == 0
    except:
        return True

async def ingest_document(file: UploadFile):
    """
    Reads a PDF or DOCX, chunks it with overlap, and stores in ChromaDB.
    Enforces SINGLE DOCUMENT POLICY: Clears existing DB before adding new file.
    """
    # ── SINGLE DOC POLICY ──
    try:
        clear_database()
    except Exception as e:
        print(f"Warning: Could not clear database: {e}")

    content = ""
    file_location = f"temp_{file.filename}"

    with open(file_location, "wb+") as file_object:
        shutil.copyfileobj(file.file, file_object)

    try:
        if file.filename.endswith(".pdf"):
            reader = PdfReader(file_location)
            for page in reader.pages:
                text = page.extract_text()
                if text:
                    content += text + "\n"
        elif file.filename.endswith(".docx"):
            doc = Document(file_location)
            for para in doc.paragraphs:
                content += para.text + "\n"

        # Chunking with overlap
        chunk_size = 1000
        overlap = 200
        chunks = []
        start = 0
        while start < len(content):
            end = start + chunk_size
            chunks.append(content[start:end])
            start += chunk_size - overlap

        # (No need to remove existing chunks for *this* file, as we cleared everything)

        ids = [f"{file.filename}_{i}" for i in range(len(chunks))]
        metadatas = [{"source": file.filename, "chunk_id": i} for i in range(len(chunks))]

        collection.add(
            documents=chunks,
            metadatas=metadatas,
            ids=ids
        )

        return {
            "status": "success",
            "chunks_processed": len(chunks),
            "filename": file.filename
        }

    finally:
        if os.path.exists(file_location):
            os.remove(file_location)


async def query_documents(query: str, n_results: int = 3):
    """
    Retrieves relevant chunks for a query.
    Returns empty string and empty list if no documents are indexed.
    """
    if is_collection_empty():
        return "", []

    # n_results can't exceed collection size
    count = collection.count()
    n = min(n_results, count)

    results = collection.query(
        query_texts=[query],
        n_results=n
    )

    context = ""
    sources = []
    if results["documents"]:
        for i, doc in enumerate(results["documents"][0]):
            meta = results["metadatas"][0][i]
            context += f"Source ({meta['source']}):\n{doc}\n\n"
            sources.append(meta["source"])

    return context, list(set(sources))


def delete_document(filename: str) -> bool:
    """
    Removes all chunks associated with a specific filename from the collection.
    Returns True if successful, False otherwise.
    """
    try:
        # Find all chunks for this source
        results = collection.get(where={"source": filename})
        if results["ids"]:
            collection.delete(ids=results["ids"])
            return True
        return False
    except Exception as e:
        print(f"Error deleting document {filename}: {e}")
        return False


def clear_database():
    """Wipes the entire collection to enforce single-document policy."""
    try:
        # Check if collection exists and has items
        if collection.count() > 0:
            # Delete all items
            all_ids = collection.get()['ids']
            if all_ids:
                collection.delete(ids=all_ids)
                print("Database cleared for new upload.")
    except Exception as e:
        print(f"Error clearing database: {e}")
