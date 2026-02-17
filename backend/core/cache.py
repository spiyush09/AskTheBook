import hashlib
import json
import os

# Simple file-based cache to persist across restarts
CACHE_FILE = "response_cache.json"

def get_cache_key(prompt: str, context: str, model: str) -> str:
    """Generate a unique key for the request."""
    raw = f"{prompt}|{context}|{model}"
    return hashlib.sha256(raw.encode()).hexdigest()

def load_cache():
    if os.path.exists(CACHE_FILE):
        try:
            with open(CACHE_FILE, "r") as f:
                return json.load(f)
        except:
            return {}
    return {}

def save_cache(cache_data):
    try:
        with open(CACHE_FILE, "w") as f:
            json.dump(cache_data, f)
    except Exception as e:
        print(f"Failed to save cache: {e}")

_memory_cache = load_cache()

def get_cached_response(prompt: str, context: str, model: str):
    key = get_cache_key(prompt, context, model)
    return _memory_cache.get(key)

def set_cached_response(prompt: str, context: str, model: str, response: str):
    key = get_cache_key(prompt, context, model)
    _memory_cache[key] = response
    save_cache(_memory_cache) # Persist immediately for this simple implementation
