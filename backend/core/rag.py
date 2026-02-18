import io
import os
import chromadb
from fastapi import HTTPException
from pypdf import PdfReader
from docx import Document

# Persistent client — survives server restarts
chroma_client = chromadb.PersistentClient(path="./chroma_db")

# Use a helper function to get the collection
# This ensures we always get a fresh reference, which helps avoid errors if the collection is reset
def get_collection():
    try:
        return chroma_client.get_collection(name="course_materials")
    except Exception:
        return chroma_client.create_collection(name="course_materials")


def get_indexed_documents() -> list[str]:
    """Returns a list of unique source filenames currently indexed."""
    try:
        collection = get_collection()
        results = collection.get(include=["metadatas"])
        sources = list({m["source"] for m in results["metadatas"]})
        return sources
    except Exception:
        return []


def is_collection_empty() -> bool:
    try:
        return get_collection().count() == 0
    except Exception:
        return True


async def ingest_document(original_filename: str, contents: bytes):
    """
    Reads a PDF or DOCX from bytes, chunks it with overlap, and stores in ChromaDB.
    Enforces SINGLE DOCUMENT POLICY: Clears existing DB before adding new file.
    """
    # Sanitize the filename to ensure it's safe to use
    safe_filename = os.path.basename(original_filename)

    # ── SINGLE DOC POLICY ──
    try:
        clear_database()
    except Exception as e:
        print(f"Warning: Could not clear database: {e}")

    content = ""

    try:
        if safe_filename.endswith(".pdf"):
            reader = PdfReader(io.BytesIO(contents))
            for page in reader.pages:
                text = page.extract_text()
                if text:
                    content += text + "\n"
        elif safe_filename.endswith(".docx"):
            doc = Document(io.BytesIO(contents))
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

        ids = [f"{safe_filename}_{i}" for i in range(len(chunks))]
        metadatas = [{"source": safe_filename, "chunk_id": i} for i in range(len(chunks))]

        collection = get_collection()

        if not chunks:
            raise HTTPException(status_code=422, detail="Could not extract text from this PDF. It may be a scanned image.")

        collection.add(
            documents=chunks,
            metadatas=metadatas,
            ids=ids
        )

        return {
            "status": "success",
            "chunks_processed": len(chunks),
            "filename": safe_filename
        }

    except Exception as e:
        raise


async def query_documents(query: str, n_results: int = 3):
    """
    Retrieves relevant chunks for a query.
    Returns empty string and empty list if no documents are indexed.
    """
    if is_collection_empty():
        return "", []

    collection = get_collection()
    count = collection.count()
    n = min(n_results, count)

    results = collection.query(
        query_texts=[query],
        n_results=n
    )

    context = ""
    # We include the chunk ID in the source so users know exactly which part of the document was used
    sources = []
    if results["documents"]:
        for i, doc in enumerate(results["documents"][0]):
            meta = results["metadatas"][0][i]
            context += f"Source ({meta['source']}, chunk {meta['chunk_id']}):\n{doc}\n\n"
            sources.append(f"{meta['source']} §{meta['chunk_id']}")

    return context, list(dict.fromkeys(sources))  # deduplicate preserving order


def delete_document(filename: str) -> bool:
    """
    Removes all chunks associated with a specific filename from the collection.
    Returns True if successful, False otherwise.
    """
    try:
        collection = get_collection()
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
        collection = get_collection()
        if collection.count() > 0:
            all_ids = collection.get()['ids']
            if all_ids:
                collection.delete(ids=all_ids)
                print("Database cleared for new upload.")
    except Exception as e:
        print(f"Error clearing database: {e}")