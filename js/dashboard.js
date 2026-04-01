let allPosts = [];
let currentUserProfile = null;
let currentUser = null;
let userNotes = [];
let userTasks = [];
let downloadedMaterials = [];

// Room navigation
const rooms = {
    study: { title: 'Study Room', description: 'Your learning materials and resources', icon: '📚' },
    notes: { title: 'Note Room', description: 'Capture your ideas and study notes', icon: '📝' },
    books: { title: 'Books Room', description: 'All available books and resources', icon: '📖' },
    downloads: { title: 'Downloads Room', description: 'Your downloaded materials', icon: '⬇️' },
    todo: { title: 'Plan & To-Do List', description: 'Organize your tasks and goals', icon: '✅' },
    profile: { title: 'My Profile', description: 'Your personal information and stats', icon: '👤' }
};

async function initDashboard() {
    showLoading();
    
    try {
        const session = await checkAuth();
        if (!session) return;
        
        currentUser = session.user;
        
        // Get user profile
        const { data: userProfile, error: profileError } = await window.supabaseClient
            .from('users')
            .select('*')
            .eq('id', session.user.id)
            .single();
        
        if (profileError) {
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
        
        // Load local storage data
        loadLocalData();
        
        // Display profile info
        document.getElementById('studentFullName').textContent = currentUserProfile.full_name || 'Student';
        document.getElementById('studentEmailDisplay').textContent = currentUser.email;
        document.getElementById('profileName').textContent = currentUserProfile.full_name || 'Student';
        document.getElementById('profileEmail').textContent = currentUser.email;
        
        // Load materials
        await loadMaterials();
        
        // Load notes
        loadNotes();
        
        // Load tasks
        loadTasks();
        
        // Load downloads
        loadDownloads();
        
        // Setup navigation
        setupNavigation();
        
        // Update stats
        updateProfileStats();
        
        // Setup logout
        const logoutBtn = document.getElementById('logoutBtn');
        if (logoutBtn) {
            logoutBtn.onclick = async () => {
                showLoading();
                await window.supabaseClient.auth.signOut();
                window.location.href = '/login.html';
            };
        }
        
    } catch (error) {
        console.error('Dashboard error:', error);
        showAlert('Error loading dashboard');
    } finally {
        hideLoading();
    }
}

function loadLocalData() {
    // Load notes from localStorage
    const savedNotes = localStorage.getItem(`hitech_notes_${currentUser?.id}`);
    if (savedNotes) {
        userNotes = JSON.parse(savedNotes);
    } else {
        userNotes = [];
    }
    
    // Load tasks from localStorage
    const savedTasks = localStorage.getItem(`hitech_tasks_${currentUser?.id}`);
    if (savedTasks) {
        userTasks = JSON.parse(savedTasks);
    } else {
        // Add sample tasks
        userTasks = [
            { id: Date.now(), text: 'Complete the programming assignment', completed: false, createdAt: new Date() },
            { id: Date.now() + 1, text: 'Review today\'s lesson materials', completed: false, createdAt: new Date() },
            { id: Date.now() + 2, text: 'Prepare for the upcoming quiz', completed: true, createdAt: new Date() }
        ];
        saveTasks();
    }
    
    // Load downloads from localStorage
    const savedDownloads = localStorage.getItem(`hitech_downloads_${currentUser?.id}`);
    if (savedDownloads) {
        downloadedMaterials = JSON.parse(savedDownloads);
    } else {
        downloadedMaterials = [];
    }
}

async function loadMaterials() {
    try {
        const { data: posts, error } = await window.supabaseClient
            .from('posts')
            .select('*')
            .or(`audience.eq.student,audience.eq.all`)
            .order('created_at', { ascending: false });
        
        if (error) throw error;
        
        allPosts = posts || [];
        displayStudyMaterials(allPosts);
        displayBooksRoom(allPosts);
        
    } catch (error) {
        console.error('Load materials error:', error);
    }
}

function displayStudyMaterials(posts) {
    const container = document.getElementById('studyMaterials');
    if (!container) return;
    
    if (!posts || posts.length === 0) {
        container.innerHTML = `
            <div class="col-span-full text-center py-16">
                <div class="text-6xl mb-4">📚</div>
                <h3 class="text-xl font-bold mb-2">No study materials yet</h3>
                <p class="text-gray-400">Check back later for new learning resources</p>
            </div>
        `;
        return;
    }
    
    container.innerHTML = posts.map(post => `
        <div class="glass-card rounded-xl overflow-hidden cursor-pointer group" onclick="downloadMaterial('${post.id}', '${post.title}', '${post.file_url}', '${post.type}')">
            ${renderFilePreview(post)}
            <div class="p-5">
                <div class="flex items-center justify-between mb-2">
                    <div class="flex items-center space-x-2">
                        <span class="text-2xl">${getTypeIcon(post.type)}</span>
                        <span class="text-xs px-2 py-1 bg-purple-600/30 rounded-full">${post.type.toUpperCase()}</span>
                    </div>
                    <div class="text-xs text-gray-500">${new Date(post.created_at).toLocaleDateString()}</div>
                </div>
                <h3 class="text-lg font-bold mb-2 group-hover:text-purple-400 transition">${escapeHtml(post.title)}</h3>
                ${post.description ? `<p class="text-gray-300 text-sm mb-3 line-clamp-2">${escapeHtml(post.description)}</p>` : ''}
                <div class="flex justify-between items-center mt-3 pt-3 border-t border-white/10">
                    <button onclick="event.stopPropagation(); downloadMaterial('${post.id}', '${post.title}', '${post.file_url}', '${post.type}')" class="text-purple-400 hover:text-purple-300 text-sm flex items-center gap-1">
                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"></path>
                        </svg>
                        Download
                    </button>
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
        container.innerHTML = `
            <div class="col-span-full text-center py-16">
                <div class="text-6xl mb-4">📖</div>
                <h3 class="text-xl font-bold mb-2">No books available</h3>
                <p class="text-gray-400">Books will appear here when published</p>
            </div>
        `;
        return;
    }
    
    container.innerHTML = pdfPosts.map(post => `
        <div class="glass-card rounded-xl overflow-hidden cursor-pointer" onclick="downloadMaterial('${post.id}', '${post.title}', '${post.file_url}', '${post.type}')">
            <div class="h-48 bg-gradient-to-br from-purple-600 to-pink-600 flex items-center justify-center">
                <svg class="w-16 h-16 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"></path>
                </svg>
            </div>
            <div class="p-5">
                <h3 class="font-bold mb-2">${escapeHtml(post.title)}</h3>
                ${post.description ? `<p class="text-gray-400 text-sm mb-3">${escapeHtml(post.description.substring(0, 100))}</p>` : ''}
                <div class="flex justify-between items-center">
                    <span class="text-xs text-purple-400">PDF Document</span>
                    <button onclick="event.stopPropagation(); downloadMaterial('${post.id}', '${post.title}', '${post.file_url}', '${post.type}')" class="text-purple-400 hover:text-purple-300">
                        Download →
                    </button>
                </div>
            </div>
        </div>
    `).join('');
}

function renderFilePreview(post) {
    if (post.type === 'image') {
        return `<img src="${post.file_url}" class="w-full h-48 object-cover group-hover:scale-105 transition duration-500" alt="${post.title}">`;
    } else if (post.type === 'video') {
        return `
            <div class="video-wrapper">
                <video class="w-full h-full object-cover" controls>
                    <source src="${post.file_url}">
                </video>
            </div>
        `;
    } else {
        return `
            <div class="h-48 bg-gradient-to-br from-purple-600 to-pink-600 flex items-center justify-center relative overflow-hidden group-hover:scale-105 transition duration-500">
                <svg class="w-16 h-16 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z"></path>
                </svg>
            </div>
        `;
    }
}

function getTypeIcon(type) {
    const icons = { 'image': '🖼️', 'video': '🎥', 'pdf': '📄', 'file': '📁' };
    return icons[type] || '📁';
}

// Download material
window.downloadMaterial = async (id, title, url, type) => {
    // Add to downloads history
    const downloadRecord = {
        id: id,
        title: title,
        url: url,
        type: type,
        downloadedAt: new Date().toISOString()
    };
    
    // Check if already downloaded
    if (!downloadedMaterials.some(m => m.id === id)) {
        downloadedMaterials.unshift(downloadRecord);
        saveDownloads();
        updateProfileStats();
        displayDownloads();
    }
    
    // Open in new tab
    window.open(url, '_blank');
    showAlert(`Opening ${title}...`, false);
};

// Notes functions
function loadNotes() {
    displayNotes();
}

function displayNotes() {
    const container = document.getElementById('notesList');
    if (!container) return;
    
    if (userNotes.length === 0) {
        container.innerHTML = `
            <div class="text-center py-8 text-gray-400">
                <p>No notes yet. Click "New Note" to create your first note!</p>
            </div>
        `;
        return;
    }
    
    container.innerHTML = userNotes.map(note => `
        <div class="glass p-4 rounded-xl todo-item">
            <div class="flex justify-between items-start">
                <div class="flex-1">
                    <h4 class="font-bold mb-1">${escapeHtml(note.title)}</h4>
                    <p class="text-gray-400 text-sm">${escapeHtml(note.content.substring(0, 100))}${note.content.length > 100 ? '...' : ''}</p>
                    <div class="text-xs text-gray-500 mt-2">${new Date(note.createdAt).toLocaleDateString()}</div>
                </div>
                <button onclick="deleteNote('${note.id}')" class="text-red-400 hover:text-red-300 ml-4">
                    <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path>
                    </svg>
                </button>
            </div>
        </div>
    `).join('');
}

window.createNewNote = () => {
    document.getElementById('noteModal').classList.remove('hidden');
    document.getElementById('noteTitle').value = '';
    document.getElementById('noteContent').value = '';
};

window.saveNote = () => {
    const title = document.getElementById('noteTitle').value;
    const content = document.getElementById('noteContent').value;
    
    if (!title || !content) {
        showAlert('Please enter both title and content');
        return;
    }
    
    const newNote = {
        id: Date.now().toString(),
        title: title,
        content: content,
        createdAt: new Date().toISOString()
    };
    
    userNotes.unshift(newNote);
    saveNotes();
    displayNotes();
    closeNoteModal();
    updateProfileStats();
    showAlert('Note saved!', false);
};

window.deleteNote = (noteId) => {
    if (confirm('Delete this note?')) {
        userNotes = userNotes.filter(n => n.id !== noteId);
        saveNotes();
        displayNotes();
        updateProfileStats();
        showAlert('Note deleted', false);
    }
};

window.closeNoteModal = () => {
    document.getElementById('noteModal').classList.add('hidden');
};

// Tasks functions
function loadTasks() {
    displayTasks();
    updateTodoProgress();
}

function displayTasks() {
    const container = document.getElementById('todoList');
    if (!container) return;
    
    if (userTasks.length === 0) {
        container.innerHTML = `
            <div class="text-center py-8 text-gray-400">
                <p>No tasks yet. Add your first task to stay organized!</p>
            </div>
        `;
        return;
    }
    
    container.innerHTML = userTasks.map(task => `
        <div class="glass p-4 rounded-xl todo-item">
            <div class="flex items-center space-x-3">
                <input type="checkbox" ${task.completed ? 'checked' : ''} onchange="toggleTask('${task.id}')" class="w-5 h-5 rounded border-gray-600 text-purple-600 focus:ring-purple-500 todo-checkbox">
                <span class="flex-1 ${task.completed ? 'line-through text-gray-500' : 'text-white'}">${escapeHtml(task.text)}</span>
                <button onclick="deleteTask('${task.id}')" class="text-red-400 hover:text-red-300">
                    <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path>
                    </svg>
                </button>
            </div>
        </div>
    `).join('');
}

window.addNewTask = () => {
    const taskText = prompt('Enter your task:');
    if (taskText && taskText.trim()) {
        const newTask = {
            id: Date.now().toString(),
            text: taskText.trim(),
            completed: false,
            createdAt: new Date().toISOString()
        };
        userTasks.push(newTask);
        saveTasks();
        displayTasks();
        updateTodoProgress();
        updateProfileStats();
        showAlert('Task added!', false);
    }
};

window.toggleTask = (taskId) => {
    const task = userTasks.find(t => t.id === taskId);
    if (task) {
        task.completed = !task.completed;
        saveTasks();
        displayTasks();
        updateTodoProgress();
        updateProfileStats();
    }
};

window.deleteTask = (taskId) => {
    if (confirm('Delete this task?')) {
        userTasks = userTasks.filter(t => t.id !== taskId);
        saveTasks();
        displayTasks();
        updateTodoProgress();
        updateProfileStats();
        showAlert('Task deleted', false);
    }
};

function updateTodoProgress() {
    const total = userTasks.length;
    const completed = userTasks.filter(t => t.completed).length;
    const percentage = total === 0 ? 0 : Math.round((completed / total) * 100);
    
    const progressSpan = document.getElementById('todoProgress');
    const progressBar = document.getElementById('todoProgressBar');
    
    if (progressSpan) progressSpan.textContent = percentage;
    if (progressBar) progressBar.style.width = `${percentage}%`;
}

// Downloads functions
function loadDownloads() {
    displayDownloads();
}

function displayDownloads() {
    const container = document.getElementById('downloadsList');
    if (!container) return;
    
    if (downloadedMaterials.length === 0) {
        container.innerHTML = `
            <div class="text-center py-8 text-gray-400">
                <p>No downloads yet. Start exploring the Study Room to download materials!</p>
            </div>
        `;
        return;
    }
    
    container.innerHTML = downloadedMaterials.map(download => `
        <div class="glass p-4 rounded-xl flex justify-between items-center">
            <div class="flex items-center space-x-3">
                <span class="text-2xl">${getTypeIcon(download.type)}</span>
                <div>
                    <h4 class="font-bold">${escapeHtml(download.title)}</h4>
                    <div class="text-xs text-gray-500">Downloaded: ${new Date(download.downloadedAt).toLocaleDateString()}</div>
                </div>
            </div>
            <a href="${download.url}" target="_blank" class="text-purple-400 hover:text-purple-300">
                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path>
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"></path>
                </svg>
            </a>
        </div>
    `).join('');
}

// Save data to localStorage
function saveNotes() {
    localStorage.setItem(`hitech_notes_${currentUser?.id}`, JSON.stringify(userNotes));
}

function saveTasks() {
    localStorage.setItem(`hitech_tasks_${currentUser?.id}`, JSON.stringify(userTasks));
}

function saveDownloads() {
    localStorage.setItem(`hitech_downloads_${currentUser?.id}`, JSON.stringify(downloadedMaterials));
}

// Profile stats
function updateProfileStats() {
    const studyStats = document.getElementById('studyStats');
    const notesStats = document.getElementById('notesStats');
    const tasksStats = document.getElementById('tasksStats');
    const downloadsStats = document.getElementById('downloadsStats');
    
    if (studyStats) studyStats.textContent = allPosts.length;
    if (notesStats) notesStats.textContent = userNotes.length;
    if (tasksStats) tasksStats.textContent = userTasks.filter(t => t.completed).length;
    if (downloadsStats) downloadsStats.textContent = downloadedMaterials.length;
}

// Navigation
function setupNavigation() {
    const navItems = document.querySelectorAll('.nav-item');
    const rooms = ['study', 'notes', 'books', 'downloads', 'todo', 'profile'];
    
    navItems.forEach(item => {
        item.addEventListener('click', () => {
            const room = item.dataset.room;
            
            // Update active state
            navItems.forEach(nav => nav.classList.remove('active'));
            item.classList.add('active');
            
            // Hide all rooms
            rooms.forEach(r => {
                const element = document.getElementById(`${r}Room`);
                if (element) element.classList.add('hidden');
            });
            
            // Show selected room
            const selectedRoom = document.getElementById(`${room}Room`);
            if (selectedRoom) selectedRoom.classList.remove('hidden');
            
            // Update header
            const roomTitle = document.getElementById('roomTitle');
            const roomDesc = document.getElementById('roomDescription');
            
            const roomData = {
                study: { title: 'Study Room', desc: 'Your learning materials and resources' },
                notes: { title: 'Note Room', desc: 'Capture your ideas and study notes' },
                books: { title: 'Books Room', desc: 'All available books and resources' },
                downloads: { title: 'Downloads Room', desc: 'Your downloaded materials' },
                todo: { title: 'Plan & To-Do List', desc: 'Organize your tasks and goals' },
                profile: { title: 'My Profile', desc: 'Your personal information and stats' }
            };
            
            if (roomTitle) roomTitle.textContent = roomData[room].title;
            if (roomDesc) roomDesc.textContent = roomData[room].desc;
        });
    });
}

function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Initialize
initDashboard();
