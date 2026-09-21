// --- 1. Firebase Configuration ---
const firebaseConfig = {
    apiKey: "AIzaSyAAcJtQ-rr-7FRLOjipC1XNsHgODLCvs00",
    authDomain: "smart-city-ada8d.firebaseapp.com",
    projectId: "smart-city-ada8d",
    messagingSenderId: "198348279885",
    appId: "1:198348279885:web:cb24e8196a3f7bc05ecc04",
    measurementId: "G-144YHLM2GJ"
};

// Initialize Firebase
let auth = null;
let db = null;
let firestore = null;
let map = null;
let markers = [];

if (typeof firebase !== 'undefined' && firebase.initializeApp) {
    try {
        // Avoid re-initializing if already done by auth.js
        if (!firebase.apps.length) {
            firebase.initializeApp(firebaseConfig);
        }
        auth = firebase.auth();
        db = firebase.firestore();
        firestore = firebase.firestore();
    } catch (e) {
        console.error('Firebase initialization error', e);
    }
}

// --- 2. Initialize Admin Dashboard (Auth-Gated) ---
document.addEventListener('DOMContentLoaded', async () => {
    try {
        // Auth gate: redirect to login if not authenticated
        const user = await checkAdminAuth();
        
        // Show admin initials in avatar
        const avatar = document.getElementById('adminAvatar');
        if (avatar && user.email) {
            const initials = user.email.substring(0, 2).toUpperCase();
            avatar.textContent = initials;
            avatar.title = user.email;
        }
        
        // Initialize dashboard only after auth is verified
        // Reveal the hidden dashboard with smooth fade-in
        const dashboardRoot = document.getElementById('dashboardRoot');
        if (dashboardRoot) dashboardRoot.style.opacity = '1';
        
        initAdminMap();
        loadDashboardStats();
        loadRecentReports();
        loadPriorityQueue();
        loadResolvedReports();
        setupRealtimeListeners();
    } catch (error) {
        // checkAdminAuth redirects to login, so this won't normally run
        console.log('Auth check failed, redirecting...');
    }
});

// --- 3. Admin Map with Markers ---
function initAdminMap() {
    const mapElement = document.getElementById('adminMap');
    if (!mapElement || typeof L === 'undefined') return;

    map = L.map('adminMap').setView([20.5937, 78.9629], 5);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap contributors'
    }).addTo(map);
}

function updateMapMarkers(reports) {
    if (!map) return;
    
    markers.forEach(marker => map.removeLayer(marker));
    markers = [];

    const priorityColors = {
        'critical': '#dc2626',
        'high': '#f97316',
        'medium': '#fbbf24',
        'low': '#22c55e'
    };

    reports.forEach(doc => {
        const data = doc.data();
        if (data.latitude && data.longitude) {
            const priority = data.priority || 'medium';
            const color = priorityColors[priority] || priorityColors['medium'];
            
            const marker = L.circleMarker([data.latitude, data.longitude], {
                radius: 10,
                fillColor: color,
                color: '#fff',
                weight: 2,
                opacity: 1,
                fillOpacity: 0.85
            }).addTo(map);

            marker.bindPopup(`
                <div class="text-sm">
                    <strong>${data.issue || 'Unknown'}</strong><br>
                    <span class="text-xs">Priority: <b>${priority.toUpperCase()}</b></span><br>
                    <span class="text-xs">Status: ${data.status}</span><br>
                    <span class="text-xs text-gray-500">${data.address || 'No address'}</span>
                </div>
            `);

            markers.push(marker);
        }
    });

    if (markers.length > 0) {
        const group = L.featureGroup(markers);
        map.fitBounds(group.getBounds().pad(0.1));
    }
}

