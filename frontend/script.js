// ── State ──
let currentMode = 'normal';
// Keep track of the Socratic conversation history
// This allows the AI to remember what it just asked the student
let socraticHistory = [];

// ── DOM ──
const messagesEl = document.getElementById('messages');
const queryInput = document.getElementById('query-input');
const fileInput = document.getElementById('file-upload');
const uploadStatus = document.getElementById('upload-status');
const docListEl = document.getElementById('doc-list');
const clearChatBtn = document.getElementById('clear-chat-btn');
const modeBadge = document.getElementById('mode-badge');
const examBtn = document.querySelector('.exam-btn');

// Only run the initialization code if we are on the main app page
// The 'messages' element doesn't exist on the login/landing page
if (!messagesEl) {
    // Do nothing if we are not on the main app page
} else {
    init();
}

function init() {
    // ── Auto-resize textarea ──
    if (queryInput) {
        queryInput.addEventListener('input', () => {
            queryInput.style.height = 'auto';
            queryInput.style.height = Math.min(queryInput.scrollHeight, 120) + 'px';
        });
    }

    // ── On page load: fetch already-indexed documents ──
    fetchDocuments();

    // ── Mode switching ──
    document.querySelectorAll('.mode-item').forEach(el => {
        el.addEventListener('click', () => {
            const mode = el.dataset.mode;
            const label = el.dataset.label;
            currentMode = mode;
            // Reset Socratic history when mode changes
            socraticHistory = [];
            document.querySelectorAll('.mode-item').forEach(b => b.classList.remove('active'));
            el.classList.add('active');
            if (modeBadge) modeBadge.textContent = label;
            addSystem(`Switched to <strong>${label}</strong> mode`);
        });
    });

    // ── Clear chat ──
    if (clearChatBtn) {
        clearChatBtn.addEventListener('click', () => {
            socraticHistory = [];
            messagesEl.innerHTML = '';
            // Restore variable welcome message after clearing the chat
            addWelcomeMessage();
            addSystem('Chat cleared');
        });
    }

    // ── File upload ──
    if (fileInput) {
        fileInput.addEventListener('change', async (e) => {
            const file = e.target.files[0];
            if (!file) return;

            const currentDocs = await getCurrentDocs();
            if (currentDocs.length > 0) {
                // Warn the user that uploading a new file will replace the existing one
                const confirmed = confirm(
                    `Uploading a new document will replace the current one ("${currentDocs[0]}").\n\nContinue?`
                );
                if (!confirmed) {
                    fileInput.value = '';
                    return;
                }
            }

            uploadStatus.className = 'uploading';
            uploadStatus.textContent = `Indexing ${file.name}…`;

            const formData = new FormData();
            formData.append('file', file);

            try {
                const res = await fetch('/api/upload', { method: 'POST', body: formData });
                const data = await res.json();

                if (res.ok) {
                    uploadStatus.className = 'success';
                    uploadStatus.textContent = `✓ ${data.chunks_processed} chunks indexed`;
                    addSystem(`<strong>${file.name}</strong> is ready — ${data.chunks_processed} chunks indexed. Ask me anything.`);
                    fetchDocuments();
                    socraticHistory = []; // Reset Socratic history on new doc
                } else {
                    throw new Error(data.detail || 'Upload failed');
                }
            } catch (err) {
                uploadStatus.className = 'error';
                uploadStatus.textContent = `✗ ${err.message}`;
            }
        });
    }
}

// ── Fetch documents list ──
async function fetchDocuments() {
    try {
        const res = await fetch('/api/documents');
        const data = await res.json();
        renderDocList(data.documents);
    } catch {
        // Server not ready yet — silent fail
    }
}

async function getCurrentDocs() {
    try {
        const res = await fetch('/api/documents');
        const data = await res.json();
        return data.documents || [];
    } catch {
        return [];
    }
}

