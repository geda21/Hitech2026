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
let isTimerRunning = false;
let currentSession = 'focus'; // 'focus' or 'break'

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
        
        // Load bookmarks
        loadBookmarks();
        
        // Load timer data
        loadTimerData();
        
        // Load study streak
        loadStudyStreak();
        
        // Load quote of the day
        loadQuoteOfTheDay();
        
        // Load goals
        loadGoals();
        
        // Update quick stats
        updateQuickStats();
        
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
    
    // Load bookmarks from localStorage
    const savedBookmarks = localStorage.getItem(`hitech_bookmarks_${currentUser?.id}`);
    if (savedBookmarks) {
        bookmarkedMaterials = JSON.parse(savedBookmarks);
    } else {
        bookmarkedMaterials = [];
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
                <div class="flex justify-between items-start mb-2">
                    <div class="flex items-center space-x-2">
                        <span class="text-2xl">${getTypeIcon(post.type)}</span>
                        <span class="text-xs px-2 py-1 bg-purple-600/30 rounded-full">${post.type.toUpperCase()}</span>
                    </div>
                    <button onclick="event.stopPropagation(); toggleBookmark('${post.id}', '${escapeHtml(post.title)}', '${post.file_url}', '${post.type}')" 
                            class="bookmark-btn p-1 hover:scale-110 transition" data-id="${post.id}">
                        ${isBookmarked(post.id) ? 
                            '<svg class="w-5 h-5 fill-yellow-400 text-yellow-400" fill="currentColor" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z"></path></svg>' : 
                            '<svg class="w-5 h-5 text-gray-400 hover:text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z"></path></svg>'
                        }
                    </button>
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

// ============ BOOKMARKS FEATURE ============
function isBookmarked(materialId) {
    return bookmarkedMaterials.some(b => b.id === materialId);
}

function toggleBookmark(materialId, title, url, type) {
    const index = bookmarkedMaterials.findIndex(b => b.id === materialId);
    
    if (index === -1) {
        // Add bookmark
        bookmarkedMaterials.push({
            id: materialId,
            title: title,
            url: url,
            type: type,
            addedAt: new Date().toISOString()
        });
        showAlert('📌 Added to bookmarks!', false);
    } else {
        // Remove bookmark
        bookmarkedMaterials.splice(index, 1);
        showAlert('🗑️ Removed from bookmarks', false);
    }
    
    localStorage.setItem(`hitech_bookmarks_${currentUser?.id}`, JSON.stringify(bookmarkedMaterials));
    displayBookmarks();
    // Refresh materials to update bookmark icons
    displayStudyMaterials(allPosts);
}

function loadBookmarks() {
    displayBookmarks();
}

function displayBookmarks() {
    const container = document.getElementById('bookmarksList');
    if (!container) return;
    
    if (bookmarkedMaterials.length === 0) {
        container.innerHTML = `
            <div class="text-center py-8 text-gray-400">
                <p>No bookmarks yet. Click the ⭐ icon on materials to save them!</p>
            </div>
        `;
        return;
    }
    
    container.innerHTML = bookmarkedMaterials.map(bookmark => `
        <div class="glass p-4 rounded-xl flex justify-between items-center">
            <div class="flex items-center space-x-3 flex-1">
                <span class="text-2xl">${getTypeIcon(bookmark.type)}</span>
                <div class="flex-1">
                    <h4 class="font-bold">${escapeHtml(bookmark.title)}</h4>
                    <div class="text-xs text-gray-500">Saved: ${new Date(bookmark.addedAt).toLocaleDateString()}</div>
                </div>
            </div>
            <div class="flex space-x-2">
                <a href="${bookmark.url}" target="_blank" class="text-purple-400 hover:text-purple-300 p-2">
                    <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path>
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"></path>
                    </svg>
                </a>
                <button onclick="toggleBookmark('${bookmark.id}', '${escapeHtml(bookmark.title)}', '${bookmark.url}', '${bookmark.type}')" class="text-red-400 hover:text-red-300 p-2">
                    <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path>
                    </svg>
                </button>
            </div>
        </div>
    `).join('');
}

// ============ STUDY TIMER FEATURE ============
function loadTimerData() {
    const savedFocus = localStorage.getItem(`hitech_focus_${currentUser?.id}`);
    if (savedFocus) {
        const focusData = JSON.parse(savedFocus);
        document.getElementById('todayFocusTime').textContent = focusData.today || 0;
        document.getElementById('weeklyFocusTime').textContent = focusData.weekly || 0;
    } else {
        document.getElementById('todayFocusTime').textContent = '0';
        document.getElementById('weeklyFocusTime').textContent = '0';
    }
}

function updateTimerDisplay() {
    const minutes = Math.floor(timerSeconds / 60);
    const seconds = timerSeconds % 60;
    document.getElementById('timerDisplay').textContent = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
}

function startTimer() {
    if (timerInterval) return;
    
    timerInterval = setInterval(() => {
        if (timerSeconds > 0) {
            timerSeconds--;
            updateTimerDisplay();
        } else {
            clearInterval(timerInterval);
            timerInterval = null;
            isTimerRunning = false;
            
            if (currentSession === 'focus') {
                addFocusTime(25);
                showAlert('🎉 Great job! Time for a 5-minute break!', false);
                currentSession = 'break';
                timerSeconds = 5 * 60;
                updateTimerDisplay();
                startTimer();
            } else {
                showAlert('🎯 Break complete! Ready for another focus session?', false);
                currentSession = 'focus';
                timerSeconds = 25 * 60;
                updateTimerDisplay();
            }
        }
    }, 1000);
    isTimerRunning = true;
}

function pauseTimer() {
    if (timerInterval) {
        clearInterval(timerInterval);
        timerInterval = null;
        isTimerRunning = false;
    }
}

function resetTimer() {
    pauseTimer();
    currentSession = 'focus';
    timerSeconds = 25 * 60;
    updateTimerDisplay();
}

function addFocusTime(minutes) {
    const savedFocus = localStorage.getItem(`hitech_focus_${currentUser?.id}`);
    let focusData = savedFocus ? JSON.parse(savedFocus) : { today: 0, weekly: 0, lastDate: null, streak: 0 };
    
    const today = new Date().toDateString();
    const todayMinutes = focusData.today || 0;
    const weeklyMinutes = focusData.weekly || 0;
    
    focusData.today = todayMinutes + minutes;
    focusData.weekly = weeklyMinutes + minutes;
    
    // Update streak
    const lastDate = focusData.lastDate ? new Date(focusData.lastDate) : null;
    const currentDate = new Date();
    
    if (lastDate) {
        const diffDays = Math.floor((currentDate - lastDate) / (1000 * 60 * 60 * 24));
        if (diffDays === 1) {
            focusData.streak = (focusData.streak || 0) + 1;
        } else if (diffDays > 1) {
            focusData.streak = 1;
        }
    } else {
        focusData.streak = 1;
    }
    
    focusData.lastDate = currentDate.toISOString();
    
    // Track studied date for calendar
    if (!focusData.studiedDates) focusData.studiedDates = {};
    focusData.studiedDates[today] = true;
    
    localStorage.setItem(`hitech_focus_${currentUser?.id}`, JSON.stringify(focusData));
    
    document.getElementById('todayFocusTime').textContent = focusData.today;
    document.getElementById('weeklyFocusTime').textContent = focusData.weekly;
    
    updateStreakDisplay(focusData.streak);
    generateCalendar(focusData);
    updateQuickStats();
}

function updateStreakDisplay(streak) {
    const streakElement = document.getElementById('studyStreak');
    if (streakElement) {
        streakElement.textContent = streak;
        if (streak >= 7) {
            streakElement.className = 'text-2xl font-bold text-yellow-400';
        } else if (streak >= 3) {
            streakElement.className = 'text-2xl font-bold text-orange-400';
        }
    }
}

window.openTimer = () => {
    document.getElementById('timerModal').classList.remove('hidden');
    loadTimerData();
    updateTimerDisplay();
};

window.closeTimerModal = () => {
    document.getElementById('timerModal').classList.add('hidden');
    pauseTimer();
};

// ============ STUDY STREAK CALENDAR ============
function loadStudyStreak() {
    const savedFocus = localStorage.getItem(`hitech_focus_${currentUser?.id}`);
    if (savedFocus) {
        const focusData = JSON.parse(savedFocus);
        updateStreakDisplay(focusData.streak || 0);
        generateCalendar(focusData);
    } else {
        generateCalendar({ studiedDates: {} });
    }
}

function generateCalendar(focusData) {
    const calendarContainer = document.getElementById('streakCalendar');
    if (!calendarContainer) return;
    
    const today = new Date();
    const days = [];
    
    // Get last 30 days
    for (let i = 29; i >= 0; i--) {
        const date = new Date(today);
        date.setDate(today.getDate() - i);
        days.push(date);
    }
    
    const studiedDates = focusData?.studiedDates || {};
    
    calendarContainer.innerHTML = `
        <div class="grid grid-cols-7 gap-2 text-center">
            ${['S', 'M', 'T', 'W', 'T', 'F', 'S'].map(day => `
                <div class="text-xs text-gray-500 font-bold">${day}</div>
            `).join('')}
            ${days.map(date => {
                const dateStr = date.toDateString();
                const studied = studiedDates[dateStr];
                const isToday = date.toDateString() === today.toDateString();
                return `
                    <div class="aspect-square flex items-center justify-center">
                        <div class="w-8 h-8 rounded-full flex items-center justify-center text-xs
                            ${studied ? 'bg-purple-600 text-white' : 'bg-gray-800 text-gray-500'}
                            ${isToday ? 'ring-2 ring-purple-400' : ''}
                        ">
                            ${date.getDate()}
                        </div>
                    </div>
                `;
            }).join('')}
        </div>
    `;
}

// ============ QUOTE OF THE DAY ============
const quotes = [
    { text: "The future belongs to those who learn more skills and combine them in creative ways.", author: "Robert Greene" },
    { text: "Education is the most powerful weapon which you can use to change the world.", author: "Nelson Mandela" },
    { text: "The beautiful thing about learning is that no one can take it away from you.", author: "B.B. King" },
    { text: "Success is no accident. It is hard work, perseverance, learning, studying, sacrifice.", author: "Pelé" },
    { text: "The expert in anything was once a beginner.", author: "Helen Hayes" },
    { text: "Learning is not attained by chance, it must be sought for with ardor and diligence.", author: "Abigail Adams" },
    { text: "Develop a passion for learning. If you do, you will never cease to grow.", author: "Anthony J. D'Angelo" },
    { text: "Technology is just a tool. In terms of getting the kids working together and motivating them, the teacher is the most important.", author: "Bill Gates" },
    { text: "The more that you read, the more things you will know. The more that you learn, the more places you'll go.", author: "Dr. Seuss" },
    { text: "Live as if you were to die tomorrow. Learn as if you were to live forever.", author: "Mahatma Gandhi" }
];

function loadQuoteOfTheDay() {
    const today = new Date().toDateString();
    const savedQuote = localStorage.getItem('hitech_quote_date');
    const savedQuoteText = localStorage.getItem('hitech_quote_text');
    
    if (savedQuote === today && savedQuoteText) {
        displayQuote(JSON.parse(savedQuoteText));
        return;
    }
    
    const randomQuote = quotes[Math.floor(Math.random() * quotes.length)];
    localStorage.setItem('hitech_quote_date', today);
    localStorage.setItem('hitech_quote_text', JSON.stringify(randomQuote));
    displayQuote(randomQuote);
}

function displayQuote(quote) {
    const quoteElement = document.getElementById('quoteOfDay');
    if (quoteElement) {
        quoteElement.innerHTML = `
            <div class="text-lg italic">"${quote.text}"</div>
            <div class="text-sm text-purple-400 mt-2">— ${quote.author}</div>
        `;
    }
}

// ============ GOAL SETTING ============
let weeklyGoal = 5;

function loadGoals() {
    const savedGoal = localStorage.getItem(`hitech_goal_${currentUser?.id}`);
    if (savedGoal) {
        weeklyGoal = parseInt(savedGoal);
        const goalInput = document.getElementById('weeklyGoal');
        if (goalInput) goalInput.value = weeklyGoal;
    }
    updateGoalProgress();
}

function setWeeklyGoal() {
    const goalInput = document.getElementById('weeklyGoal');
    weeklyGoal = parseInt(goalInput.value) || 5;
    localStorage.setItem(`hitech_goal_${currentUser?.id}`, weeklyGoal);
    updateGoalProgress();
    showAlert(`Weekly goal set to ${weeklyGoal} materials!`, false);
}

function updateGoalProgress() {
    const viewedThisWeek = getMaterialsViewedThisWeek();
    const progress = Math.min(100, (viewedThisWeek / weeklyGoal) * 100);
    
    const progressBar = document.getElementById('goalProgress');
    const progressText = document.getElementById('goalProgressText');
    
    if (progressBar) progressBar.style.width = `${progress}%`;
    if (progressText) progressText.textContent = `${viewedThisWeek}/${weeklyGoal} materials`;
    
    if (viewedThisWeek >= weeklyGoal && viewedThisWeek > 0) {
        const goalMet = document.getElementById('quickGoals');
        if (goalMet) goalMet.textContent = '✓';
        showAlert('🎉 Congratulations! You\'ve achieved your weekly goal!', false);
    }
}

function getMaterialsViewedThisWeek() {
    const savedViews = localStorage.getItem(`hitech_views_${currentUser?.id}`);
    const views = savedViews ? JSON.parse(savedViews) : {};
    
    const today = new Date();
    const startOfWeek = new Date(today);
    startOfWeek.setDate(today.getDate() - today.getDay());
    
    let count = 0;
    for (const [date, materials] of Object.entries(views)) {
        const viewDate = new Date(date);
        if (viewDate >= startOfWeek) {
            count += materials.length;
        }
    }
    return count;
}

function trackMaterialView(materialId) {
    const savedViews = localStorage.getItem(`hitech_views_${currentUser?.id}`);
    const views = savedViews ? JSON.parse(savedViews) : {};
    const today = new Date().toDateString();
    
    if (!views[today]) views[today] = [];
    if (!views[today].includes(materialId)) {
        views[today].push(materialId);
        localStorage.setItem(`hitech_views_${currentUser?.id}`, JSON.stringify(views));
        updateGoalProgress();
        updateQuickStats();
    }
}

// ============ QUICK STATS ============
function updateQuickStats() {
    // Study time stats
    const savedFocus = localStorage.getItem(`hitech_focus_${currentUser?.id}`);
    const focusData = savedFocus ? JSON.parse(savedFocus) : { weekly: 0 };
    
    const studyTimeElement = document.getElementById('quickStudyTime');
    if (studyTimeElement) studyTimeElement.textContent = `${focusData.weekly || 0} mins`;
    
    // Tasks stats
    const completedTasks = userTasks.filter(t => t.completed).length;
    const tasksElement = document.getElementById('quickTasksDone');
    if (tasksElement) tasksElement.textContent = completedTasks;
    
    // Materials stats
    const materialsElement = document.getElementById('quickMaterials');
    if (materialsElement) materialsElement.textContent = allPosts.length;
    
    // Notes stats
    const notesElement = document.getElementById('quickNotes');
    if (notesElement) notesElement.textContent = userNotes.length;
    
    // Goals stats
    const viewedThisWeek = getMaterialsViewedThisWeek();
    const goalElement = document.getElementById('quickGoals');
    if (goalElement) goalElement.textContent = viewedThisWeek >= weeklyGoal ? '✓' : `${viewedThisWeek}/${weeklyGoal}`;
}

// Download material (enhanced with tracking)
window.downloadMaterial = async (id, title, url, type) => {
    // Track view for goals
    trackMaterialView(id);
    
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
        updateQuickStats();
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
    updateQuickStats();
    showAlert('Note saved!', false);
};

window.deleteNote = (noteId) => {
    if (confirm('Delete this note?')) {
        userNotes = userNotes.filter(n => n.id !== noteId);
        saveNotes();
        displayNotes();
        updateProfileStats();
        updateQuickStats();
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
        updateQuickStats();
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
        updateQuickStats();
    }
};

window.deleteTask = (taskId) => {
    if (confirm('Delete this task?')) {
        userTasks = userTasks.filter(t => t.id !== taskId);
        saveTasks();
        displayTasks();
        updateTodoProgress();
        updateProfileStats();
        updateQuickStats();
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
let isTimerRunning = false;
let currentSession = 'focus'; // 'focus' or 'break'

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
        
        // Load bookmarks
        loadBookmarks();
        
        // Load timer data
        loadTimerData();
        
        // Load study streak
        loadStudyStreak();
        
        // Load quote of the day
        loadQuoteOfTheDay();
        
        // Load goals
        loadGoals();
        
        // Update quick stats
        updateQuickStats();
        
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
    
    // Load bookmarks from localStorage
    const savedBookmarks = localStorage.getItem(`hitech_bookmarks_${currentUser?.id}`);
    if (savedBookmarks) {
        bookmarkedMaterials = JSON.parse(savedBookmarks);
    } else {
        bookmarkedMaterials = [];
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
                <div class="flex justify-between items-start mb-2">
                    <div class="flex items-center space-x-2">
                        <span class="text-2xl">${getTypeIcon(post.type)}</span>
                        <span class="text-xs px-2 py-1 bg-purple-600/30 rounded-full">${post.type.toUpperCase()}</span>
                    </div>
                    <button onclick="event.stopPropagation(); toggleBookmark('${post.id}', '${escapeHtml(post.title)}', '${post.file_url}', '${post.type}')" 
                            class="bookmark-btn p-1 hover:scale-110 transition" data-id="${post.id}">
                        ${isBookmarked(post.id) ? 
                            '<svg class="w-5 h-5 fill-yellow-400 text-yellow-400" fill="currentColor" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z"></path></svg>' : 
                            '<svg class="w-5 h-5 text-gray-400 hover:text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z"></path></svg>'
                        }
                    </button>
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

// ============ BOOKMARKS FEATURE ============
function isBookmarked(materialId) {
    return bookmarkedMaterials.some(b => b.id === materialId);
}

function toggleBookmark(materialId, title, url, type) {
    const index = bookmarkedMaterials.findIndex(b => b.id === materialId);
    
    if (index === -1) {
        // Add bookmark
        bookmarkedMaterials.push({
            id: materialId,
            title: title,
            url: url,
            type: type,
            addedAt: new Date().toISOString()
        });
        showAlert('📌 Added to bookmarks!', false);
    } else {
        // Remove bookmark
        bookmarkedMaterials.splice(index, 1);
        showAlert('🗑️ Removed from bookmarks', false);
    }
    
    localStorage.setItem(`hitech_bookmarks_${currentUser?.id}`, JSON.stringify(bookmarkedMaterials));
    displayBookmarks();
    // Refresh materials to update bookmark icons
    displayStudyMaterials(allPosts);
}

function loadBookmarks() {
    displayBookmarks();
}

function displayBookmarks() {
    const container = document.getElementById('bookmarksList');
    if (!container) return;
    
    if (bookmarkedMaterials.length === 0) {
        container.innerHTML = `
            <div class="text-center py-8 text-gray-400">
                <p>No bookmarks yet. Click the ⭐ icon on materials to save them!</p>
            </div>
        `;
        return;
    }
    
    container.innerHTML = bookmarkedMaterials.map(bookmark => `
        <div class="glass p-4 rounded-xl flex justify-between items-center">
            <div class="flex items-center space-x-3 flex-1">
                <span class="text-2xl">${getTypeIcon(bookmark.type)}</span>
                <div class="flex-1">
                    <h4 class="font-bold">${escapeHtml(bookmark.title)}</h4>
                    <div class="text-xs text-gray-500">Saved: ${new Date(bookmark.addedAt).toLocaleDateString()}</div>
                </div>
            </div>
            <div class="flex space-x-2">
                <a href="${bookmark.url}" target="_blank" class="text-purple-400 hover:text-purple-300 p-2">
                    <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path>
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"></path>
                    </svg>
                </a>
                <button onclick="toggleBookmark('${bookmark.id}', '${escapeHtml(bookmark.title)}', '${bookmark.url}', '${bookmark.type}')" class="text-red-400 hover:text-red-300 p-2">
                    <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path>
                    </svg>
                </button>
            </div>
        </div>
    `).join('');
}

// ============ STUDY TIMER FEATURE ============
function loadTimerData() {
    const savedFocus = localStorage.getItem(`hitech_focus_${currentUser?.id}`);
    if (savedFocus) {
        const focusData = JSON.parse(savedFocus);
        document.getElementById('todayFocusTime').textContent = focusData.today || 0;
        document.getElementById('weeklyFocusTime').textContent = focusData.weekly || 0;
    } else {
        document.getElementById('todayFocusTime').textContent = '0';
        document.getElementById('weeklyFocusTime').textContent = '0';
    }
}

function updateTimerDisplay() {
    const minutes = Math.floor(timerSeconds / 60);
    const seconds = timerSeconds % 60;
    document.getElementById('timerDisplay').textContent = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
}

function startTimer() {
    if (timerInterval) return;
    
    timerInterval = setInterval(() => {
        if (timerSeconds > 0) {
            timerSeconds--;
            updateTimerDisplay();
        } else {
            clearInterval(timerInterval);
            timerInterval = null;
            isTimerRunning = false;
            
            if (currentSession === 'focus') {
                addFocusTime(25);
                showAlert('🎉 Great job! Time for a 5-minute break!', false);
                currentSession = 'break';
                timerSeconds = 5 * 60;
                updateTimerDisplay();
                startTimer();
            } else {
                showAlert('🎯 Break complete! Ready for another focus session?', false);
                currentSession = 'focus';
                timerSeconds = 25 * 60;
                updateTimerDisplay();
            }
        }
    }, 1000);
    isTimerRunning = true;
}

function pauseTimer() {
    if (timerInterval) {
        clearInterval(timerInterval);
        timerInterval = null;
        isTimerRunning = false;
    }
}

function resetTimer() {
    pauseTimer();
    currentSession = 'focus';
    timerSeconds = 25 * 60;
    updateTimerDisplay();
}

function addFocusTime(minutes) {
    const savedFocus = localStorage.getItem(`hitech_focus_${currentUser?.id}`);
    let focusData = savedFocus ? JSON.parse(savedFocus) : { today: 0, weekly: 0, lastDate: null, streak: 0 };
    
    const today = new Date().toDateString();
    const todayMinutes = focusData.today || 0;
    const weeklyMinutes = focusData.weekly || 0;
    
    focusData.today = todayMinutes + minutes;
    focusData.weekly = weeklyMinutes + minutes;
    
    // Update streak
    const lastDate = focusData.lastDate ? new Date(focusData.lastDate) : null;
    const currentDate = new Date();
    
    if (lastDate) {
        const diffDays = Math.floor((currentDate - lastDate) / (1000 * 60 * 60 * 24));
        if (diffDays === 1) {
            focusData.streak = (focusData.streak || 0) + 1;
        } else if (diffDays > 1) {
            focusData.streak = 1;
        }
    } else {
        focusData.streak = 1;
    }
    
    focusData.lastDate = currentDate.toISOString();
    
    // Track studied date for calendar
    if (!focusData.studiedDates) focusData.studiedDates = {};
    focusData.studiedDates[today] = true;
    
    localStorage.setItem(`hitech_focus_${currentUser?.id}`, JSON.stringify(focusData));
    
    document.getElementById('todayFocusTime').textContent = focusData.today;
    document.getElementById('weeklyFocusTime').textContent = focusData.weekly;
    
    updateStreakDisplay(focusData.streak);
    generateCalendar(focusData);
    updateQuickStats();
}

function updateStreakDisplay(streak) {
    const streakElement = document.getElementById('studyStreak');
    if (streakElement) {
        streakElement.textContent = streak;
        if (streak >= 7) {
            streakElement.className = 'text-2xl font-bold text-yellow-400';
        } else if (streak >= 3) {
            streakElement.className = 'text-2xl font-bold text-orange-400';
        }
    }
}

window.openTimer = () => {
    document.getElementById('timerModal').classList.remove('hidden');
    loadTimerData();
    updateTimerDisplay();
};

window.closeTimerModal = () => {
    document.getElementById('timerModal').classList.add('hidden');
    pauseTimer();
};

// ============ STUDY STREAK CALENDAR ============
function loadStudyStreak() {
    const savedFocus = localStorage.getItem(`hitech_focus_${currentUser?.id}`);
    if (savedFocus) {
        const focusData = JSON.parse(savedFocus);
        updateStreakDisplay(focusData.streak || 0);
        generateCalendar(focusData);
    } else {
        generateCalendar({ studiedDates: {} });
    }
}

function generateCalendar(focusData) {
    const calendarContainer = document.getElementById('streakCalendar');
    if (!calendarContainer) return;
    
    const today = new Date();
    const days = [];
    
    // Get last 30 days
    for (let i = 29; i >= 0; i--) {
        const date = new Date(today);
        date.setDate(today.getDate() - i);
        days.push(date);
    }
    
    const studiedDates = focusData?.studiedDates || {};
    
    calendarContainer.innerHTML = `
        <div class="grid grid-cols-7 gap-2 text-center">
            ${['S', 'M', 'T', 'W', 'T', 'F', 'S'].map(day => `
                <div class="text-xs text-gray-500 font-bold">${day}</div>
            `).join('')}
            ${days.map(date => {
                const dateStr = date.toDateString();
                const studied = studiedDates[dateStr];
                const isToday = date.toDateString() === today.toDateString();
                return `
                    <div class="aspect-square flex items-center justify-center">
                        <div class="w-8 h-8 rounded-full flex items-center justify-center text-xs
                            ${studied ? 'bg-purple-600 text-white' : 'bg-gray-800 text-gray-500'}
                            ${isToday ? 'ring-2 ring-purple-400' : ''}
                        ">
                            ${date.getDate()}
                        </div>
                    </div>
                `;
            }).join('')}
        </div>
    `;
}

// ============ QUOTE OF THE DAY ============
const quotes = [
    { text: "The future belongs to those who learn more skills and combine them in creative ways.", author: "Robert Greene" },
    { text: "Education is the most powerful weapon which you can use to change the world.", author: "Nelson Mandela" },
    { text: "The beautiful thing about learning is that no one can take it away from you.", author: "B.B. King" },
    { text: "Success is no accident. It is hard work, perseverance, learning, studying, sacrifice.", author: "Pelé" },
    { text: "The expert in anything was once a beginner.", author: "Helen Hayes" },
    { text: "Learning is not attained by chance, it must be sought for with ardor and diligence.", author: "Abigail Adams" },
    { text: "Develop a passion for learning. If you do, you will never cease to grow.", author: "Anthony J. D'Angelo" },
    { text: "Technology is just a tool. In terms of getting the kids working together and motivating them, the teacher is the most important.", author: "Bill Gates" },
    { text: "The more that you read, the more things you will know. The more that you learn, the more places you'll go.", author: "Dr. Seuss" },
    { text: "Live as if you were to die tomorrow. Learn as if you were to live forever.", author: "Mahatma Gandhi" }
];

function loadQuoteOfTheDay() {
    const today = new Date().toDateString();
    const savedQuote = localStorage.getItem('hitech_quote_date');
    const savedQuoteText = localStorage.getItem('hitech_quote_text');
    
    if (savedQuote === today && savedQuoteText) {
        displayQuote(JSON.parse(savedQuoteText));
        return;
    }
    
    const randomQuote = quotes[Math.floor(Math.random() * quotes.length)];
    localStorage.setItem('hitech_quote_date', today);
    localStorage.setItem('hitech_quote_text', JSON.stringify(randomQuote));
    displayQuote(randomQuote);
}

function displayQuote(quote) {
    const quoteElement = document.getElementById('quoteOfDay');
    if (quoteElement) {
        quoteElement.innerHTML = `
            <div class="text-lg italic">"${quote.text}"</div>
            <div class="text-sm text-purple-400 mt-2">— ${quote.author}</div>
        `;
    }
}

// ============ GOAL SETTING ============
let weeklyGoal = 5;

function loadGoals() {
    const savedGoal = localStorage.getItem(`hitech_goal_${currentUser?.id}`);
    if (savedGoal) {
        weeklyGoal = parseInt(savedGoal);
        const goalInput = document.getElementById('weeklyGoal');
        if (goalInput) goalInput.value = weeklyGoal;
    }
    updateGoalProgress();
}

function setWeeklyGoal() {
    const goalInput = document.getElementById('weeklyGoal');
    weeklyGoal = parseInt(goalInput.value) || 5;
    localStorage.setItem(`hitech_goal_${currentUser?.id}`, weeklyGoal);
    updateGoalProgress();
    showAlert(`Weekly goal set to ${weeklyGoal} materials!`, false);
}

function updateGoalProgress() {
    const viewedThisWeek = getMaterialsViewedThisWeek();
    const progress = Math.min(100, (viewedThisWeek / weeklyGoal) * 100);
    
    const progressBar = document.getElementById('goalProgress');
    const progressText = document.getElementById('goalProgressText');
    
    if (progressBar) progressBar.style.width = `${progress}%`;
    if (progressText) progressText.textContent = `${viewedThisWeek}/${weeklyGoal} materials`;
    
    if (viewedThisWeek >= weeklyGoal && viewedThisWeek > 0) {
        const goalMet = document.getElementById('quickGoals');
        if (goalMet) goalMet.textContent = '✓';
        showAlert('🎉 Congratulations! You\'ve achieved your weekly goal!', false);
    }
}

function getMaterialsViewedThisWeek() {
    const savedViews = localStorage.getItem(`hitech_views_${currentUser?.id}`);
    const views = savedViews ? JSON.parse(savedViews) : {};
    
    const today = new Date();
    const startOfWeek = new Date(today);
    startOfWeek.setDate(today.getDate() - today.getDay());
    
    let count = 0;
    for (const [date, materials] of Object.entries(views)) {
        const viewDate = new Date(date);
        if (viewDate >= startOfWeek) {
            count += materials.length;
        }
    }
    return count;
}

function trackMaterialView(materialId) {
    const savedViews = localStorage.getItem(`hitech_views_${currentUser?.id}`);
    const views = savedViews ? JSON.parse(savedViews) : {};
    const today = new Date().toDateString();
    
    if (!views[today]) views[today] = [];
    if (!views[today].includes(materialId)) {
        views[today].push(materialId);
        localStorage.setItem(`hitech_views_${currentUser?.id}`, JSON.stringify(views));
        updateGoalProgress();
        updateQuickStats();
    }
}

// ============ QUICK STATS ============
function updateQuickStats() {
    // Study time stats
    const savedFocus = localStorage.getItem(`hitech_focus_${currentUser?.id}`);
    const focusData = savedFocus ? JSON.parse(savedFocus) : { weekly: 0 };
    
    const studyTimeElement = document.getElementById('quickStudyTime');
    if (studyTimeElement) studyTimeElement.textContent = `${focusData.weekly || 0} mins`;
    
    // Tasks stats
    const completedTasks = userTasks.filter(t => t.completed).length;
    const tasksElement = document.getElementById('quickTasksDone');
    if (tasksElement) tasksElement.textContent = completedTasks;
    
    // Materials stats
    const materialsElement = document.getElementById('quickMaterials');
    if (materialsElement) materialsElement.textContent = allPosts.length;
    
    // Notes stats
    const notesElement = document.getElementById('quickNotes');
    if (notesElement) notesElement.textContent = userNotes.length;
    
    // Goals stats
    const viewedThisWeek = getMaterialsViewedThisWeek();
    const goalElement = document.getElementById('quickGoals');
    if (goalElement) goalElement.textContent = viewedThisWeek >= weeklyGoal ? '✓' : `${viewedThisWeek}/${weeklyGoal}`;
}

// Download material (enhanced with tracking)
window.downloadMaterial = async (id, title, url, type) => {
    // Track view for goals
    trackMaterialView(id);
    
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
        updateQuickStats();
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
    updateQuickStats();
    showAlert('Note saved!', false);
};

window.deleteNote = (noteId) => {
    if (confirm('Delete this note?')) {
        userNotes = userNotes.filter(n => n.id !== noteId);
        saveNotes();
        displayNotes();
        updateProfileStats();
        updateQuickStats();
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
        updateQuickStats();
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
        updateQuickStats();
    }
};

window.deleteTask = (taskId) => {
    if (confirm('Delete this task?')) {
        userTasks = userTasks.filter(t => t.id !== taskId);
        saveTasks();
        displayTasks();
        updateTodoProgress();
        updateProfileStats();
        updateQuickStats();
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
initDashboard();           study: { title: 'Study Room', desc: 'Your learning materials and resources' },
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
