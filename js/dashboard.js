let allPosts = [];
let currentUserProfile = null;
let currentUser = null;
let userNotes = [];
let userTasks = [];
let downloadedMaterials = [];
let bookmarkedMaterials = [];

// Timer variables
let timerInterval = null;
let timerSeconds = 25 * 60;
let currentSession = 'focus';
let chatHistory = [];

// Room navigation
const roomsData = {
    study: { title: 'Study Room', desc: 'Your learning materials and resources' },
    notes: { title: 'Note Room', desc: 'Capture your ideas and study notes' },
    books: { title: 'Books Room', desc: 'All available books and resources' },
    downloads: { title: 'Downloads Room', desc: 'Your downloaded materials' },
    todo: { title: 'Plan & To-Do List', desc: 'Organize your tasks and goals' },
    ai: { title: 'AI Tutor', desc: 'Ask questions and get instant answers' },
    profile: { title: 'My Profile', desc: 'Your personal information and stats' }
};

async function initDashboard() {
    showLoading();
    try {
        if (!navigator.onLine) {
            if (loadOfflineData()) {
                hideLoading();
                setupOfflineUI();
                return;
            } else {
                showOfflineMessage();
                hideLoading();
                return;
            }
        }
        
        const session = await checkAuth();
        if (!session) {
            window.location.href = '/login.html';
            return;
        }
        
        currentUser = session.user;
        
        const { data: userProfile, error: profileError } = await window.supabaseClient
            .from('users')
            .select('*')
            .eq('id', session.user.id)
            .single();
        
        if (profileError || !userProfile) {
            const { data: newProfile, error: createError } = await window.supabaseClient
                .from('users')
                .insert({
                    id: session.user.id,
                    email: session.user.email,
                    full_name: session.user.user_metadata?.full_name || session.user.email.split('@')[0],
                    role: 'student',
                    created_at: new Date().toISOString()
                })
                .select()
                .single();
            if (createError) throw createError;
            currentUserProfile = newProfile;
        } else {
            currentUserProfile = userProfile;
        }
        
        loadLocalData();
        updateProfileDisplay();
        await loadMaterials();
        displayNotes();
        displayTasks();
        displayDownloads();
        displayBookmarks();
        updateTodoProgress();
        updateProfileStats();
        updateQuickStats();
        loadTimerData();
        loadStudyStreak();
        loadQuoteOfTheDay();
        loadGoals();
        loadChatHistory();
        setupNavigation();
        
        const logoutBtn = document.getElementById('desktopLogoutBtn');
        if (logoutBtn) logoutBtn.onclick = async () => { await window.supabaseClient.auth.signOut(); window.location.href = '/login.html'; };
        const mobileLogoutBtn = document.getElementById('mobileLogoutBtn');
        if (mobileLogoutBtn) mobileLogoutBtn.onclick = async () => { await window.supabaseClient.auth.signOut(); window.location.href = '/login.html'; };
        
        saveUserForOffline();
    } catch (error) {
        console.error(error);
        showAlert('Error loading dashboard');
    } finally {
        hideLoading();
    }
}

function updateProfileDisplay() {
    const name = currentUserProfile?.full_name || currentUser?.email?.split('@')[0] || 'Student';
    const email = currentUser?.email || 'student@email.com';
    const elements = ['studentFullName', 'profileName', 'desktopStudentName', 'mobileStudentName'];
    elements.forEach(id => { const el = document.getElementById(id); if (el) el.textContent = name; });
    const emailElements = ['studentEmailDisplay', 'profileEmail', 'desktopStudentEmail', 'mobileStudentEmail'];
    emailElements.forEach(id => { const el = document.getElementById(id); if (el) el.textContent = email; });
}

