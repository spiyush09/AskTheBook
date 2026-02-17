// State
let currentMode = 'normal';

// DOM Elements
const appInterface = document.getElementById('app-interface');
const fileInput = document.getElementById('file-input');
const uploadStatus = document.getElementById('upload-status');
const chatWindow = document.getElementById('chat-window');
const queryInput = document.getElementById('query-input');

// Smooth Scroll
function scrollToApp() {
    appInterface.scrollIntoView({ behavior: 'smooth' });
    appInterface.classList.add('active');
}

// Mode Select
document.querySelectorAll('.mode-pill').forEach(btn => {
    btn.addEventListener('click', (e) => {
        // Handle "Exam" special case
        if (e.target.dataset.mode === 'exam') {
            generateExam();
            return;
        }

        // Switch Mode
        document.querySelectorAll('.mode-pill').forEach(b => b.classList.remove('active'));
        e.target.classList.add('active');
        currentMode = e.target.dataset.mode;

        addSystemMessage(`Switched to <strong>${currentMode.toUpperCase()}</strong> mode.`);
    });
});

// File Upload
fileInput.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    uploadStatus.innerHTML = `<span style="color:var(--text-muted)">Uploading ${file.name}...</span>`;

    const formData = new FormData();
    formData.append('file', file);

    try {
        const res = await fetch('http://localhost:8000/api/upload', {
            method: 'POST',
            body: formData
        });

        if (res.ok) {
            uploadStatus.innerHTML = `<span style="color:#4ade80">✓ ${file.name} ready for questions</span>`;
            addSystemMessage(`I've read <strong>${file.name}</strong>. Ask me anything about it!`);
        } else {
            throw new Error('Upload failed');
        }
    } catch (err) {
        uploadStatus.innerHTML = `<span style="color:#f87171">✗ Error uploading file</span>`;
        console.error(err);
    }
});

// Chat Logic
function handleKey(e) {
    if (e.key === 'Enter') sendMessage();
}

async function sendMessage() {
    const text = queryInput.value.trim();
    if (!text) return;

    // User Message
    addMessage(text, 'user');
    queryInput.value = '';

    // Loading State
    const loadingId = addLoadingBubble();

    try {
        const res = await fetch('http://localhost:8000/api/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ query: text, mode: currentMode })
        });

        const data = await res.json();

        // Remove loading
        document.getElementById(loadingId).remove();

        // AI Message
        let answer = data.answer;
        if (data.sources && data.sources.length > 0) {
            answer += `\n\n<small style="color:var(--text-muted)">Sources: ${data.sources.join(', ')}</small>`;
        }
        addMessage(answer, 'ai');

    } catch (err) {
        document.getElementById(loadingId).remove();
        addSystemMessage("Error connecting to the AI. Is the server running?");
    }
}

async function generateExam() {
    addMessage("Generating practice exam questions...", 'user');
    const loadingId = addLoadingBubble();

    try {
        const res = await fetch('http://localhost:8000/api/exam', { method: 'POST' });
        const data = await res.json();

        document.getElementById(loadingId).remove();
        addMessage(data.questions, 'ai');
    } catch (err) {
        document.getElementById(loadingId).remove();
        addSystemMessage("Error generating exam.");
    }
}

// UI Helpers
function addMessage(html, type) {
    const div = document.createElement('div');
    div.className = `msg ${type}`;

    // Simple formatting
    let formatted = html.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    formatted = formatted.replace(/\n/g, '<br>');
    formatted = formatted.replace(/\[Techncial Explanation\]/g, '<div style="margin-bottom:0.5rem; color:#a855f7; font-weight:bold">Technical</div>');
    formatted = formatted.replace(/\[ELI5\]/g, '<div style="margin-top:1rem; margin-bottom:0.5rem; color:#ec4899; font-weight:bold">ELI5 Explanation</div>');

    div.innerHTML = formatted;
    chatWindow.appendChild(div);
    chatWindow.scrollTop = chatWindow.scrollHeight;
}

function addSystemMessage(html) {
    const div = document.createElement('div');
    div.className = 'msg ai';
    div.style.background = 'transparent';
    div.style.border = '1px dashed var(--border)';
    div.style.textAlign = 'center';
    div.style.alignSelf = 'center';
    div.innerHTML = html;
    chatWindow.appendChild(div);
    chatWindow.scrollTop = chatWindow.scrollHeight;
}

function addLoadingBubble() {
    const id = 'loading-' + Date.now();
    const div = document.createElement('div');
    div.id = id;
    div.className = 'msg ai';
    div.innerHTML = '<span class="spinner" style="display:inline-block"></span> <span class="spinner" style="display:inline-block; animation-delay:0.2s"></span> <span class="spinner" style="display:inline-block; animation-delay:0.4s"></span>';
    chatWindow.appendChild(div);
    chatWindow.scrollTop = chatWindow.scrollHeight;
    return id;
}
