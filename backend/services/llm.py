import httpx
import json
from backend.core.config import settings
from backend.core.cache import get_cached_response, set_cached_response
from backend.services.groq_service import generate_with_groq

async def generate_response(prompt: str, context: str, model: str = "llama-3.3-70b-versatile"):
    """
    Hybrid Pipeline:
    1. Check Cache.
    2. Compress Context using Scaledown API.
    3. Generate Answer using Groq API.
    """
    # 1. Check Cache
    cached = get_cached_response(prompt, context, model)
    if cached:
        print("Returning cached response")
        return cached

    # 2. Compress with Scaledown
    compressed_context = context
    # Only compress if context is long enough to match prompt/cost trade-off
    if len(context) > 500: 
        print("Compressing context with Scaledown...")
        headers = {
            "x-api-key": settings.SCALEDOWN_API_KEY,
            "Content-Type": "application/json"
        }
        
        # Payload for COMPRESSION only
        payload = {
            "context": context,
            "prompt": "Summarize and retain all key technical details for Q&A.", 
            "model": "gpt-4o", # Scaledown uses this internally as reference
            "scaledown": {
                "rate": "auto"
            }
        }
        
        async with httpx.AsyncClient() as client:
            try:
                response = await client.post(settings.SCALEDOWN_URL, json=payload, headers=headers, timeout=60.0)
                if response.status_code == 200:
                    data = response.json()
                    if "results" in data and "compressed_prompt" in data["results"]:
                         compressed_context = data["results"]["compressed_prompt"]
                         print(f"Compressed context from {len(context)} to {len(compressed_context)} chars")
                else:
                    print(f"Scaledown failed ({response.status_code}), using original context.")
            except Exception as e:
                print(f"Scaledown error: {e}, using original context.")

    # 3. Generate with Groq
    print("Generating answer with Groq (Cloud)...")
    final_answer = await generate_with_groq(prompt, compressed_context, model=model)
    
    # 4. Save to Cache
    set_cached_response(prompt, context, model, final_answer)
    
    return final_answer