function loadLocalData() {
    const savedNotes = localStorage.getItem(`hitech_notes_${currentUser?.id}`);
    userNotes = savedNotes ? JSON.parse(savedNotes) : [];
    const savedTasks = localStorage.getItem(`hitech_tasks_${currentUser?.id}`);
    if (savedTasks) userTasks = JSON.parse(savedTasks);
    else userTasks = [{ id: Date.now().toString(), text: 'Complete your first lesson', completed: false, createdAt: new Date().toISOString() }];
    const savedDownloads = localStorage.getItem(`hitech_downloads_${currentUser?.id}`);
    downloadedMaterials = savedDownloads ? JSON.parse(savedDownloads) : [];
    const savedBookmarks = localStorage.getItem(`hitech_bookmarks_${currentUser?.id}`);
    bookmarkedMaterials = savedBookmarks ? JSON.parse(savedBookmarks) : [];
    saveTasks();
}

function saveUserForOffline() {
    if (!currentUser) return;
    const userData = { user: currentUser, profile: currentUserProfile, notes: userNotes, tasks: userTasks, downloads: downloadedMaterials, bookmarks: bookmarkedMaterials, timestamp: Date.now() };
    localStorage.setItem('offline_user_data', JSON.stringify(userData));
}

function loadOfflineData() {
    const savedData = localStorage.getItem('offline_user_data');
    if (!savedData) return false;
    const data = JSON.parse(savedData);
    currentUser = data.user;
    currentUserProfile = data.profile;
    userNotes = data.notes || [];
    userTasks = data.tasks || [];
    downloadedMaterials = data.downloads || [];
    bookmarkedMaterials = data.bookmarks || [];
    updateProfileDisplay();
    displayNotes();
    displayTasks();
    displayDownloads();
    displayBookmarks();
    updateProfileStats();
    updateQuickStats();
    updateTodoProgress();
    loadTimerData();
    loadStudyStreak();
    loadQuoteOfTheDay();
    loadGoals();
    loadChatHistory();
    setupNavigation();
    document.getElementById('offlineBadge')?.classList.add('show');
    return true;
}

function setupOfflineUI() {
    const rooms = ['study', 'notes', 'books', 'downloads', 'todo', 'ai', 'profile'];
    rooms.forEach(room => document.getElementById(`${room}Room`)?.classList.add('hidden'));
    document.getElementById('studyRoom').classList.remove('hidden');
    document.getElementById('roomTitle').textContent = 'Study Room (Offline)';
    document.getElementById('roomDescription').textContent = 'You are offline. Your saved notes and tasks are available.';
    document.querySelectorAll('#desktopLogoutBtn, #mobileLogoutBtn').forEach(btn => btn.style.display = 'none');
}

function showOfflineMessage() {
    const main = document.querySelector('.main-content');
    if (main) main.innerHTML = `<div class="flex items-center justify-center min-h-screen"><div class="text-center p-8"><div class="text-6xl mb-4">📡</div><h2 class="text-2xl font-bold mb-2">You're Offline</h2><p class="text-gray-400 mb-4">Please login once while online to use offline mode</p><button onclick="window.location.href='/login.html'" class="px-6 py-2 bg-purple-600 rounded-lg">Go to Login</button></div></div>`;
}

async function loadMaterials() {
    try {
        const { data: posts, error } = await window.supabaseClient.from('posts').select('*').or(`audience.eq.student,audience.eq.all`).order('created_at', { ascending: false });
        if (error) throw error;
        allPosts = posts || [];
        displayStudyMaterials(allPosts);
        displayBooksRoom(allPosts);
    } catch (error) { console.error(error); }
}

