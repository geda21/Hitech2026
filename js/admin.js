let allPosts = [];
let currentUserProfile = null;
let currentUser = null;

async function initAdminDashboard() {
    console.log('Initializing admin dashboard...');
    showLoading();
    
    try {
        const session = await checkAuth();
        if (!session) {
            console.log('No session, redirecting to login');
            window.location.href = '/login.html';
            return;
        }
        
        currentUser = session.user;
        console.log('Admin user:', currentUser.email);
        
        // Get user profile and verify admin role
        const { data: userProfile, error: profileError } = await window.supabaseClient
            .from('users')
            .select('*')
            .eq('id', session.user.id)
            .single();
        
        if (profileError || !userProfile) {
            console.error('Profile error:', profileError);
            showAlert('Error loading profile');
            window.location.href = '/login.html';
            return;
        }
        
        currentUserProfile = userProfile;
        console.log('User role:', currentUserProfile.role);
        
        // Check if user is admin
        if (currentUserProfile.role !== 'admin') {
            showAlert('Access denied. Admin only.');
            window.location.href = '/student.html';
            return;
        }
        
        // Display admin email (both desktop and mobile)
        const adminEmailEl = document.getElementById('adminEmail');
        if (adminEmailEl) adminEmailEl.textContent = currentUser.email;
        
        // Update mobile email
        const mobileAdminEmail = document.getElementById('mobileAdminEmail');
        if (mobileAdminEmail) mobileAdminEmail.textContent = currentUser.email;
        
        // Load stats
        await loadAdminStats();
        
        // Load posts
        await loadPosts();
        
        // Setup create post form
        setupCreatePostForm();
        
        // Setup logout buttons (FIXED - both desktop and mobile)
        const desktopLogoutBtn = document.getElementById('desktopLogoutBtn');
        if (desktopLogoutBtn) {
            desktopLogoutBtn.onclick = async () => {
                console.log('Logging out...');
                showLoading();
                await window.supabaseClient.auth.signOut();
                window.location.href = '/login.html';
            };
        }
        
        const mobileLogoutBtn = document.getElementById('mobileLogoutBtn');
        if (mobileLogoutBtn) {
            mobileLogoutBtn.onclick = async () => {
                console.log('Logging out...');
                showLoading();
                await window.supabaseClient.auth.signOut();
                window.location.href = '/login.html';
            };
        }
        
        // Setup refresh button
        const refreshBtn = document.getElementById('refreshBtn');
        if (refreshBtn) {
            refreshBtn.onclick = async () => {
                await loadPosts();
                await loadAdminStats();
                showAlert('Refreshed!', false);
            };
        }
        
        console.log('Admin dashboard initialized');
        
    } catch (error) {
        console.error('Admin dashboard error:', error);
        showAlert('Error loading admin dashboard: ' + error.message);
    } finally {
        hideLoading();
    }
}

async function loadAdminStats() {
    try {
        // Get total students
        const { count: studentCount, error: countError } = await window.supabaseClient
            .from('users')
            .select('*', { count: 'exact', head: true })
            .eq('role', 'student');
        
        const students = studentCount || 0;
        
        if (!countError) {
            const totalStudentsSpan = document.getElementById('totalStudents');
            if (totalStudentsSpan) totalStudentsSpan.textContent = students;
            
            // Update mobile stats
            const mobileTotalStudents = document.getElementById('mobileTotalStudents');
            if (mobileTotalStudents) mobileTotalStudents.textContent = students;
        }
        
        // Get total materials
        const { count: materialCount, error: materialError } = await window.supabaseClient
            .from('posts')
            .select('*', { count: 'exact', head: true });
        
        const materials = materialCount || 0;
        
        if (!materialError) {
            const totalMaterialsSpan = document.getElementById('totalMaterials');
            if (totalMaterialsSpan) totalMaterialsSpan.textContent = materials;
            
            // Update mobile stats
            const mobileTotalMaterials = document.getElementById('mobileTotalMaterials');
            if (mobileTotalMaterials) mobileTotalMaterials.textContent = materials;
        }
        
    } catch (error) {
        console.error('Load stats error:', error);
    }
}

