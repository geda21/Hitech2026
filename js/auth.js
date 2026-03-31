// Initialize database tables if they don't exist
async function initializeDatabase() {
    try {
        // Check if users table exists by trying to select from it
        const { error: usersError } = await window.supabaseClient
            .from('users')
            .select('id')
            .limit(1);
        
        if (usersError && usersError.message.includes('does not exist')) {
            console.log('Users table does not exist. Please run the SQL setup script.');
            showAlert('Database not initialized. Please contact administrator.', true);
        }
        
        // Check if posts table exists
        const { error: postsError } = await window.supabaseClient
            .from('posts')
            .select('id')
            .limit(1);
        
        if (postsError && postsError.message.includes('does not exist')) {
            console.log('Posts table does not exist. Please run the SQL setup script.');
            showAlert('Database not initialized. Please contact administrator.', true);
        }
        
        // Check if files bucket exists
        const { data: buckets, error: bucketsError } = await window.supabaseClient
            .storage
            .listBuckets();
        
        if (!bucketsError) {
            const filesBucket = buckets.find(b => b.name === 'files');
            if (!filesBucket) {
                console.log('Creating files bucket...');
                const { error: createError } = await window.supabaseClient.storage.createBucket('files', {
                    public: true
                });
                if (createError) {
                    console.error('Error creating bucket:', createError);
                } else {
                    console.log('Files bucket created successfully');
                }
            }
        }
    } catch (error) {
        console.error('Database initialization error:', error);
    }
}

// Login handler
if (document.getElementById('loginForm')) {
    document.getElementById('loginForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        showLoading();
        
        try {
            const email = document.getElementById('email').value;
            const password = document.getElementById('password').value;
            
            if (!email || !password) {
                throw new Error('Please enter email and password');
            }
            
            const { data, error } = await window.supabaseClient.auth.signInWithPassword({
                email,
                password
            });
            
            if (error) throw error;
            
            if (!data.user) {
                throw new Error('Login failed');
            }
            
            // Get user role from users table
            const { data: userData, error: roleError } = await window.supabaseClient
                .from('users')
                .select('role')
                .eq('id', data.user.id)
                .single();
            
            if (roleError) {
                console.error('Role fetch error:', roleError);
                // If user doesn't exist in users table, create it
                if (roleError.message.includes('not found')) {
                    const { error: insertError } = await window.supabaseClient
                        .from('users')
                        .insert([
                            {
                                id: data.user.id,
                                email: email,
                                full_name: data.user.user_metadata?.full_name || email.split('@')[0],
                                role: 'student'
                            }
                        ]);
                    
                    if (insertError) throw insertError;
                    
                    // Redirect to student dashboard
                    window.location.href = '/student.html';
                    return;
                }
                throw roleError;
            }
            
            // Redirect based on role
            if (userData.role === 'admin') {
                window.location.href = '/admin.html';
            } else {
                window.location.href = '/student.html';
            }
            
        } catch (error) {
            console.error('Login error:', error);
            showAlert(error.message || 'Login failed. Please check your credentials.');
        } finally {
            hideLoading();
        }
    });
}

// Signup handler
if (document.getElementById('signupForm')) {
    document.getElementById('signupForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        showLoading();
        
        try {
            const fullName = document.getElementById('fullName').value;
            const email = document.getElementById('email').value;
            const password = document.getElementById('password').value;
            
            if (!fullName || !email || !password) {
                throw new Error('Please fill in all fields');
            }
            
            if (password.length < 6) {
                throw new Error('Password must be at least 6 characters');
            }
            
            // Create user in Supabase Auth
            const { data, error } = await window.supabaseClient.auth.signUp({
                email,
                password,
                options: {
                    data: {
                        full_name: fullName
                    }
                }
            });
            
            if (error) throw error;
            
            if (data.user) {
                // Insert into users table with role 'student'
                const { error: insertError } = await window.supabaseClient
                    .from('users')
                    .insert([
                        {
                            id: data.user.id,
                            email: email,
                            full_name: fullName,
                            role: 'student',
                            created_at: new Date().toISOString()
                        }
                    ]);
                
                if (insertError) {
                    console.error('Insert error:', insertError);
                    // If insert fails but user is created, still show success
                    if (insertError.message.includes('duplicate')) {
                        showAlert('Account created! Please login.', false);
                        window.location.href = '/login.html';
                        return;
                    }
                    throw insertError;
                }
                
                showAlert('Account created successfully! Please login.', false);
                window.location.href = '/login.html';
            }
        } catch (error) {
            console.error('Signup error:', error);
            showAlert(error.message || 'Signup failed. Please try again.');
        } finally {
            hideLoading();
        }
    });
}

// Check if user is already logged in on auth pages
async function checkAuthRedirect() {
    try {
        const { data: { session } } = await window.supabaseClient.auth.getSession();
        if (session) {
            const { data: userData } = await window.supabaseClient
                .from('users')
                .select('role')
                .eq('id', session.user.id)
                .single();
            
            if (userData) {
                if (userData.role === 'admin') {
                    window.location.href = '/admin.html';
                } else {
                    window.location.href = '/student.html';
                }
            }
        }
    } catch (error) {
        console.error('Auth redirect check error:', error);
    }
}

// Initialize database and check auth
initializeDatabase();
if (window.location.pathname.includes('login.html') || window.location.pathname.includes('signup.html')) {
    checkAuthRedirect();
}