function renderDocList(docs) {
    if (!docListEl) return;
    docListEl.innerHTML = '';

    if (!docs || docs.length === 0) {
        docListEl.innerHTML = '<div class="doc-empty">No documents indexed yet</div>';
        return;
    }

    docs.forEach(name => {
        const el = document.createElement('div');
        el.className = 'doc-item';
        const ext = name.split('.').pop().toUpperCase();

        const info = document.createElement('div');
        info.className = 'doc-info';

        const extSpan = document.createElement('span');
        extSpan.className = 'doc-ext';
        extSpan.textContent = ext;

        const nameSpan = document.createElement('span');
        nameSpan.className = 'doc-name';
        nameSpan.title = name;
        nameSpan.textContent = truncate(name, 30);

        info.appendChild(extSpan);
        info.appendChild(nameSpan);

        const deleteBtn = document.createElement('button');
        deleteBtn.className = 'doc-delete-btn';
        deleteBtn.title = 'Delete file';
        deleteBtn.textContent = '×';
        // Safe: no inline onclick, no string injection
        deleteBtn.addEventListener('click', () => deleteDocument(name));

        el.appendChild(info);
        el.appendChild(deleteBtn);
        docListEl.appendChild(el);
    });
}

// Delete the document by calling the backend API
// We encode the filename to handle special characters (like spaces or dots) correctly
async function deleteDocument(filename) {
    if (!confirm(`Are you sure you want to delete "${filename}"?`)) return;

    try {
        const res = await fetch(`/api/documents/${encodeURIComponent(filename)}`, { method: 'DELETE' });
        if (res.ok) {
            fetchDocuments();
            addSystem(`Deleted <strong>${filename}</strong>`);
        } else {
            addSystem(`Could not delete <strong>${filename}</strong>`);
        }
    } catch (e) {
        console.error(e);
        addSystem(`Error deleting <strong>${filename}</strong>`);
    }
}

function truncate(str, max) {
    return str.length > max ? str.slice(0, max - 1) + '…' : str;
}

// ── Key handler ──
function handleKey(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
    }
}

