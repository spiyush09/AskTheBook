@echo off
echo Starting AskTheBook(EduRAG Assistant)...
echo Please ensure you have added your API KEY to .env file!
echo.
pip install -r requirements.txt
start http://localhost:8000
python -m uvicorn backend.main:app --reload
pause