// --- 4. Dashboard Stats ---
async function loadDashboardStats() {
    // Try Firebase first, fall back to REST API
    if (db) {
        try {
            const reportsSnapshot = await db.collection('reports').get();
            const total = reportsSnapshot.size;
            
            let pending = 0;
            let resolved = 0;
            let critical = 0;
            let high = 0;

            reportsSnapshot.forEach(doc => {
                const data = doc.data();
                if (data.status === 'pending' || data.status === 'active') pending++;
                if (data.status === 'resolved') resolved++;
                if (data.priority === 'critical') critical++;
                if (data.priority === 'high') high++;
            });

            updateStatCard('totalReports', total);
            updateStatCard('pendingAction', pending);
            updateStatCard('resolved', resolved);
            updateStatCard('critical', critical);
            updateStatCard('highPriority', high);
            return;
        } catch (error) {
            console.warn('Firebase stats failed, trying REST API...', error);
        }
    }

    // Fallback: REST API (with auth token)
    try {
        const response = await authFetch('/api/stats');
        const stats = await response.json();
        updateStatCard('totalReports', stats.total);
        updateStatCard('pendingAction', stats.pending);
        updateStatCard('resolved', stats.resolved);
        updateStatCard('critical', stats.critical);
        updateStatCard('highPriority', stats.high);
    } catch (error) {
        console.error('Error loading stats from API:', error);
    }
}

function updateStatCard(elementId, value) {
    const element = document.querySelector(`[data-stat="${elementId}"]`);
    if (element) {
        element.textContent = value;
        return;
    }
    
    const cards = document.querySelectorAll('.bg-white\\/90.rounded-2xl');
    const statMap = {
        'totalReports': 0,
        'pendingAction': 1,
        'resolved': 2,
        'critical': 3,
        'highPriority': 4
    };
    
    const index = statMap[elementId];
    if (cards[index]) {
        const numberEl = cards[index].querySelector('.font-display.text-3xl, .text-3xl');
        if (numberEl) numberEl.textContent = value;
    }
}

// --- Priority Badge Functions ---
function getPriorityBadge(priority) {
    const badges = {
        'critical': 'bg-red-100 text-red-700 border-red-300',
        'high': 'bg-orange-100 text-orange-700 border-orange-300',
        'medium': 'bg-amber-100 text-amber-700 border-amber-300',
        'low': 'bg-green-100 text-green-700 border-green-300'
    };
    return badges[priority] || badges['medium'];
}

function getStatusColor(status) {
    const colors = {
        'pending': 'bg-rose-500',
        'active': 'bg-sky-500',
        'resolved': 'bg-emerald-500'
    };
    return colors[status] || colors['pending'];
}

function getStatusBadge(status) {
    const badges = {
        'pending': 'bg-rose-100 text-rose-700',
        'active': 'bg-sky-100 text-sky-700',
        'resolved': 'bg-emerald-100 text-emerald-700'
    };
    return badges[status] || badges['pending'];
}

// --- 5. Recent Reports List ---
function loadRecentReports() {
    const reportsList = document.getElementById('reportsList');
    if (!reportsList) return;

    // Try Firebase first
    if (db) {
        console.log('Loading reports from Firebase...');
        db.collection('reports')
            .get()
            .then((snapshot) => {
                console.log('Reports loaded:', snapshot.size);
                renderReportsList(reportsList, snapshot.docs.map(doc => ({ id: doc.id, data: doc.data() })));
                updateMapMarkers(snapshot.docs);
            })
            .catch((error) => {
                console.warn('Firebase reports failed, trying REST API...', error);
                loadReportsFromAPI(reportsList);
            });
    } else {
        loadReportsFromAPI(reportsList);
    }
}

// Fallback: Load reports from REST API (with auth token)
async function loadReportsFromAPI(reportsList) {
    try {
        const response = await authFetch('/api/reports');
        const result = await response.json();
        if (result.reports) {
            const docsArray = result.reports.map(r => ({ id: r.id, data: r }));
            renderReportsList(reportsList, docsArray);
        }
    } catch (error) {
        console.error('Error loading reports from API:', error);
        reportsList.innerHTML = '<div class="py-4 text-slate-500 italic">Could not load reports. Is the backend running?</div>';
    }
}