function displayStudyMaterials(posts) {
    const container = document.getElementById('studyMaterials');
    if (!container) return;
    if (!posts || posts.length === 0) {
        container.innerHTML = `<div class="col-span-full text-center py-16"><div class="text-6xl mb-4">📚</div><h3 class="text-xl font-bold mb-2">No study materials yet</h3><p class="text-gray-400">Check back later</p></div>`;
        return;
    }
    container.innerHTML = posts.map(post => `
        <div class="glass-card rounded-xl overflow-hidden cursor-pointer group" onclick="downloadMaterial('${post.id}', '${escapeHtml(post.title)}', '${post.file_url}', '${post.type}')">
            ${renderFilePreview(post)}
            <div class="p-5">
                <div class="flex justify-between items-start mb-2">
                    <div class="flex items-center space-x-2">
                        <span class="text-2xl">${getTypeIcon(post.type)}</span>
                        <span class="text-xs px-2 py-1 bg-purple-600/30 rounded-full">${post.type.toUpperCase()}</span>
                    </div>
                    <button onclick="event.stopPropagation(); toggleBookmark('${post.id}', '${escapeHtml(post.title)}', '${post.file_url}', '${post.type}')" class="bookmark-btn p-1 hover:scale-110 transition" data-id="${post.id}">
                        ${isBookmarked(post.id) ? '<svg class="w-5 h-5 fill-yellow-400 text-yellow-400" fill="currentColor" stroke="currentColor" viewBox="0 0 24 24"><path d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z"/></svg>' : '<svg class="w-5 h-5 text-gray-400 hover:text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z"/></svg>'}
                    </button>
                </div>
                <h3 class="text-lg font-bold mb-2 group-hover:text-purple-400 transition">${escapeHtml(post.title)}</h3>
                ${post.description ? `<p class="text-gray-300 text-sm mb-3 line-clamp-2">${escapeHtml(post.description)}</p>` : ''}
                <div class="flex flex-wrap justify-between items-center gap-2 mt-3 pt-3 border-t border-white/10">
                    <button onclick="event.stopPropagation(); downloadMaterial('${post.id}', '${escapeHtml(post.title)}', '${post.file_url}', '${post.type}')" class="text-purple-400 hover:text-purple-300 text-sm flex items-center gap-1"><svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/></svg> Download</button>
                    <button onclick="event.stopPropagation(); explainWithAI('${escapeHtml(post.title)}', '${escapeHtml(post.description || '')}')" class="text-xs text-purple-400 hover:text-purple-300 flex items-center gap-1">🤖 Explain with AI</button>
                    <span class="text-xs text-gray-500">Click to view</span>
                </div>
            </div>
        </div>
    `).join('');
}

function displayBooksRoom(posts) {
    const container = document.getElementById('booksList');
    if (!container) return;
    const pdfPosts = posts.filter(p => p.type === 'pdf' || p.type === 'file');
    if (pdfPosts.length === 0) {
        container.innerHTML = `<div class="col-span-full text-center py-16"><div class="text-6xl mb-4">📖</div><h3 class="text-xl font-bold mb-2">No books available</h3></div>`;
        return;
    }
    container.innerHTML = pdfPosts.map(post => `
        <div class="glass-card rounded-xl overflow-hidden cursor-pointer" onclick="downloadMaterial('${post.id}', '${escapeHtml(post.title)}', '${post.file_url}', '${post.type}')">
            <div class="h-48 bg-gradient-to-br from-purple-600 to-pink-600 flex items-center justify-center"><svg class="w-16 h-16 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"/></svg></div>
            <div class="p-5"><h3 class="font-bold mb-2">${escapeHtml(post.title)}</h3>${post.description ? `<p class="text-gray-400 text-sm mb-3">${escapeHtml(post.description.substring(0, 100))}</p>` : ''}<div class="flex justify-between items-center"><span class="text-xs text-purple-400">PDF Document</span><button onclick="event.stopPropagation(); downloadMaterial('${post.id}', '${escapeHtml(post.title)}', '${post.file_url}', '${post.type}')" class="text-purple-400 hover:text-purple-300">Download →</button></div></div>
        </div>
    `).join('');
}