// ── Helpers ──
function getTime() {
    return new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

// Add a friendly welcome message to the chat
// This function is reusable so we can call it when the app starts or when chat is cleared
function addWelcomeMessage() {
    if (!messagesEl) return;
    const wrapper = document.createElement('div');
    wrapper.className = 'msg ai welcome-msg';
    wrapper.innerHTML = `
        <div class="msg-avatar">A</div>
        <div class="msg-body">
            <div class="msg-bubble">
                Welcome. Upload a document on the left, then ask me anything about it. I'll answer strictly
                from your material — no hallucinations, always cited.
                <br><br>
                Switch modes to get ELI5 explanations, Socratic guidance, or exam predictions.
            </div>
            <div class="msg-meta">AskTheBook · ready</div>
        </div>
    `;
    messagesEl.appendChild(wrapper);
    messagesEl.scrollTop = messagesEl.scrollHeight;
}

function addMessage(html, type) {
    if (!messagesEl) return null;
    const wrapper = document.createElement('div');
    wrapper.className = `msg ${type}`;

    if (type === 'system') {
        wrapper.innerHTML = `<div class="msg-bubble">${html}</div>`;
    } else {
        const avatarAI = `<div class="msg-avatar">A</div>`;
        const avatarUser = `<div class="msg-avatar">You</div>`;

        // Format the AI response by stripping out technical tags
        // and identifying the ELI5 (Explain Like I'm 5) sections
        let formatted = html
            .replace(/\*\*\[Technical\]\*\*/g, '<div class="tag-technical">Technical</div>')
            .replace(/\[Technical\]/g, '<div class="tag-technical">Technical</div>')
            .replace(/\[Techncial\]/g, '<div class="tag-technical">Technical</div>')  // typo variant
            .replace(/\[TECHNICAL\]/g, '<div class="tag-technical">Technical</div>')
            .replace(/\*\*\[ELI5\]\*\*/g, '<div class="tag-eli5">ELI5 — Explain Like I\'m 5</div>')
            .replace(/\[ELI5\]/g, '<div class="tag-eli5">ELI5 — Explain Like I\'m 5</div>')
            .replace(/\[ELI5 — Explain Like I'm 5\]/g, '<div class="tag-eli5">ELI5 — Explain Like I\'m 5</div>')
            .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
            .replace(/\n/g, '<br>');

        const meta = type === 'ai'
            ? `AskTheBook · ${getTime()}`
            : `You · ${getTime()}`;

        wrapper.innerHTML = `
            ${type === 'user' ? '' : avatarAI}
            <div class="msg-body">
                <div class="msg-bubble">${formatted}</div>
                <div class="msg-meta">${meta}</div>
            </div>
            ${type === 'user' ? avatarUser : ''}
        `;
    }

    messagesEl.appendChild(wrapper);
    messagesEl.scrollTop = messagesEl.scrollHeight;
    return wrapper;
}

function addSystem(html) {
    addMessage(html, 'system');
}

function addLoading() {
    if (!messagesEl) return;
    const wrapper = document.createElement('div');
    wrapper.className = 'msg ai';
    wrapper.id = 'loading-bubble';
    wrapper.innerHTML = `
        <div class="msg-avatar">A</div>
        <div class="msg-body">
            <div class="msg-bubble">
                <div class="loading-dots">
                    <span></span><span></span><span></span>
                </div>
            </div>
        </div>
    `;
    messagesEl.appendChild(wrapper);
    messagesEl.scrollTop = messagesEl.scrollHeight;
}

function removeLoading() {
    const el = document.getElementById('loading-bubble');
    if (el) el.remove();
}

// ── Send message ──
async function sendMessage() {
    const text = queryInput.value.trim();
    if (!text) return;

    addMessage(text, 'user');
    messagesEl.scrollTop = messagesEl.scrollHeight;
    queryInput.value = '';
    queryInput.style.height = 'auto';
    addLoading();

    // For Socratic mode, we need to send the previous conversation history
    // This gives the AI context so it knows what question it asked previously
    let queryToSend = text;
    if (currentMode === 'socratic' && socraticHistory.length > 0) {
        const historyBlock = socraticHistory
            .map(turn => `[Previous Question]: ${turn.question}\n[Student Answer]: ${turn.answer}`)
            .join('\n\n');
        queryToSend = `${historyBlock}\n\n[New Question]: ${text}`;
    }

    try {
        const res = await fetch('/api/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ query: queryToSend, mode: currentMode })
        });
        const data = await res.json();
        removeLoading();

        const msgEl = addMessage(data.answer, 'ai');

        // Track Socratic history: store the original user question + AI response
        if (currentMode === 'socratic') {
            socraticHistory.push({ question: text, answer: data.answer });
            // Keep history bounded to last 6 turns to avoid token blowout
            if (socraticHistory.length > 6) socraticHistory.shift();
        }

        if (data.sources && data.sources.length > 0) {
            const pill = document.createElement('div');
            pill.className = 'sources-pill';
            pill.textContent = `Sources: ${data.sources.join(' · ')}`;
            msgEl.querySelector('.msg-body').appendChild(pill);
        }
    } catch {
        removeLoading();
        addMessage('Connection error — is the backend running?', 'ai');
    }
}

// ── Exam predictor ──
// Call the Exam Predictor API to generate practice questions
// We disable the button while loading to prevent multiple clicks
async function generateExam() {
    if (examBtn) examBtn.disabled = true;
    addSystem('Generating exam predictions from your material…');
    addLoading();
    try {
        const res = await fetch('/api/exam', { method: 'GET' });
        const data = await res.json();
        removeLoading();
        addMessage(data.questions, 'ai');
    } catch {
        removeLoading();
        addMessage('Could not generate exam questions.', 'ai');
    } finally {
        if (examBtn) examBtn.disabled = false;
    }
}

// ── Hero Scroll ──
function scrollToApp() {
    const app = document.querySelector('.app');
    if (app) {
        app.scrollIntoView({ behavior: 'smooth' });
    }
}