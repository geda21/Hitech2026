// Login handler
if (document.getElementById('loginForm')) {
    document.getElementById('loginForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        showLoading();
        
        try {
            const email = document.getElementById('email').value;
            const password = document.getElementById('password').value;
            
            // Login with Supabase Auth
            const { data, error } = await window.supabaseClient.auth.signInWithPassword({
                email,
                password
            });
            
            if (error) throw error;
            
            // Get or create user profile
            let { data: userData } = await window.supabaseClient
                .from('users')
                .select('*')
                .eq('id', data.user.id)
                .single();
            
            if (!userData) {
                // Create new user profile
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
                
                if (createError) throw createError;
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
            showAlert(error.message || 'Login failed');
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
            
            if (password.length < 6) {
                throw new Error('Password must be at least 6 characters');
            }
            
            // Create user in Supabase Auth
            const { data, error } = await window.supabaseClient.auth.signUp({
                email,
                password,
                options: { data: { full_name: fullName } }
            });
            
            if (error) throw error;
            
            if (data.user) {
                // Create user profile
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
                    showAlert('Account created! Please login.', false);
                    window.location.href = '/login.html';
                    return;
                }
                
                showAlert('Account created successfully! Please login.', false);
                window.location.href = '/login.html';
            }
        } catch (error) {
            console.error('Signup error:', error);
            showAlert(error.message || 'Signup failed');
        } finally {
            hideLoading();
        }
    });
}

// Check if already logged in
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
                window.location.href = userData.role === 'admin' ? '/admin.html' : '/student.html';
            }
        }
    } catch (error) {
        console.error('Auth redirect error:', error);
    }
}

// Run auth check on login/signup pages
if (window.location.pathname.includes('login.html') || window.location.pathname.includes('signup.html')) {
    checkAuthRedirect();
}
