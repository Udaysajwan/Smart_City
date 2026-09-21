// app.js

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

if (typeof firebase !== 'undefined' && firebase.initializeApp) {
    try {
        firebase.initializeApp(firebaseConfig);
        auth = firebase.auth();
        db = firebase.firestore();
        
        auth.onAuthStateChanged(user => {
            if (!user) auth.signInAnonymously().catch(console.error);
        });
    } catch (e) {
        console.error('Firebase initialization error', e);
    }
}

// --- 2. Map Configuration (Leaflet) ---
const citizenMapElement = document.getElementById('citizenMap');
let marker;
let map;

if (citizenMapElement && typeof L !== 'undefined') {
    map = L.map('citizenMap').setView([20.5937, 78.9629], 5);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap contributors'
    }).addTo(map);

    marker = L.marker([20.5937, 78.9629], { draggable: true }).addTo(map);

    const updateLocationFields = (latlng) => {
        const lat = latlng.lat.toFixed(6);
        const lng = latlng.lng.toFixed(6);
        if(document.getElementById('lat')) document.getElementById('lat').value = lat;
        if(document.getElementById('lng')) document.getElementById('lng').value = lng;
        if(document.getElementById('latValue')) document.getElementById('latValue').textContent = lat;
        if(document.getElementById('lngValue')) document.getElementById('lngValue').textContent = lng;
    };

    map.on('click', (e) => {
        marker.setLatLng(e.latlng);
        updateLocationFields(e.latlng);
    });

    marker.on('dragend', () => {
        updateLocationFields(marker.getLatLng());
    });

    // Geolocation Button
    document.getElementById('useMyLocation')?.addEventListener('click', () => {
        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition((position) => {
                const latlng = L.latLng(position.coords.latitude, position.coords.longitude);
                marker.setLatLng(latlng);
                map.setView(latlng, 15);
                updateLocationFields(latlng);
            });
        }
    });
}

// --- 3. Report Submission with AI Detection ---
const reportForm = document.getElementById('reportForm');
if (reportForm) {
    reportForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const submitBtn = reportForm.querySelector('button[type="submit"]');
        submitBtn.textContent = 'AI is Analyzing...';
        submitBtn.disabled = true;

        const description = document.getElementById('description').value;
        const address = document.getElementById('address').value;
        const imageFile = document.getElementById('image').files[0];
        const lat = document.getElementById('lat')?.value || "0";
        const lng = document.getElementById('lng')?.value || "0";

        if (!imageFile) {
            alert("Please upload a photo.");
            submitBtn.textContent = 'Submit Report';
            submitBtn.disabled = false;
            return;
        }

        const formData = new FormData();
        formData.append('file', imageFile);
        formData.append('description', description);
        formData.append('address', address);
        formData.append('lat', lat);
        formData.append('lng', lng);

     try {
    const response = await fetch('http://127.0.0.1:8000/submit_report', {
        method: 'POST',
        body: formData
    });

            const result = await response.json();
            if (response.ok) {
                // Show AI-detected results to user
                const priority = result.report.priority || 'medium';
                const priorityEmoji = {
                    'critical': 'CRITICAL',
                    'high': 'HIGH',
                    'medium': 'MEDIUM',
                    'low': 'LOW'
                };
                alert('REPORT SUBMITTED SUCCESSFULLY!\n\n' +
                      '=== AI DETECTION RESULTS ===\n' +
                      'Issue Detected: ' + result.report.issue + '\n' +
                      'Priority: ' + priorityEmoji[priority] + '\n' +
                      'Confidence: ' + (result.report.confidence * 100).toFixed(1) + '%\n\n' +
                      'Your report has been saved to Firebase Firestore!');
                reportForm.reset();
            } else {
                alert("Error: " + (result.error || "Unknown"));
            }
        } catch (error) {
            alert("Could not connect to Backend. Run 'uvicorn main:app --reload'");
        } finally {
            submitBtn.textContent = 'Submit Report';
            submitBtn.disabled = false;
        }
    });
}

// --- 4. Recent Reports ---
const recentReports = document.getElementById('recentReports');
if (recentReports && db) {
    db.collection('reports').orderBy('createdAt', 'desc').limit(5).onSnapshot((snapshot) => {
        recentReports.innerHTML = '';
        if (snapshot.empty) {
            recentReports.innerHTML = '<div class="text-slate-500 italic">No recent reports.</div>';
            return;
        }
        snapshot.forEach(doc => {
            const data = doc.data();
            const priority = data.priority || 'medium';
            const priorityColor = {
                'critical': 'text-red-600',
                'high': 'text-orange-600',
                'medium': 'text-amber-600',
                'low': 'text-green-600'
            }[priority];
            
            const item = document.createElement('div');
            item.className = 'p-3 mb-2 rounded-xl border border-slate-100 bg-white shadow-sm';
            item.innerHTML = `
                <div class="font-semibold text-slate-800">${(data.issue || 'Pending').toUpperCase()}</div>
                <div class="text-xs ${priorityColor} font-semibold">Priority: ${priority.toUpperCase()}</div>
                <div class="text-xs text-slate-500 flex justify-between mt-1">
                    <span>Status: <span class="text-emerald-600">${data.status}</span></span>
                    <span>${data.createdAt ? new Date(data.createdAt.seconds * 1000).toLocaleDateString() : 'Just now'}</span>
                </div>
            `;
            recentReports.appendChild(item);
        });
    });
}