function renderFilePreview(post) {
    if (post.type === 'image') return `<img src="${post.file_url}" class="w-full h-48 object-cover group-hover:scale-105 transition duration-500" alt="${post.title}">`;
    if (post.type === 'video') return `<div class="video-wrapper"><video class="w-full h-full object-cover" controls><source src="${post.file_url}"></video></div>`;
    return `<div class="h-48 bg-gradient-to-br from-purple-600 to-pink-600 flex items-center justify-center"><svg class="w-16 h-16 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z"/></svg></div>`;
}

function getTypeIcon(type) { const icons = { 'image': '🖼️', 'video': '🎥', 'pdf': '📄', 'file': '📁' }; return icons[type] || '📁'; }
function isBookmarked(id) { return bookmarkedMaterials.some(b => b.id === id); }

function toggleBookmark(id, title, url, type) {
    const idx = bookmarkedMaterials.findIndex(b => b.id === id);
    if (idx === -1) bookmarkedMaterials.push({ id, title, url, type, addedAt: new Date().toISOString() });
    else bookmarkedMaterials.splice(idx, 1);
    localStorage.setItem(`hitech_bookmarks_${currentUser?.id}`, JSON.stringify(bookmarkedMaterials));
    displayBookmarks();
    displayStudyMaterials(allPosts);
    if (currentUser) saveUserForOffline();
}

function displayBookmarks() {
    const container = document.getElementById('bookmarksList');
    if (!container) return;
    if (bookmarkedMaterials.length === 0) { container.innerHTML = `<div class="text-center py-8 text-gray-400"><p>No bookmarks yet.</p></div>`; return; }
    container.innerHTML = bookmarkedMaterials.map(b => `
        <div class="glass p-4 rounded-xl flex justify-between items-center">
            <div class="flex items-center space-x-3 flex-1"><span class="text-2xl">${getTypeIcon(b.type)}</span><div class="flex-1"><h4 class="font-bold">${escapeHtml(b.title)}</h4><div class="text-xs text-gray-500">Saved: ${new Date(b.addedAt).toLocaleDateString()}</div></div></div>
            <div class="flex space-x-2"><a href="${b.url}" target="_blank" class="text-purple-400 p-2"><svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/><path d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/></svg></a><button onclick="toggleBookmark('${b.id}', '${escapeHtml(b.title)}', '${b.url}', '${b.type}')" class="text-red-400 p-2"><svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg></button></div>
        </div>
    `).join('');
}

window.downloadMaterial = function(id, title, url, type) {
    if (!navigator.onLine) { showAlert('Offline: Cannot download'); return; }
    if (!downloadedMaterials.some(m => m.id === id)) {
        downloadedMaterials.unshift({ id, title, url, type, downloadedAt: new Date().toISOString() });
        saveDownloads();
        displayDownloads();
        updateProfileStats();
        updateQuickStats();
    }
    window.open(url, '_blank');
    if (currentUser) saveUserForOffline();
};

// ============ AI TUTOR (SECURE VIA NETLIFY FUNCTION) ============

async function callGeminiAPI(question) {
    const res = await fetch('/.netlify/functions/ai-tutor', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question })
    });
    if (!res.ok) { const err = await res.json(); throw new Error(err.error || 'API error'); }
    const data = await res.json();
    return data.answer;
}

function loadChatHistory() {
    const saved = localStorage.getItem(`hitech_ai_chat_${currentUser?.id}`);
    chatHistory = saved ? JSON.parse(saved) : [];
    displayChatMessages();
}

function saveChatHistory() { localStorage.setItem(`hitech_ai_chat_${currentUser?.id}`, JSON.stringify(chatHistory)); }

