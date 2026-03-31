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
            
            // Check if user exists in users table
            let { data: userData, error: userError } = await window.supabaseClient
                .from('users')
                .select('*')
                .eq('id', data.user.id)
                .single();
            
            // If user doesn't exist in users table, create them
            if (userError || !userData) {
                const { data: newUser, error: createError } = await window.supabaseClient
                    .from('users')
                    .insert({
                        id: data.user.id,
                        email: email,
                        full_name: data.user.user_metadata?.full_name || email.split('@')[0],
                        role: 'student',
                        created_at: new Date().toISOString()
                    })
                    .select()
                    .single();
                
                if (createError) {
                    console.error('User creation error:', createError);
                    throw new Error('Failed to create user profile');
                }
                
                userData = newUser;
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
                    .insert({
                        id: data.user.id,
                        email: email,
                        full_name: fullName,
                        role: 'student',
                        created_at: new Date().toISOString()
                    });
                
                if (insertError) {
                    console.error('Insert error:', insertError);
                    // If insert fails but user is created, still show success
                    showAlert('Account created! Please login.', false);
                    window.location.href = '/login.html';
                    return;
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

// Check auth on auth pages
if (window.location.pathname.includes('login.html') || window.location.pathname.includes('signup.html')) {
    checkAuthRedirect();
}
