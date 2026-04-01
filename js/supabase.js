// Supabase Configuration
const SUPABASE_URL = "https://soyakvlfqrhjnecyscxy.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_1GSfqmi0JtuEtdZ7u75c1w_OmYDrdsO";

// Initialize Supabase Client
window.supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Helper functions
window.showLoading = () => {
    const loadingDiv = document.getElementById('loading');
    if (loadingDiv) loadingDiv.style.display = 'flex';
};

window.hideLoading = () => {
    const loadingDiv = document.getElementById('loading');
    if (loadingDiv) loadingDiv.style.display = 'none';
};

window.showAlert = (message, isError = true) => {
    alert(`${isError ? '❌' : '✅'} ${message}`);
};

window.checkAuth = async () => {
    try {
        const { data: { session }, error } = await window.supabaseClient.auth.getSession();
        if (error || !session) {
            window.location.href = '/login.html';
            return null;
        }
        return session;
    } catch (error) {
        window.location.href = '/login.html';
        return null;
    }
};