function displayChatMessages() {
    const container = document.getElementById('chatMessages');
    if (!container) return;
    if (chatHistory.length === 0) {
        container.innerHTML = `<div class="glass rounded-xl p-3"><div class="flex items-start gap-2"><span class="text-xl">🤖</span><div><div class="font-semibold text-purple-400">AI Tutor</div><div class="text-sm text-gray-300">Hi! Ask me anything about your studies!</div></div></div></div>`;
        return;
    }
    container.innerHTML = chatHistory.map(msg => `
        <div class="${msg.role === 'user' ? 'bg-purple-600/20' : 'glass'} rounded-xl p-3">
            <div class="flex items-start gap-2">
                <span class="text-xl">${msg.role === 'user' ? '👤' : '🤖'}</span>
                <div><div class="font-semibold ${msg.role === 'user' ? 'text-purple-400' : 'text-blue-400'}">${msg.role === 'user' ? 'You' : 'AI Tutor'}</div><div class="text-sm text-gray-300 whitespace-pre-wrap">${msg.content}</div></div>
            </div>
        </div>
    `).join('');
    container.scrollTop = container.scrollHeight;
}

async function sendMessage() {
    const input = document.getElementById('chatInput');
    const message = input.value.trim();
    if (!message) return;
    chatHistory.push({ role: 'user', content: message, timestamp: Date.now() });
    saveChatHistory();
    displayChatMessages();
    input.value = '';
    const container = document.getElementById('chatMessages');
    const typingDiv = document.createElement('div');
    typingDiv.className = 'glass rounded-xl p-3';
    typingDiv.id = 'typingIndicator';
    typingDiv.innerHTML = `<div class="flex items-start gap-2"><span class="text-xl">🤖</span><div><div class="font-semibold text-blue-400">AI Tutor</div><div class="typing-indicator flex gap-1 mt-1"><span></span><span></span><span></span></div></div></div>`;
    container.appendChild(typingDiv);
    container.scrollTop = container.scrollHeight;
    try {
        const answer = await callGeminiAPI(message);
        document.getElementById('typingIndicator')?.remove();
        chatHistory.push({ role: 'assistant', content: answer, timestamp: Date.now() });
        saveChatHistory();
        displayChatMessages();
    } catch (error) {
        document.getElementById('typingIndicator')?.remove();
        chatHistory.push({ role: 'assistant', content: 'Sorry, I encountered an error. Please try again.', timestamp: Date.now() });
        saveChatHistory();
        displayChatMessages();
        showAlert('AI Error: ' + error.message);
    }
}

function quickQuestion(q) { document.getElementById('chatInput').value = q; sendMessage(); }
function clearChatHistory() { if (confirm('Clear chat?')) { chatHistory = []; saveChatHistory(); displayChatMessages(); } }

async function explainWithAI(title, description) {
    const aiNav = document.querySelector('.nav-item[data-room="ai"]');
    if (aiNav) aiNav.click();
    setTimeout(async () => {
        document.getElementById('chatInput').value = `Explain this material:\nTitle: ${title}\n${description ? `Description: ${description}` : ''}`;
        await sendMessage();
    }, 300);
}

// ============ NOTES, TASKS, DOWNLOADS, STATS ============

function displayNotes() {
    const container = document.getElementById('notesList');
    if (!container) return;
    if (userNotes.length === 0) { container.innerHTML = `<div class="text-center py-8 text-gray-400"><p>No notes yet. Click "New Note"</p></div>`; return; }
    container.innerHTML = userNotes.map(note => `
        <div class="glass p-4 rounded-xl todo-item"><div class="flex justify-between items-start"><div class="flex-1"><h4 class="font-bold mb-1">${escapeHtml(note.title)}</h4><p class="text-gray-400 text-sm">${escapeHtml(note.content.substring(0, 100))}${note.content.length > 100 ? '...' : ''}</p><div class="text-xs text-gray-500 mt-2">${new Date(note.createdAt).toLocaleDateString()}</div></div><button onclick="deleteNote('${note.id}')" class="text-red-400 ml-4"><svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg></button></div></div>
    `).join('');
}

