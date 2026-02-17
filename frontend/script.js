// ── State ──
let currentMode = 'normal';

// ── DOM ──
const messagesEl = document.getElementById('messages');
const queryInput = document.getElementById('query-input');
const fileInput = document.getElementById('file-upload');
const uploadStatus = document.getElementById('upload-status');
const docListEl = document.getElementById('doc-list');
const clearChatBtn = document.getElementById('clear-chat-btn');
const modeBadge = document.getElementById('mode-badge');

// ── Auto-resize textarea ──
if (queryInput) {
    queryInput.addEventListener('input', () => {
        queryInput.style.height = 'auto';
        queryInput.style.height = Math.min(queryInput.scrollHeight, 120) + 'px';
    });
}

// ── On page load: fetch already-indexed documents ──
window.addEventListener('DOMContentLoaded', fetchDocuments);

async function fetchDocuments() {
    try {
        const res = await fetch('/api/documents');
        const data = await res.json();
        renderDocList(data.documents);
    } catch {
        // Server not ready yet — silent fail
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
        el.innerHTML = `
            <div class="doc-info">
                <span class="doc-ext">${ext}</span>
                <span class="doc-name" title="${name}">${truncate(name, 30)}</span>
            </div>
            <button class="doc-delete-btn" onclick="deleteDocument('${name}')" title="Delete file">×</button>
        `;
        docListEl.appendChild(el);
    });
}

async function deleteDocument(filename) {
    if (!confirm(`Are you sure you want to delete "${filename}"?`)) return;

    try {
        const res = await fetch(`/api/documents/${filename}`, { method: 'DELETE' });
        if (res.ok) {
            fetchDocuments(); // Refresh list
            addSystem(`Deleted <strong>${filename}</strong>`);
        } else {
            console.error('Failed to delete');
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

// ── Mode switching ──
document.querySelectorAll('.mode-item').forEach(el => {
    el.addEventListener('click', () => {
        const mode = el.dataset.mode;
        const label = el.dataset.label;
        currentMode = mode;
        document.querySelectorAll('.mode-item').forEach(b => b.classList.remove('active'));
        el.classList.add('active');
        if (modeBadge) modeBadge.textContent = label;
        addSystem(`Switched to <strong>${label}</strong> mode`);
    });
});

// ── Clear chat ──
if (clearChatBtn) {
    clearChatBtn.addEventListener('click', () => {
        messagesEl.innerHTML = '';
        addSystem('Chat cleared');
    });
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

function addMessage(html, type) {
    const wrapper = document.createElement('div');
    wrapper.className = `msg ${type}`;

    if (type === 'system') {
        wrapper.innerHTML = `<div class="msg-bubble">${html}</div>`;
    } else {
        const avatarAI = `<div class="msg-avatar">A</div>`;
        const avatarUser = `<div class="msg-avatar">You</div>`;

        let formatted = html
            .replace(/\[Technical\]/g, '<div class="tag-technical">Technical</div>')
            .replace(/\[Techncial\]/g, '<div class="tag-technical">Technical</div>')
            .replace(/\[ELI5\]/g, '<div class="tag-eli5">ELI5 — Explain Like I\'m 5</div>')
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

// ── Upload ──
if (fileInput) {
    fileInput.addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (!file) return;

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
                fetchDocuments(); // Refresh doc list
            } else {
                throw new Error(data.detail || 'Upload failed');
            }
        } catch (err) {
            uploadStatus.className = 'error';
            uploadStatus.textContent = `✗ ${err.message}`;
        }
    });
}

// ── Send message ──
async function sendMessage() {
    const text = queryInput.value.trim();
    if (!text) return;

    addMessage(text, 'user');
    queryInput.value = '';
    queryInput.style.height = 'auto';
    addLoading();

    try {
        const res = await fetch('/api/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ query: text, mode: currentMode })
        });
        const data = await res.json();
        removeLoading();

        const msgEl = addMessage(data.answer, 'ai');

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
async function generateExam() {
    addSystem('Generating exam predictions from your material…');
    addLoading();
    try {
        const res = await fetch('/api/exam', { method: 'POST' });
        const data = await res.json();
        removeLoading();
        addMessage(data.questions, 'ai');
    } catch {
        removeLoading();
        addMessage('Could not generate exam questions.', 'ai');
    }
}

// ── Hero Scroll ──
function scrollToApp() {
    const app = document.querySelector('.app');
    if (app) {
        app.scrollIntoView({ behavior: 'smooth' });
    }
}
