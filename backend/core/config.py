import os
from dotenv import load_dotenv

load_dotenv()

class Settings:
    SCALEDOWN_API_KEY = os.getenv("SCALEDOWN_API_KEY")
    SCALEDOWN_URL = "https://api.scaledown.xyz/compress/raw/"
    GROQ_API_KEY = os.getenv("GROQ_API_KEY")

settings = Settings()

# validate at startup so missing keys don't cause silent failures later
def validate_settings():
    missing = []
    if not settings.GROQ_API_KEY:
        missing.append("GROQ_API_KEY")
    if not settings.SCALEDOWN_API_KEY:
        missing.append("SCALEDOWN_API_KEY")

    if missing:
        print("\n" + "=" * 60)
        print("⚠️  WARNING: Missing environment variables:")
        for key in missing:
            print(f"   • {key} is not set in your .env file")
        print("\n   Copy .env.example to .env and fill in your keys.")
        print("=" * 60 + "\n")

validate_settings()