async function loadPosts() {
    try {
        console.log('Loading posts...');
        const { data: posts, error } = await window.supabaseClient
            .from('posts')
            .select('*')
            .order('created_at', { ascending: false });
        
        if (error) {
            console.error('Load posts error:', error);
            showAlert('Error loading posts: ' + error.message);
            return;
        }
        
        allPosts = posts || [];
        console.log('Posts loaded:', allPosts.length);
        
        displayPosts(allPosts);
        
        // Update total materials in sidebar
        const totalMaterialsSpan = document.getElementById('totalMaterials');
        if (totalMaterialsSpan) totalMaterialsSpan.textContent = allPosts.length;
        
        const mobileTotalMaterials = document.getElementById('mobileTotalMaterials');
        if (mobileTotalMaterials) mobileTotalMaterials.textContent = allPosts.length;
        
    } catch (error) {
        console.error('Load posts error:', error);
        showAlert('Error loading posts');
    }
}

function displayPosts(posts) {
    const container = document.getElementById('postsContainer');
    if (!container) return;
    
    if (!posts || posts.length === 0) {
        container.innerHTML = `
            <div class="col-span-full text-center py-12 lg:py-16">
                <div class="text-5xl lg:text-6xl mb-4">📚</div>
                <h3 class="text-lg lg:text-xl font-bold mb-2">No materials yet</h3>
                <p class="text-gray-400 text-sm lg:text-base">Start by publishing your first learning material using the form above</p>
                <div class="mt-3 lg:mt-4 text-xs lg:text-sm text-purple-400">✨ Fill out the form and upload a file to get started</div>
            </div>
        `;
        return;
    }
    
    container.innerHTML = posts.map(post => `
        <div class="glass-card rounded-xl overflow-hidden post-card">
            ${renderAdminFilePreview(post)}
            <div class="p-4 lg:p-5">
                <div class="flex justify-between items-start mb-2 lg:mb-3">
                    <h3 class="text-base lg:text-lg font-bold line-clamp-2">${escapeHtml(post.title)}</h3>
                    <button onclick="deletePost('${post.id}')" class="text-red-400 hover:text-red-300 transition p-1">
                        <svg class="w-4 h-4 lg:w-5 lg:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path>
                        </svg>
                    </button>
                </div>
                ${post.description ? `<p class="text-gray-300 text-xs lg:text-sm mb-2 lg:mb-3 line-clamp-2">${escapeHtml(post.description)}</p>` : ''}
                <div class="flex flex-wrap justify-between items-center gap-2 mt-3 lg:mt-4 pt-2 lg:pt-3 border-t border-white/10">
                    <span class="text-xs px-2 py-1 ${post.audience === 'student' ? 'bg-green-600/30' : 'bg-purple-600/30'} rounded-full">
                        ${post.audience === 'student' ? '🎓 Student Exclusive' : '📚 General'}
                    </span>
                    <div class="flex gap-2">
                        <span class="text-xs text-gray-500">${post.type.toUpperCase()}</span>
                        <a href="${post.file_url}" target="_blank" class="text-purple-400 hover:text-purple-300 text-xs lg:text-sm flex items-center gap-1">
                            View →
                        </a>
                    </div>
                </div>
                <div class="mt-2 text-xs text-gray-500">
                    ${new Date(post.created_at).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })}
                </div>
            </div>
        </div>
    `).join('');
}

