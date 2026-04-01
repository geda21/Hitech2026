let allPosts = [];
let currentUserProfile = null;

async function initDashboard() {
    showLoading();
    
    try {
        const session = await checkAuth();
        if (!session) return;
        
        // Get user profile
        const { data: userProfile, error: profileError } = await window.supabaseClient
            .from('users')
            .select('*')
            .eq('id', session.user.id)
            .single();
        
        if (profileError) {
            // Create profile if missing
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
        
        // Check admin access
        const currentPage = window.location.pathname;
        if (currentPage.includes('admin.html') && currentUserProfile.role !== 'admin') {
            showAlert('Access denied. Admin only.');
            window.location.href = '/student.html';
            return;
        }
        
        // Display user info
        if (currentUserProfile.role === 'admin') {
            const adminEmailSpan = document.getElementById('adminEmail');
            if (adminEmailSpan) adminEmailSpan.textContent = session.user.email;
        } else {
            const studentNameSpan = document.getElementById('studentName');
            const studentEmailSpan = document.getElementById('studentEmail');
            if (studentNameSpan) studentNameSpan.textContent = currentUserProfile.full_name;
            if (studentEmailSpan) studentEmailSpan.textContent = session.user.email;
        }
        
        // Load posts
        await loadPosts();
        
        // Setup logout
        const logoutBtn = document.getElementById('logoutBtn');
        if (logoutBtn) {
            logoutBtn.onclick = async () => {
                showLoading();
                await window.supabaseClient.auth.signOut();
                window.location.href = '/login.html';
            };
        }
        
        // Setup create post form for admin
        const createPostForm = document.getElementById('createPostForm');
        if (createPostForm && currentUserProfile.role === 'admin') {
            setupCreatePostForm(createPostForm);
        }
        
        // Setup search for students
        if (currentUserProfile.role === 'student') {
            setupSearchAndFilter();
        }
        
    } catch (error) {
        console.error('Dashboard error:', error);
        showAlert('Error loading dashboard');
    } finally {
        hideLoading();
    }
}

async function loadPosts() {
    try {
        let query = window.supabaseClient
            .from('posts')
            .select('*')
            .order('created_at', { ascending: false });
        
        if (currentUserProfile.role === 'student') {
            query = query.or(`audience.eq.student,audience.eq.all`);
        }
        
        const { data: posts, error } = await query;
        if (error) throw error;
        
        allPosts = posts || [];
        
        if (currentUserProfile.role === 'student') {
            displayStudentPosts(allPosts);
        } else {
            displayAdminPosts(allPosts);
        }
    } catch (error) {
        console.error('Load posts error:', error);
        showAlert('Error loading posts');
    }
}

function displayAdminPosts(posts) {
    const container = document.getElementById('postsContainer');
    if (!container) return;
    
    if (!posts || posts.length === 0) {
        container.innerHTML = `
            <div class="col-span-full text-center py-12">
                <div class="text-6xl mb-4">📚</div>
                <h3 class="text-xl font-bold mb-2">No materials yet</h3>
                <p class="text-gray-400">Start by publishing your first learning material</p>
            </div>
        `;
        return;
    }
    
    container.innerHTML = posts.map(post => `
        <div class="glass rounded-xl overflow-hidden post-card">
            ${renderFilePreview(post)}
            <div class="p-6">
                <div class="flex justify-between items-start mb-3">
                    <h3 class="text-xl font-bold">${escapeHtml(post.title)}</h3>
                    <button onclick="deletePost('${post.id}')" class="text-red-400 hover:text-red-300">
                        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path>
                        </svg>
                    </button>
                </div>
                ${post.description ? `<p class="text-gray-300 mb-4">${escapeHtml(post.description)}</p>` : ''}
                <div class="flex justify-between items-center">
                    <span class="text-xs px-2 py-1 ${post.audience === 'student' ? 'bg-green-600/30' : 'bg-purple-600/30'} rounded-full">
                        ${post.audience === 'student' ? '🎓 Student Exclusive' : '📚 General'}
                    </span>
                    <a href="${post.file_url}" target="_blank" class="text-purple-400 hover:text-purple-300 text-sm">
                        View Material →
                    </a>
                </div>
                <div class="mt-3 text-xs text-gray-500">
                    ${new Date(post.created_at).toLocaleDateString()}
                </div>
            </div>
        </div>
    `).join('');
}

function displayStudentPosts(posts) {
    const container = document.getElementById('postsContainer');
    if (!container) return;
    
    if (!posts || posts.length === 0) {
        container.innerHTML = `
            <div class="col-span-full text-center py-12">
                <div class="text-6xl mb-4">🎓</div>
                <h3 class="text-xl font-bold mb-2">No materials available yet</h3>
                <p class="text-gray-400">Check back later for new learning resources</p>
            </div>
        `;
        return;
    }
    
    container.innerHTML = posts.map(post => `
        <div class="glass rounded-xl overflow-hidden material-card cursor-pointer" onclick="window.open('${post.file_url}', '_blank')">
            ${renderFilePreview(post)}
            <div class="p-6">
                <div class="flex items-center justify-between mb-3">
                    <div class="flex items-center space-x-2">
                        <span class="text-lg">${getTypeIcon(post.type)}</span>
                        <span class="text-xs px-2 py-1 bg-purple-600/30 rounded-full">${post.type.toUpperCase()}</span>
                    </div>
                    <div class="text-xs text-gray-500">${new Date(post.created_at).toLocaleDateString()}</div>
                </div>
                <h3 class="text-xl font-bold mb-2">${escapeHtml(post.title)}</h3>
                ${post.description ? `<p class="text-gray-300 text-sm mb-4">${escapeHtml(post.description)}</p>` : ''}
                <div class="flex justify-between items-center mt-4">
                    <span class="text-xs text-purple-400">Click to view</span>
                    <svg class="w-5 h-5 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"></path>
                    </svg>
                </div>
            </div>
        </div>
    `).join('');
}

function renderFilePreview(post) {
    if (post.type === 'image') {
        return `<img src="${post.file_url}" class="w-full h-48 object-cover">`;
    } else if (post.type === 'video') {
        return `
            <div style="position:relative;padding-bottom:56.25%">
                <video style="position:absolute;top:0;left:0;width:100%;height:100%" controls>
                    <source src="${post.file_url}">
                </video>
            </div>
        `;
    } else {
        return `
            <div class="w-full h-48 bg-gradient-to-br from-purple-600 to-pink-600 flex items-center justify-center">
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

function setupCreatePostForm(form) {
    const fileInput = document.getElementById('postFile');
    const fileInfo = document.getElementById('fileInfo');
    
    if (fileInput && fileInfo) {
        fileInput.onchange = (e) => {
            if (e.target.files[0]) {
                fileInfo.innerHTML = `<div class="text-purple-400">✅ ${e.target.files[0].name}</div>`;
            }
        };
        
        document.querySelector('.file-upload-area')?.addEventListener('click', () => fileInput.click());
    }
    
    form.onsubmit = async (e) => {
        e.preventDefault();
        showLoading();
        
        try {
            const title = document.getElementById('postTitle').value;
            const description = document.getElementById('postDescription').value;
            const audience = document.getElementById('postAudience').value;
            const file = fileInput.files[0];
            
            if (!title || !file) throw new Error('Please fill in title and select a file');
            
            const fileName = `${Date.now()}_${file.name}`;
            const { error: uploadError } = await window.supabaseClient.storage.from('files').upload(fileName, file);
            if (uploadError) throw uploadError;
            
            const { data: { publicUrl } } = window.supabaseClient.storage.from('files').getPublicUrl(fileName);
            
            let fileType = 'file';
            if (file.type.startsWith('image/')) fileType = 'image';
            else if (file.type.startsWith('video/')) fileType = 'video';
            else if (file.type === 'application/pdf') fileType = 'pdf';
            
            const { error: insertError } = await window.supabaseClient.from('posts').insert({
                title, description, audience, file_url: publicUrl, type: fileType,
                user_id: (await window.supabaseClient.auth.getSession()).data.session?.user.id,
                created_at: new Date().toISOString()
            });
            
            if (insertError) throw insertError;
            
            showAlert('Material published!', false);
            form.reset();
            if (fileInfo) fileInfo.innerHTML = 'Click to upload or drag and drop';
            await loadPosts();
            
        } catch (error) {
            showAlert(error.message);
        } finally {
            hideLoading();
        }
    };
}

function setupSearchAndFilter() {
    const searchInput = document.getElementById('searchInput');
    const typeFilter = document.getElementById('typeFilter');
    
    const filter = () => {
        const searchTerm = searchInput.value.toLowerCase();
        const type = typeFilter.value;
        
        let filtered = allPosts;
        if (searchTerm) {
            filtered = filtered.filter(p => p.title.toLowerCase().includes(searchTerm) || 
                (p.description && p.description.toLowerCase().includes(searchTerm)));
        }
        if (type !== 'all') filtered = filtered.filter(p => p.type === type);
        
        displayStudentPosts(filtered);
    };
    
    if (searchInput) searchInput.oninput = filter;
    if (typeFilter) typeFilter.onchange = filter;
}

window.deletePost = async (postId) => {
    if (!confirm('Delete this material?')) return;
    showLoading();
    try {
        const { error } = await window.supabaseClient.from('posts').delete().eq('id', postId);
        if (error) throw error;
        showAlert('Material deleted!', false);
        await loadPosts();
    } catch (error) {
        showAlert(error.message);
    } finally {
        hideLoading();
    }
};

function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

initDashboard();
