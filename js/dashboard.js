// Global variables
let allPosts = [];
let currentUser = null;
let currentUserProfile = null;

// Check authentication and load dashboard
async function initDashboard() {
    showLoading();
    
    try {
        const session = await checkAuth();
        if (!session) return;
        
        currentUser = session.user;
        
        // Get user profile from users table
        const { data: userProfile, error: profileError } = await window.supabaseClient
            .from('users')
            .select('*')
            .eq('id', session.user.id)
            .single();
        
        if (profileError) {
            console.error('Profile fetch error:', profileError);
            
            // Try to create profile if it doesn't exist
            if (profileError.message.includes('not found')) {
                const { data: newProfile, error: createError } = await window.supabaseClient
                    .from('users')
                    .insert([
                        {
                            id: session.user.id,
                            email: session.user.email,
                            full_name: session.user.user_metadata?.full_name || session.user.email.split('@')[0],
                            role: 'student',
                            created_at: new Date().toISOString()
                        }
                    ])
                    .select()
                    .single();
                
                if (createError) {
                    console.error('Profile creation error:', createError);
                    window.location.href = '/login.html';
                    return;
                }
                
                currentUserProfile = newProfile;
            } else {
                window.location.href = '/login.html';
                return;
            }
        } else {
            currentUserProfile = userProfile;
        }
        
        // Check role matches page
        const currentPage = window.location.pathname;
        if (currentPage.includes('admin.html') && currentUserProfile.role !== 'admin') {
            window.location.href = '/student.html';
            return;
        }
        
        // Display user info
        if (currentUserProfile.role === 'admin') {
            const adminEmailSpan = document.getElementById('adminEmail');
            if (adminEmailSpan) {
                adminEmailSpan.textContent = session.user.email;
            }
        } else {
            const studentNameSpan = document.getElementById('studentName');
            const studentEmailSpan = document.getElementById('studentEmail');
            if (studentNameSpan) {
                studentNameSpan.textContent = currentUserProfile.full_name || session.user.email.split('@')[0];
            }
            if (studentEmailSpan) {
                studentEmailSpan.textContent = session.user.email;
            }
        }
        
        // Load posts
        await loadPosts();
        
        // Setup logout
        const logoutBtn = document.getElementById('logoutBtn');
        if (logoutBtn) {
            logoutBtn.addEventListener('click', async () => {
                showLoading();
                await window.supabaseClient.auth.signOut();
                window.location.href = '/login.html';
                hideLoading();
            });
        }
        
        // Setup create post form for admin
        const createPostForm = document.getElementById('createPostForm');
        if (createPostForm && currentUserProfile.role === 'admin') {
            setupCreatePostForm(createPostForm);
        }
        
        // Setup search and filter for student
        if (currentUserProfile.role === 'student') {
            setupSearchAndFilter();
        }
        
    } catch (error) {
        console.error('Dashboard init error:', error);
        showAlert('Error loading dashboard: ' + error.message);
    } finally {
        hideLoading();
    }
}

// Load posts based on user role
async function loadPosts() {
    try {
        let query = window.supabaseClient
            .from('posts')
            .select('*')
            .order('created_at', { ascending: false });
        
        // Filter posts based on role
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
        showAlert('Error loading posts: ' + error.message);
    }
}

// Display posts for admin
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
                    <button onclick="deletePost('${post.id}')" class="text-red-400 hover:text-red-300 transition">
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

// Display posts for students
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
                        ${getTypeIcon(post.type)}
                        <span class="text-xs px-2 py-1 bg-purple-600/30 rounded-full">${post.type.toUpperCase()}</span>
                    </div>
                    <div class="text-xs text-gray-500">${new Date(post.created_at).toLocaleDateString()}</div>
                </div>
                <h3 class="text-xl font-bold mb-2">${escapeHtml(post.title)}</h3>
                ${post.description ? `<p class="text-gray-300 text-sm mb-4 line-clamp-2">${escapeHtml(post.description)}</p>` : ''}
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

// Render file preview
function renderFilePreview(post) {
    if (post.type === 'image') {
        return `<img src="${post.file_url}" alt="${post.title}" class="w-full h-48 object-cover">`;
    } else if (post.type === 'video') {
        return `
            <div class="video-container">
                <video class="w-full h-48 object-cover" controls>
                    <source src="${post.file_url}" type="video/mp4">
                </video>
            </div>
        `;
    } else {
        return `
            <div class="w-full h-48 bg-gradient-to-br from-purple-600 to-pink-600 flex items-center justify-center relative">
                <svg class="w-16 h-16 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z"></path>
                </svg>
                <div class="absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 hover:opacity-100 transition">
                    <span class="text-white font-bold">View PDF</span>
                </div>
            </div>
        `;
    }
}