window.createNewNote = () => { document.getElementById('noteModal').classList.remove('hidden'); document.getElementById('noteTitle').value = ''; document.getElementById('noteContent').value = ''; };
window.saveNote = () => {
    const title = document.getElementById('noteTitle').value, content = document.getElementById('noteContent').value;
    if (!title || !content) { showAlert('Please enter both'); return; }
    userNotes.unshift({ id: Date.now().toString(), title, content, createdAt: new Date().toISOString() });
    saveNotes(); displayNotes(); closeNoteModal(); updateProfileStats(); updateQuickStats(); if (currentUser) saveUserForOffline();
};
window.deleteNote = (id) => { if (confirm('Delete?')) { userNotes = userNotes.filter(n => n.id !== id); saveNotes(); displayNotes(); updateProfileStats(); updateQuickStats(); if (currentUser) saveUserForOffline(); } };
window.closeNoteModal = () => document.getElementById('noteModal').classList.add('hidden');

function displayTasks() {
    const container = document.getElementById('todoList');
    if (!container) return;
    if (userTasks.length === 0) { container.innerHTML = `<div class="text-center py-8 text-gray-400"><p>No tasks yet. Add your first task!</p></div>`; return; }
    container.innerHTML = userTasks.map(task => `
        <div class="glass p-4 rounded-xl todo-item"><div class="flex items-center space-x-3"><input type="checkbox" ${task.completed ? 'checked' : ''} onchange="toggleTask('${task.id}')" class="w-5 h-5 rounded border-gray-600 text-purple-600"><span class="flex-1 ${task.completed ? 'line-through text-gray-500' : 'text-white'}">${escapeHtml(task.text)}</span><button onclick="deleteTask('${task.id}')" class="text-red-400"><svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg></button></div></div>
    `).join('');
}

window.addNewTask = () => { const text = prompt('Enter task:'); if (text?.trim()) { userTasks.push({ id: Date.now().toString(), text: text.trim(), completed: false, createdAt: new Date().toISOString() }); saveTasks(); displayTasks(); updateTodoProgress(); updateProfileStats(); updateQuickStats(); if (currentUser) saveUserForOffline(); } };
window.toggleTask = (id) => { const task = userTasks.find(t => t.id === id); if (task) { task.completed = !task.completed; saveTasks(); displayTasks(); updateTodoProgress(); updateProfileStats(); updateQuickStats(); if (currentUser) saveUserForOffline(); } };
window.deleteTask = (id) => { if (confirm('Delete task?')) { userTasks = userTasks.filter(t => t.id !== id); saveTasks(); displayTasks(); updateTodoProgress(); updateProfileStats(); updateQuickStats(); if (currentUser) saveUserForOffline(); } };

function updateTodoProgress() {
    const total = userTasks.length, completed = userTasks.filter(t => t.completed).length, percent = total === 0 ? 0 : Math.round((completed / total) * 100);
    document.getElementById('todoProgress').textContent = percent;
    document.getElementById('todoProgressBar').style.width = `${percent}%`;
}

function displayDownloads() {
    const container = document.getElementById('downloadsList');
    if (!container) return;
    if (downloadedMaterials.length === 0) { container.innerHTML = `<div class="text-center py-8 text-gray-400"><p>No downloads yet.</p></div>`; return; }
    container.innerHTML = downloadedMaterials.map(d => `
        <div class="glass p-4 rounded-xl flex justify-between items-center"><div class="flex items-center space-x-3"><span class="text-2xl">${getTypeIcon(d.type)}</span><div><h4 class="font-bold">${escapeHtml(d.title)}</h4><div class="text-xs text-gray-500">Downloaded: ${new Date(d.downloadedAt).toLocaleDateString()}</div></div></div><a href="${d.url}" target="_blank" class="text-purple-400"><svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/><path d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/></svg></a></div>
    `).join('');
}

