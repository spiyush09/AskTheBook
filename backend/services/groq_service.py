import os
from groq import Groq
from backend.core.config import settings

async def generate_with_groq(prompt: str, context: str, model: str = "llama-3.3-70b-versatile"):
    """
    Generates response using Groq API (Llama 3).
    """
    try:
        client = Groq(api_key=settings.GROQ_API_KEY)
        
        full_prompt = f"""
        Context:
        {context}
        
        Instruction:
        {prompt}
        """
        
        chat_completion = client.chat.completions.create(
            messages=[
                {
                    "role": "system",
                    "content": "You are a helpful educational AI assistant."
                },
                {
                    "role": "user",
                    "content": full_prompt,
                }
            ],
            model=model,
        )
        return chat_completion.choices[0].message.content
        
    except Exception as e:
        return f"Error Generating Content with Groq: {str(e)}"