function renderAdminFilePreview(post) {
    if (post.type === 'image') {
        return `<img src="${post.file_url}" class="w-full h-36 lg:h-48 object-cover" alt="${post.title}">`;
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
            <div class="h-36 lg:h-48 bg-gradient-to-br from-purple-600 to-pink-600 flex items-center justify-center">
                <svg class="w-12 h-12 lg:w-16 lg:h-16 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z"></path>
                </svg>
            </div>
        `;
    }
}

function setupCreatePostForm() {
    const form = document.getElementById('createPostForm');
    if (!form) return;
    
    const fileInput = document.getElementById('postFile');
    const fileInfo = document.getElementById('fileInfo');
    
    if (fileInput && fileInfo) {
        fileInput.onchange = (e) => {
            if (e.target.files[0]) {
                const file = e.target.files[0];
                const fileSizeMB = (file.size / 1024 / 1024).toFixed(2);
                fileInfo.innerHTML = `
                    <svg class="w-10 h-10 lg:w-12 lg:h-12 mx-auto mb-2 lg:mb-3 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path>
                    </svg>
                    <div class="text-purple-400 font-semibold text-sm lg:text-base">${file.name}</div>
                    <div class="text-xs text-gray-400 mt-1">${fileSizeMB} MB</div>
                `;
                
                const postType = document.getElementById('postType');
                if (postType) {
                    if (file.type.startsWith('image/')) postType.value = 'image';
                    else if (file.type.startsWith('video/')) postType.value = 'video';
                    else if (file.type === 'application/pdf') postType.value = 'pdf';
                }
            } else {
                fileInfo.innerHTML = `
                    <svg class="w-10 h-10 lg:w-12 lg:h-12 mx-auto mb-2 lg:mb-3 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"></path>
                    </svg>
                    <p class="text-gray-400 text-sm">Click to upload or drag and drop</p>
                    <p class="text-xs text-gray-500 mt-2">Supports: Images, Videos, PDFs</p>
                `;
            }
        };
        
        const fileLabel = document.querySelector('.file-upload-area');
        if (fileLabel) {
            fileLabel.addEventListener('click', () => fileInput.click());
        }
    }
    
    form.onsubmit = async (e) => {
        e.preventDefault();
        showLoading();
        
        try {
            const title = document.getElementById('postTitle').value;
            const description = document.getElementById('postDescription').value;
            const audience = document.getElementById('postAudience').value;
            const type = document.getElementById('postType').value;
            const file = fileInput.files[0];
            
            if (!title || !file) {
                throw new Error('Please fill in title and select a file');
            }
            
            console.log('Uploading file:', file.name);
            
            const fileName = `${Date.now()}_${file.name}`;
            const { error: uploadError } = await window.supabaseClient.storage
                .from('files')
                .upload(fileName, file);
            
            if (uploadError) {
                console.error('Upload error:', uploadError);
                throw new Error('Upload failed: ' + uploadError.message);
            }
            
            const { data: { publicUrl } } = window.supabaseClient.storage
                .from('files')
                .getPublicUrl(fileName);
            
            console.log('File uploaded, URL:', publicUrl);
            
            const { error: insertError } = await window.supabaseClient
                .from('posts')
                .insert({
                    title: title,
                    description: description || '',
                    audience: audience,
                    file_url: publicUrl,
                    type: type,
                    user_id: currentUser.id,
                    created_at: new Date().toISOString()
                });
            
            if (insertError) {
                console.error('Insert error:', insertError);
                throw new Error('Database error: ' + insertError.message);
            }
            
            showAlert('Material published successfully!', false);
            
            form.reset();
            if (fileInfo) {
                fileInfo.innerHTML = `
                    <svg class="w-10 h-10 lg:w-12 lg:h-12 mx-auto mb-2 lg:mb-3 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"></path>
                    </svg>
                    <p class="text-gray-400 text-sm">Click to upload or drag and drop</p>
                    <p class="text-xs text-gray-500 mt-2">Supports: Images, Videos, PDFs</p>
                `;
            }
            
            await loadPosts();
            await loadAdminStats();
            
        } catch (error) {
            console.error('Create post error:', error);
            showAlert(error.message || 'Error publishing material');
        } finally {
            hideLoading();
        }
    };
}

window.deletePost = async (postId) => {
    if (!confirm('Delete this material? This action cannot be undone.')) return;
    
    showLoading();
    try {
        const { error } = await window.supabaseClient
            .from('posts')
            .delete()
            .eq('id', postId);
        
        if (error) throw error;
        
        showAlert('Material deleted successfully!', false);
        await loadPosts();
        await loadAdminStats();
        
    } catch (error) {
        console.error('Delete post error:', error);
        showAlert('Error deleting material: ' + error.message);
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

initAdminDashboard();