function saveNotes() { localStorage.setItem(`hitech_notes_${currentUser?.id}`, JSON.stringify(userNotes)); }
function saveTasks() { localStorage.setItem(`hitech_tasks_${currentUser?.id}`, JSON.stringify(userTasks)); }
function saveDownloads() { localStorage.setItem(`hitech_downloads_${currentUser?.id}`, JSON.stringify(downloadedMaterials)); }

function updateProfileStats() {
    document.getElementById('studyStats').textContent = allPosts.length;
    document.getElementById('notesStats').textContent = userNotes.length;
    document.getElementById('tasksStats').textContent = userTasks.filter(t => t.completed).length;
    document.getElementById('downloadsStats').textContent = downloadedMaterials.length;
}

function updateQuickStats() {
    const focusData = JSON.parse(localStorage.getItem(`hitech_focus_${currentUser?.id}`) || '{"weekly":0}');
    document.getElementById('quickStudyTime').textContent = `${focusData.weekly || 0} mins`;
    document.getElementById('quickTasksDone').textContent = userTasks.filter(t => t.completed).length;
    document.getElementById('quickGoals').textContent = userTasks.filter(t => t.completed).length;
}

// Timer functions (simplified, keep existing logic)
function loadTimerData() { const fd = JSON.parse(localStorage.getItem(`hitech_focus_${currentUser?.id}`) || '{}'); document.getElementById('todayFocusTime').textContent = fd.today || 0; document.getElementById('weeklyFocusTime').textContent = fd.weekly || 0; }
function updateTimerDisplay() { const m = Math.floor(timerSeconds / 60), s = timerSeconds % 60; document.getElementById('timerDisplay').textContent = `${m.toString().padStart(2,'0')}:${s.toString().padStart(2,'0')}`; }
window.startTimer = function() { if (timerInterval) return; timerInterval = setInterval(() => { if (timerSeconds > 0) timerSeconds--; else { clearInterval(timerInterval); timerInterval = null; if (currentSession === 'focus') { addFocusTime(25); showAlert('Break time!', false); currentSession = 'break'; timerSeconds = 5*60; updateTimerDisplay(); startTimer(); } else { showAlert('Focus time!', false); currentSession = 'focus'; timerSeconds = 25*60; updateTimerDisplay(); } } updateTimerDisplay(); }, 1000); };
window.pauseTimer = function() { if (timerInterval) { clearInterval(timerInterval); timerInterval = null; } };
window.resetTimer = function() { pauseTimer(); currentSession = 'focus'; timerSeconds = 25*60; updateTimerDisplay(); };
function addFocusTime(minutes) { let fd = JSON.parse(localStorage.getItem(`hitech_focus_${currentUser?.id}`) || '{"today":0,"weekly":0,"streak":0,"studiedDates":{}}'); const today = new Date().toDateString(); fd.today = (fd.today||0)+minutes; fd.weekly = (fd.weekly||0)+minutes; const last = fd.lastDate ? new Date(fd.lastDate) : null; const now = new Date(); if (last) { const diff = Math.floor((now - last)/(1000*60*60*24)); fd.streak = diff === 1 ? (fd.streak||0)+1 : 1; } else fd.streak = 1; fd.lastDate = now.toISOString(); fd.studiedDates[today] = true; localStorage.setItem(`hitech_focus_${currentUser?.id}`, JSON.stringify(fd)); document.getElementById('todayFocusTime').textContent = fd.today; document.getElementById('weeklyFocusTime').textContent = fd.weekly; document.getElementById('studyStreak').textContent = fd.streak; generateCalendar(fd); updateQuickStats(); if (currentUser) saveUserForOffline(); }
window.openTimer = function() { document.getElementById('timerModal').classList.remove('hidden'); loadTimerData(); updateTimerDisplay(); };
window.closeTimerModal = function() { document.getElementById('timerModal').classList.add('hidden'); pauseTimer(); };
function loadStudyStreak() { const fd = JSON.parse(localStorage.getItem(`hitech_focus_${currentUser?.id}`) || '{"studiedDates":{},"streak":0}'); document.getElementById('studyStreak').textContent = fd.streak||0; generateCalendar(fd); }
function generateCalendar(fd) { const container = document.getElementById('streakCalendar'); if (!container) return; const today = new Date(); const days = []; for (let i=29; i>=0; i--) { const d = new Date(today); d.setDate(today.getDate()-i); days.push(d); } const studied = fd.studiedDates || {}; container.innerHTML = `<div class="grid grid-cols-7 gap-2 text-center">${['S','M','T','W','T','F','S'].map(day=>`<div class="text-xs text-gray-500 font-bold">${day}</div>`).join('')}${days.map(date=>{ const studiedFlag = studied[date.toDateString()]; const isToday = date.toDateString()===today.toDateString(); return `<div class="aspect-square flex items-center justify-center"><div class="w-8 h-8 rounded-full flex items-center justify-center text-xs ${studiedFlag ? 'bg-purple-600 text-white' : 'bg-gray-800 text-gray-500'} ${isToday ? 'ring-2 ring-purple-400' : ''}">${date.getDate()}</div></div>`; }).join('')}</div>`; }