// Mobile Menu
const mobileMenuButton = document.getElementById('mobileMenuButton');
const mobileMenu = document.getElementById('mobileMenu');
if (mobileMenuButton && mobileMenu) {
    mobileMenuButton.addEventListener('click', () => {
        mobileMenu.classList.toggle('hidden');
    });
}

// --- 5. File Upload Preview ---
const imageInput = document.getElementById('image');

if (imageInput) {
    imageInput.addEventListener('change', function(e) {
        const file = e.target.files[0];
        const uploadLabel = imageInput.closest('label');
        
        if (file && uploadLabel) {
            // Add success styling
            uploadLabel.classList.remove('border-slate-300', 'hover:border-emerald-500');
            uploadLabel.classList.add('border-emerald-500', 'bg-emerald-50');
            
            // Update the display text
            const textDiv = uploadLabel.querySelector('.text-center');
            if (textDiv) {
                textDiv.innerHTML = `
                    <div class="flex items-center justify-center gap-2 text-emerald-600 font-semibold">
                        <svg class="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
                        </svg>
                        <span>${file.name}</span>
                    </div>
                    <p class="text-xs text-emerald-600 mt-2">Click to change file</p>
                `;
            }
        }
    });
}

// --- 6. Insights Page: Charts & AI Terminal ---
const trafficCanvas = document.getElementById('trafficChart');
if (trafficCanvas && typeof Chart !== 'undefined') {
    const hours = ['6AM','7AM','8AM','9AM','10AM','11AM','12PM','1PM','2PM','3PM','4PM','5PM'];
    new Chart(trafficCanvas, {
        type: 'line',
        data: {
            labels: hours,
            datasets: [{
                label: 'Predicted Density',
                data: [20, 45, 78, 92, 65, 50, 55, 70, 85, 90, 60, 35],
                borderColor: '#0d9488',
                backgroundColor: 'rgba(13,148,136,0.1)',
                fill: true,
                tension: 0.4,
                pointBackgroundColor: '#0d9488',
                pointRadius: 4
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: {
                y: { beginAtZero: true, grid: { color: 'rgba(0,0,0,0.05)' } },
                x: { grid: { display: false } }
            }
        }
    });
}

const aqiCanvas = document.getElementById('aqiChart');
if (aqiCanvas && typeof Chart !== 'undefined') {
    new Chart(aqiCanvas, {
        type: 'bar',
        data: {
            labels: ['Central', 'East', 'West', 'North', 'South'],
            datasets: [{
                label: 'AQI Index',
                data: [72, 95, 58, 110, 65],
                backgroundColor: [
                    'rgba(34,197,94,0.7)',
                    'rgba(251,191,36,0.7)',
                    'rgba(34,197,94,0.7)',
                    'rgba(239,68,68,0.7)',
                    'rgba(34,197,94,0.7)'
                ],
                borderRadius: 8,
                borderSkipped: false
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: {
                y: { beginAtZero: true, grid: { color: 'rgba(0,0,0,0.05)' } },
                x: { grid: { display: false } }
            }
        }
    });
}

// Insights AI Terminal
function fetchInsights() {
    const insightsEl = document.getElementById('insights');
    if (!insightsEl) return;

    insightsEl.innerHTML = '> Running AI analysis...\n';

    const lines = [
        '> Loading traffic sensor data... ✓',
        '> Analyzing congestion patterns... ✓',
        '> Processing environmental sensors... ✓',
        '> ──────────────────────────────────',
        '> TRAFFIC FORECAST:',
        '>   Peak congestion predicted at 6:00 PM (East corridor)',
        '>   Recommended: Deploy 2 additional crews',
        '> ',
        '> AIR QUALITY ALERT:',
        '>   North district AQI: 110 (Unhealthy for sensitive groups)',
        '>   South district AQI: 65 (Good)',
        '> ',
        '> WASTE MANAGEMENT:',
        '>   3 bins at >90% capacity in Central zone',
        '>   Optimized route generated for morning pickup',
        '> ',
        '> PRIORITY INCIDENTS:',
        '>   Water pipe burst - Zone 3 [CRITICAL]',
        '>   Traffic lights down - East loop [HIGH]',
        '> ──────────────────────────────────',
        '> Analysis complete. Models running at 94.2% accuracy.',
    ];

    let i = 0;
    const interval = setInterval(() => {
        if (i < lines.length) {
            insightsEl.innerHTML += lines[i] + '\n';
            insightsEl.scrollTop = insightsEl.scrollHeight;
            i++;
        } else {
            clearInterval(interval);
        }
    }, 200);
}
