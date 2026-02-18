import hashlib
import json
import os

CACHE_FILE = "response_cache.json"
MAX_CACHE_ENTRIES = 500
EVICT_COUNT = 100  # how many to drop when limit hit

# Include the query text in the key to prevent collisions
# This ensures that if the same context is queried with different questions, we don't return the wrong cached answer
def get_cache_key(query: str, prompt: str, context: str, model: str) -> str:
    """Generate a unique key for the request."""
    raw = f"{query}|{prompt}|{context}|{model}"
    return hashlib.sha256(raw.encode()).hexdigest()

def load_cache():
    if os.path.exists(CACHE_FILE):
        try:
            with open(CACHE_FILE, "r") as f:
                return json.load(f)
        except Exception:
            return {}
    return {}

def save_cache(cache_data):
    try:
        with open(CACHE_FILE, "w") as f:
            json.dump(cache_data, f)
    except Exception as e:
        print(f"Failed to save cache: {e}")

_memory_cache = load_cache()

def get_cached_response(query: str, prompt: str, context: str, model: str):
    key = get_cache_key(query, prompt, context, model)
    return _memory_cache.get(key)

def set_cached_response(query: str, prompt: str, context: str, model: str, response: str):
    global _memory_cache

    # Evict the oldest entries if the cache grows too large
    if len(_memory_cache) >= MAX_CACHE_ENTRIES:
        keys_to_delete = list(_memory_cache.keys())[:EVICT_COUNT]
        for k in keys_to_delete:
            del _memory_cache[k]
        print(f"Cache evicted {EVICT_COUNT} oldest entries.")

    key = get_cache_key(query, prompt, context, model)
    _memory_cache[key] = response
    save_cache(_memory_cache)
