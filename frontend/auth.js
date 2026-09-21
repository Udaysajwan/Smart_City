// auth.js — Shared Admin Authentication Utilities
// Include this BEFORE admin.js on any page that needs auth protection.

/**
 * Check if the current user is authenticated as an admin.
 * If not logged in or logged in anonymously, redirects to login page.
 * Returns a Promise that resolves with the authenticated user.
 */
function checkAdminAuth() {
    return new Promise((resolve, reject) => {
        if (typeof firebase === 'undefined' || !firebase.auth) {
            console.error('Firebase Auth SDK not loaded');
            window.location.href = 'admin-login.html';
            reject(new Error('Firebase not loaded'));
            return;
        }

        // Timeout: if auth state doesn't resolve in 5 seconds, redirect
        const timeout = setTimeout(() => {
            console.log('Auth check timed out, redirecting to login...');
            window.location.href = 'admin-login.html';
            reject(new Error('Auth timeout'));
        }, 5000);

        const unsubscribe = firebase.auth().onAuthStateChanged(async (user) => {
            unsubscribe(); // Only need to check once
            clearTimeout(timeout);
            
            if (user && !user.isAnonymous && user.email) {
                console.log('Admin authenticated:', user.email);
                resolve(user);
            } else {
                // If anonymous user exists (leftover), sign them out first
                if (user && user.isAnonymous) {
                    console.log('Anonymous session found, signing out...');
                    try { await firebase.auth().signOut(); } catch (e) { /* ignore */ }
                }
                console.log('Not authenticated, redirecting to login...');
                window.location.href = 'admin-login.html';
                reject(new Error('Not authenticated'));
            }
        });
    });
}

/**
 * Get the Firebase ID token for the current user.
 * Used to authenticate REST API calls to the backend.
 * Returns null if not authenticated.
 */
async function getAuthToken() {
    const user = firebase.auth().currentUser;
    if (!user || user.isAnonymous) return null;
    
    try {
        return await user.getIdToken(/* forceRefresh */ false);
    } catch (error) {
        console.error('Failed to get auth token:', error);
        return null;
    }
}

/**
 * Make an authenticated fetch request to the backend.
 * Automatically attaches the Firebase ID token as a Bearer token.
 */
async function authFetch(url, options = {}) {
    const token = await getAuthToken();
    
    if (!options.headers) {
        options.headers = {};
    }
    
    if (token) {
        options.headers['Authorization'] = `Bearer ${token}`;
    }
    
    return fetch(url, options);
}

/**
 * Logout the current admin and redirect to login page.
 */
async function adminLogout() {
    try {
        await firebase.auth().signOut();
        window.location.href = 'admin-login.html';
    } catch (error) {
        console.error('Logout error:', error);
        // Force redirect even on error
        window.location.href = 'admin-login.html';
    }
}
