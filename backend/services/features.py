from backend.services.llm import generate_response

async def get_eli5_answer(query: str, context: str):
    prompt = f"""
    You are an expert tutor. Answer the student's question based strictly on the provided context.
    
    Student Question:
    {query}
    
    Task:
    Provide two parts in your answer:
    1. **Techncial Explanation**: A purely academic answer based on the text.
    2. **ELI5 (Explain Like I'm 5)**: A very simple analogy or explanation for a child.
    
    Format:
    [Technical]
    ...
    [ELI5]
    ...
    """
    return await generate_response(prompt, context)

async def get_socratic_tutor(query: str, context: str):
    prompt = f"""
    You are a Socratic tutor. Do NOT answer the question directly.
    Instead, ask a guiding question acting as a hint to help the student find the answer in the context.
    
    Student Question:
    {query}
    """
    return await generate_response(prompt, context)

async def predict_exam_questions(context: str):
    prompt = f"""
    Analyze the provided context and predict 3 potential exam questions.
    Look for keywords like "important", "critical", "remember".
    
    Output format:
    1. Question (Difficulty: Easy/Medium/Hard)
    2. Question ...
    3. Question ...
    """
    return await generate_response(prompt, context)