// Get type icon
function getTypeIcon(type) {
    const icons = {
        'image': '🖼️',
        'video': '🎥',
        'pdf': '📄',
        'file': '📁'
    };
    return `<span class="text-lg">${icons[type] || '📁'}</span>`;
}

// Setup create post form
function setupCreatePostForm(form) {
    const fileInput = document.getElementById('postFile');
    const fileInfo = document.getElementById('fileInfo');
    
    if (fileInput && fileInfo) {
        fileInput.addEventListener('change', (e) => {
            if (e.target.files[0]) {
                fileInfo.innerHTML = `
                    <svg class="w-12 h-12 mx-auto mb-3 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path>
                    </svg>
                    <div class="text-purple-400">${e.target.files[0].name}</div>
                `;
            } else {
                fileInfo.innerHTML = `
                    <svg class="w-12 h-12 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"></path>
                    </svg>
                    Click to upload or drag and drop
                `;
            }
        });
        
        // Trigger file input on div click
        const fileLabel = document.querySelector('.file-upload-area');
        if (fileLabel) {
            fileLabel.addEventListener('click', () => {
                fileInput.click();
            });
        }
    }
    
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        showLoading();
        
        try {
            const title = document.getElementById('postTitle').value;
            const description = document.getElementById('postDescription').value;
            const audience = document.getElementById('postAudience').value;
            const file = fileInput.files[0];
            
            if (!title || !file) {
                throw new Error('Please fill in title and select a file');
            }
            
            // Upload file to Supabase Storage
            const fileName = `${Date.now()}_${file.name}`;
            const { error: uploadError } = await window.supabaseClient.storage
                .from('files')
                .upload(fileName, file);
            
            if (uploadError) throw uploadError;
            
            // Get public URL
            const { data: { publicUrl } } = window.supabaseClient.storage
                .from('files')
                .getPublicUrl(fileName);
            
            // Determine file type
            let fileType = 'file';
            if (file.type.startsWith('image/')) fileType = 'image';
            else if (file.type.startsWith('video/')) fileType = 'video';
            else if (file.type === 'application/pdf') fileType = 'pdf';
            
            // Save to posts table
            const { error: insertError } = await window.supabaseClient
                .from('posts')
                .insert([
                    {
                        title,
                        description,
                        audience,
                        file_url: publicUrl,
                        type: fileType,
                        user_id: currentUser.id,
                        created_at: new Date().toISOString()
                    }
                ]);
            
            if (insertError) throw insertError;
            
            showAlert('Material published successfully!', false);
            form.reset();
            if (fileInfo) {
                fileInfo.innerHTML = `
                    <svg class="w-12 h-12 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"></path>
                    </svg>
                    Click to upload or drag and drop
                `;
            }
            
            // Reload posts
            await loadPosts();
            
        } catch (error) {
            console.error('Create post error:', error);
            showAlert(error.message || 'Error publishing material');
        } finally {
            hideLoading();
        }
    });
}

// Setup search and filter for students
function setupSearchAndFilter() {
    const searchInput = document.getElementById('searchInput');
    const typeFilter = document.getElementById('typeFilter');
    
    const filterPosts = () => {
        const searchTerm = searchInput.value.toLowerCase();
        const type = typeFilter.value;
        
        let filtered = allPosts;
        
        if (searchTerm) {
            filtered = filtered.filter(post => 
                post.title.toLowerCase().includes(searchTerm) || 
                (post.description && post.description.toLowerCase().includes(searchTerm))
            );
        }
        
        if (type !== 'all') {
            filtered = filtered.filter(post => post.type === type);
        }
        
        displayStudentPosts(filtered);
    };
    
    if (searchInput) searchInput.addEventListener('input', filterPosts);
    if (typeFilter) typeFilter.addEventListener('change', filterPosts);
}

// Delete post (admin only)
window.deletePost = async (postId) => {
    if (!confirm('Are you sure you want to delete this material?')) return;
    
    showLoading();
    try {
        const { error } = await window.supabaseClient
            .from('posts')
            .delete()
            .eq('id', postId);
        
        if (error) throw error;
        
        showAlert('Material deleted successfully!', false);
        
        // Reload posts
        await loadPosts();
        
    } catch (error) {
        console.error('Delete post error:', error);
        showAlert(error.message || 'Error deleting material');
    } finally {
        hideLoading();
    }
};

// Helper function to escape HTML
function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Initialize dashboard
initDashboard();
