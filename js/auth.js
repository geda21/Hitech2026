// Login handler
if (document.getElementById('loginForm')) {
    document.getElementById('loginForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        showLoading();
        
        try {
            const email = document.getElementById('email').value;
            const password = document.getElementById('password').value;
            
            const { data, error } = await window.supabaseClient.auth.signInWithPassword({
                email,
                password
            });
            
            if (error) throw error;
            
            // Get user role
            const { data: userData, error: roleError } = await window.supabaseClient
                .from('users')
                .select('role')
                .eq('id', data.user.id)
                .single();
            
            if (roleError) throw roleError;
            
            // Redirect based on role
            if (userData.role === 'admin') {
                window.location.href = '/admin.html';
            } else {
                window.location.href = '/student.html';
            }
        } catch (error) {
            showAlert(error.message);
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
                            role: 'student'
                        }
                    ]);
                
                if (insertError) throw insertError;
                
                showAlert('Account created successfully! Please login.', false);
                window.location.href = '/login.html';
            }
        } catch (error) {
            showAlert(error.message);
        } finally {
            hideLoading();
        }
    });
}

// Check if user is already logged in on auth pages
async function checkAuthRedirect() {
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
}

// Initialize
if (window.location.pathname.includes('login.html') || window.location.pathname.includes('signup.html')) {
    checkAuthRedirect();
}