// Shared renderer for reports list
function renderReportsList(reportsList, docsArray) {
    reportsList.innerHTML = '';
    
    if (!docsArray || docsArray.length === 0) {
        reportsList.innerHTML = '<div class="py-4 text-slate-500 italic">No reports found.</div>';
        return;
    }

    docsArray.sort((a, b) => {
        const dateA = a.data.createdAt ? (a.data.createdAt.seconds || new Date(a.data.createdAt).getTime() / 1000) : 0;
        const dateB = b.data.createdAt ? (b.data.createdAt.seconds || new Date(b.data.createdAt).getTime() / 1000) : 0;
        return dateB - dateA;
    });

    const sortedDocs = docsArray.slice(0, 20);

    sortedDocs.forEach(doc => {
        const data = doc.data;
        let createdDate = 'Unknown';
        if (data.createdAt) {
            if (data.createdAt.seconds) {
                createdDate = new Date(data.createdAt.seconds * 1000).toLocaleDateString();
            } else if (typeof data.createdAt === 'string') {
                createdDate = new Date(data.createdAt).toLocaleDateString();
            }
        }
        const priority = data.priority || 'medium';
        const docId = doc.id;
        
        const isResolved = data.status === 'resolved';
        
        // Build button HTML with proper z-index
        let actionButtons;
        if (isResolved) {
            actionButtons = '<span class="text-emerald-600 text-sm font-medium">✓ Resolved</span>';
        } else {
            const activeBtn = '<button type="button" onclick="window.updateReportStatus(\'' + docId + '\', \'active\')" class="relative z-10 px-2 py-1 text-xs bg-sky-100 text-sky-700 rounded hover:bg-sky-200 transition">Active</button>';
            const resolveBtn = '<button type="button" onclick="window.updateReportStatus(\'' + docId + '\', \'resolved\')" class="relative z-10 px-2 py-1 text-xs bg-emerald-100 text-emerald-700 rounded hover:bg-emerald-200 transition">Resolve</button>';
            actionButtons = '<div class="flex gap-2">' + activeBtn + resolveBtn + '</div>';
        }
        
        const item = document.createElement('div');
        item.className = 'py-4 flex items-center justify-between hover:bg-slate-50 transition border-b border-slate-100';
        item.innerHTML = `
            <div class="flex items-center gap-4">
                <div class="w-2 h-2 rounded-full ${getStatusColor(data.status)}"></div>
                <div>
                    <p class="font-medium text-slate-800">${data.issue || 'Unknown Issue'}</p>
                    <p class="text-xs text-slate-500">${data.address || 'No address'} • ${createdDate}</p>
                </div>
            </div>
            <div class="flex items-center gap-3">
                <span class="px-2 py-1 text-xs rounded-full border ${getPriorityBadge(priority)}">${priority.toUpperCase()}</span>
                <span class="px-2 py-1 text-xs rounded-full ${getStatusBadge(data.status)}">${data.status}</span>
                ${actionButtons}
            </div>
        `;
        reportsList.appendChild(item);
    });
}

// --- 6. Priority Queue ---
function loadPriorityQueue() {
    const queueContainer = document.querySelector('.space-y-6 > div:first-child .mt-4');
    if (!queueContainer || !db) return;

    db.collection('reports')
        .where('status', 'in', ['pending', 'active'])
        .orderBy('createdAt', 'asc')
        .limit(10)
        .onSnapshot((snapshot) => {
            queueContainer.innerHTML = '';
            
            if (snapshot.empty) {
                queueContainer.innerHTML = '<div class="text-slate-500 text-sm">No pending items</div>';
                return;
            }

            const priorityOrder = { 'critical': 0, 'high': 1, 'medium': 2, 'low': 3 };
            const sortedDocs = snapshot.docs.sort((a, b) => {
                const priorityA = priorityOrder[a.data().priority] ?? 2;
                const priorityB = priorityOrder[b.data().priority] ?? 2;
                return priorityA - priorityB;
            });

            sortedDocs.forEach(doc => {
                const data = doc.data();
                const priority = data.priority || 'medium';
                const priorityColor = {
                    'critical': 'bg-red-500',
                    'high': 'bg-orange-500',
                    'medium': 'bg-amber-400',
                    'low': 'bg-green-400'
                }[priority];
                
                const item = document.createElement('div');
                item.className = 'flex items-start gap-3 py-2';
                item.innerHTML = `
                    <span class="w-2.5 h-2.5 rounded-full ${priorityColor} mt-2"></span>
                    <div class="flex-1">
                        <p class="text-sm font-medium text-slate-800">${data.issue || 'Unknown'}</p>
                        <p class="text-xs text-slate-500">${data.address || 'No address'}</p>
                        <span class="text-xs ${priority === 'critical' ? 'text-red-600 font-bold' : 'text-slate-400'}">${priority.toUpperCase()} PRIORITY</span>
                    </div>
                `;
                queueContainer.appendChild(item);
            });
        });
}

