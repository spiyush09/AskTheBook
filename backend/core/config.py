import os
from dotenv import load_dotenv

load_dotenv()

class Settings:
    SCALEDOWN_API_KEY = os.getenv("SCALEDOWN_API_KEY")
    SCALEDOWN_URL = "https://api.scaledown.xyz/compress/raw/"
    GROQ_API_KEY = os.getenv("GROQ_API_KEY")

settings = Settings()
