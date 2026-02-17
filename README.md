# EduRAG Assistant

A RAG-based Educational Content Assistant with adaptive complexity (ELI5, PhD) and Socratic mode.

## Setup

1.  **Install Python Dependencies**:
    ```bash
    pip install -r requirements.txt
    ```

2.  **Configure API Key**:
    - Rename `.env.example` to `.env`.
    - Open `.env` and paste your Scaledown API key:
      ```
      SCALEDOWN_API_KEY=your_actual_key_here
      ```

3.  **Run the Application**:
    - Double click `run_app.bat` (Windows)
    - OR run:
      ```bash
      uvicorn backend.main:app --reload
      ```

4.  **Access the App**:
    - Open your browser to `http://localhost:8000`

## Features
- **Upload**: Drag & drop PDF or DOCX files.
- **Complexity Levels**: Toggle between Standard, ELI5, and PhD.
- **Study Buddy**: Switches to Socratic questioning mode.
- **Exam Predictor**: Generates potential exam questions from your materials.