// --- 6b. Resolved Reports Box ---
function loadResolvedReports() {
    const resolvedList = document.getElementById('resolvedList');
    const resolvedCount = document.getElementById('resolvedCount');
    if (!resolvedList || !db) return;

    db.collection('reports')
        .where('status', '==', 'resolved')
        .orderBy('createdAt', 'desc')
        .limit(20)
        .onSnapshot((snapshot) => {
            resolvedList.innerHTML = '';
            
            const count = snapshot.size;
            if (resolvedCount) {
                resolvedCount.textContent = `${count} resolved`;
            }
            
            if (snapshot.empty) {
                resolvedList.innerHTML = '<div class="py-4 text-slate-500 italic">No resolved reports yet.</div>';
                return;
            }

            snapshot.forEach(doc => {
                const data = doc.data();
                const createdDate = data.createdAt ? new Date(data.createdAt.seconds * 1000).toLocaleDateString() : 'Unknown';
                const resolvedDate = data.resolvedAt ? new Date(data.resolvedAt.seconds * 1000).toLocaleDateString() : createdDate;
                const priority = data.priority || 'medium';
                
                const item = document.createElement('div');
                item.className = 'py-4 flex items-center justify-between hover:bg-slate-50 transition border-b border-slate-100';
                item.innerHTML = `
                    <div class="flex items-center gap-4">
                        <div class="w-2 h-2 rounded-full bg-emerald-500"></div>
                        <div>
                            <p class="font-medium text-slate-800">${data.issue || 'Unknown Issue'}</p>
                            <p class="text-xs text-slate-500">${data.address || 'No address'} • Resolved: ${resolvedDate}</p>
                        </div>
                    </div>
                    <div class="flex items-center gap-3">
                        <span class="px-2 py-1 text-xs rounded-full border ${getPriorityBadge(priority)}">${priority.toUpperCase()}</span>
                        <span class="px-2 py-1 text-xs rounded-full bg-emerald-100 text-emerald-700">Resolved</span>
                    </div>
                `;
                resolvedList.appendChild(item);
            });
        });
}

// --- 7. Real-time Listeners ---
function setupRealtimeListeners() {
    if (!db) return;

    db.collection('reports').onSnapshot(() => {
        loadDashboardStats();
    });
}

// --- 8. Update Report Status ---
window.updateReportStatus = function(reportId, newStatus) {
    console.log('Updating report:', reportId, 'to status:', newStatus);
    
    // Try Firebase first
    if (db) {
        const updateData = { status: newStatus };
        if (newStatus === 'resolved' && firebase.firestore) {
            updateData.resolvedAt = firebase.firestore.FieldValue.serverTimestamp();
        }
        
        db.collection('reports').doc(reportId).update(updateData)
        .then(() => {
            console.log('Status updated via Firebase!');
            alert('✅ Report marked as ' + newStatus.toUpperCase());
            loadDashboardStats();
            loadRecentReports();
        })
        .catch(error => {
            console.warn('Firebase update failed, trying REST API...', error);
            updateReportViaAPI(reportId, newStatus);
        });
    } else {
        updateReportViaAPI(reportId, newStatus);
    }
}

// Fallback: Update via REST API (with auth token)
async function updateReportViaAPI(reportId, newStatus) {
    try {
        const formData = new FormData();
        formData.append('new_status', newStatus);
        
        const response = await authFetch(`/api/reports/${reportId}/status`, {
            method: 'PUT',
            body: formData
        });
        const result = await response.json();
        if (response.ok) {
            alert('✅ Report marked as ' + newStatus.toUpperCase());
            loadDashboardStats();
            loadRecentReports();
        } else {
            alert('Error: ' + (result.error || 'Unknown error'));
        }
    } catch (error) {
        console.error('Error updating via API:', error);
        alert('Error: Could not update report. Is the backend running?');
    }
}

// --- 9. Mobile Menu ---
const mobileMenuButton = document.getElementById('mobileMenuButton');
const mobileMenu = document.getElementById('mobileMenu');
if (mobileMenuButton && mobileMenu) {
    mobileMenuButton.addEventListener('click', () => {
        mobileMenu.classList.toggle('hidden');
    });
}

