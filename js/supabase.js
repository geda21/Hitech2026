// Supabase Configuration - NEW PROJECT
const SUPABASE_URL = "https://tjmcerpesqxkdbxgrfya.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_UFwWOviiyVuaMluCJoygDw_dUm7FN7H";

// Initialize Supabase Client
window.supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Helper function to show/hide loading
window.showLoading = () => {
    const loadingDiv = document.getElementById('loading');
    if (loadingDiv) loadingDiv.style.display = 'flex';
};

window.hideLoading = () => {
    const loadingDiv = document.getElementById('loading');
    if (loadingDiv) loadingDiv.style.display = 'none';
};

// Helper function to show alert
window.showAlert = (message, isError = true) => {
    if (isError) {
        alert('❌ ' + message);
    } else {
        alert('✅ ' + message);
    }
};

// Check if user is authenticated
window.checkAuth = async () => {
    try {
        const { data: { session }, error } = await window.supabaseClient.auth.getSession();
        if (error) {
            console.error('Auth check error:', error);
            window.location.href = '/login.html';
            return null;
        }
        if (!session) {
            window.location.href = '/login.html';
            return null;
        }
        return session;
    } catch (error) {
        console.error('Auth check error:', error);
        window.location.href = '/login.html';
        return null;
    }
};

// Get user role
window.getUserRole = async (userId) => {
    try {
        const { data, error } = await window.supabaseClient
            .from('users')
            .select('role')
            .eq('id', userId)
            .single();
        
        if (error) {
            console.error('Get role error:', error);
            return null;
        }
        return data?.role;
    } catch (error) {
        console.error('Get role error:', error);
        return null;
    }
};

// Check if user is admin
window.isAdmin = async () => {
    const session = await window.supabaseClient.auth.getSession();
    if (!session.data.session) return false;
    
    const { data } = await window.supabaseClient
        .from('users')
        .select('role')
        .eq('id', session.data.session.user.id)
        .single();
    
    return data?.role === 'admin';
};