const quotes = [{ text:"The future belongs to those who learn more skills.", author:"Robert Greene"},{ text:"Education is the most powerful weapon.", author:"Nelson Mandela"},{ text:"Learning never exhausts the mind.", author:"Leonardo da Vinci"}];
function loadQuoteOfTheDay() { const today = new Date().toDateString(); const saved = localStorage.getItem('hitech_quote_date'); if (saved === today) displayQuote(JSON.parse(localStorage.getItem('hitech_quote_text'))); else { const q = quotes[Math.floor(Math.random()*quotes.length)]; localStorage.setItem('hitech_quote_date', today); localStorage.setItem('hitech_quote_text', JSON.stringify(q)); displayQuote(q); } }
function displayQuote(q) { const el = document.getElementById('quoteOfDay'); if (el) el.innerHTML = `<div class="text-lg italic">"${q.text}"</div><div class="text-sm text-purple-400 mt-2">— ${q.author}</div>`; }
function loadGoals() { const goal = localStorage.getItem(`hitech_goal_${currentUser?.id}`); if (goal) document.getElementById('weeklyGoal').value = parseInt(goal); updateGoalProgress(); }
window.setWeeklyGoal = function() { const goal = parseInt(document.getElementById('weeklyGoal').value) || 5; localStorage.setItem(`hitech_goal_${currentUser?.id}`, goal); updateGoalProgress(); showAlert(`Goal set to ${goal} materials`, false); if (currentUser) saveUserForOffline(); };
function updateGoalProgress() { const goal = parseInt(localStorage.getItem(`hitech_goal_${currentUser?.id}`) || '5'); const progress = 0; document.getElementById('goalProgress').style.width = '0%'; document.getElementById('goalProgressText').textContent = `0/${goal} materials`; }

function setupNavigation() {
    const navItems = document.querySelectorAll('.nav-item');
    const rooms = ['study','notes','books','downloads','todo','ai','profile'];
    navItems.forEach(item => {
        const room = item.dataset.room;
        if (!room) return;
        item.addEventListener('click', () => {
            navItems.forEach(nav => nav.classList.remove('active'));
            item.classList.add('active');
            rooms.forEach(r => document.getElementById(`${r}Room`)?.classList.add('hidden'));
            document.getElementById(`${room}Room`)?.classList.remove('hidden');
            const titleEl = document.getElementById('roomTitle'), descEl = document.getElementById('roomDescription');
            if (titleEl && descEl && roomsData[room]) { titleEl.textContent = roomsData[room].title; descEl.textContent = roomsData[room].desc; }
        });
    });
}

function escapeHtml(text) { if (!text) return ''; const div = document.createElement('div'); div.textContent = text; return div.innerHTML; }

initDashboard();
