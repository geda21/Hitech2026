// Supabase Configuration
const SUPABASE_URL = "https://soyakvlfqrhjnecyscxy.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_1GSfqmi0JtuEtdZ7u75c1w_OmYDrdsO";

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
    alert(message);
};

// Check if user is authenticated
window.checkAuth = async () => {
    const { data: { session }, error } = await window.supabaseClient.auth.getSession();
    if (error || !session) {
        window.location.href = '/login.html';
        return null;
    }
    return session;
};

// Get user role
window.getUserRole = async (userId) => {
    const { data, error } = await window.supabaseClient
        .from('users')
        .select('role')
        .eq('id', userId)
        .single();
    
    if (error) return null;
    return data?.role;
};
