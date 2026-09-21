import { initializeApp } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-app.js";
import { getVertexAI, getGenerativeModel } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-vertexai.js";

// Same config as app.js
const firebaseConfig = {
    apiKey: "AIzaSyAAcJtQ-rr-7FRLOjipC1XNsHgODLCvs00",
    authDomain: "smart-city-ada8d.firebaseapp.com",
    projectId: "smart-city-ada8d",
    messagingSenderId: "198348279885",
    appId: "1:198348279885:web:cb24e8196a3f7bc05ecc04",
    measurementId: "G-144YHLM2GJ"
};

// Initialize Firebase App
const app = initializeApp(firebaseConfig, "ChatbotApp"); // Name it so it doesn't conflict with compat app

// Initialize Vertex AI
const vertexAI = getVertexAI(app);

// Use Gemini 2.5 Flash for fast chat responses
const model = getGenerativeModel(vertexAI, { 
    model: "gemini-2.5-flash",
    systemInstruction: `You are the City Assistant AI for the 'SmartCity' web platform.
    
    The SmartCity platform allows citizens to report urban issues (potholes, traffic, garbage etc.) through the 'Citizen Panel'. It uses YOLOv8 AI to automatically detect the issue in uploaded images and assigns a priority.
    There is an 'Admin Dashboard' for city officials to track, manage, and resolve these issues in real-time.
    There is also an 'Insights' page that uses machine learning to forecast traffic flow and monitor environmental quality (AQI) based on sensors.
    
    Your job is to answer questions about how to use the platform, describe its functionality, and provide real-life use cases (e.g., "A citizen takes a photo of a broken streetlight, the AI flags it as critical, and the maintenance team is dispatched via the Admin Dashboard").
    
    Keep your answers friendly, clear, and relatively brief. Do not invent features that don't exist in the description above.`
});

// Chat history state
// Chat history state
let chatHistory = [];

// Initialize Chat
function initChat() {
    const chatToggle = document.getElementById('chat-toggle');
    const chatWindow = document.getElementById('chat-window');
    const closeChat = document.getElementById('close-chat');
    const chatInput = document.getElementById('chat-input');
    const sendChat = document.getElementById('send-chat');
    const chatMessages = document.getElementById('chat-messages');

    if (!chatToggle) {
        console.error("Chat UI elements not found!");
        return;
    }

    // Toggle Chat Window
    function toggleChat() {
        if (chatWindow.classList.contains('hidden')) {
            chatWindow.classList.remove('hidden');
            // small delay to allow display block to apply before animating opacity
            setTimeout(() => {
                chatWindow.classList.remove('scale-95', 'opacity-0');
                chatWindow.classList.add('scale-100', 'opacity-100');
            }, 10);
            chatInput.focus();
        } else {
            chatWindow.classList.remove('scale-100', 'opacity-100');
            chatWindow.classList.add('scale-95', 'opacity-0');
            setTimeout(() => {
                chatWindow.classList.add('hidden');
            }, 300);
        }
    }

    chatToggle.addEventListener('click', toggleChat);
    closeChat.addEventListener('click', toggleChat);

    // Send Message
    async function sendMessage() {
        const text = chatInput.value.trim();
        if (!text) return;

        // Add User Message to UI
        appendMessage(text, 'user');
        chatInput.value = '';
        chatInput.disabled = true;
        sendChat.disabled = true;

        // Create waiting indicator
        const typingId = 'typing-' + Date.now();
        appendMessage('...', 'ai', typingId);

        try {
            // Build conversation history for the model
            const history = chatHistory.map(msg => ({
                role: msg.role === 'user' ? 'user' : 'model',
                parts: [{ text: msg.text }]
            }));

            const chat = model.startChat({
                history: history
            });

            // Call to Gemini via Vertex AI SDK
            const result = await chat.sendMessage(text);
            const responseText = result.response.text();

            // Remove typing indicator and add real response
            document.getElementById(typingId)?.remove();
            appendMessage(responseText, 'ai');

            // Save to history
            chatHistory.push({ role: 'user', text: text });
            chatHistory.push({ role: 'ai', text: responseText });

        } catch (error) {
            console.error("Chat error:", error);
            document.getElementById(typingId)?.remove();
            
            // Extract a readable error message
            let errMsg = error.message || error.toString();
            if (errMsg.includes("API key not valid") || errMsg.includes("not enabled")) {
                errMsg += "\n\n💡 Note: Firebase Vertex AI requires the Firebase project to have a credit card attached (Blaze Plan) and the Vertex AI API enabled in Google Cloud. If you want to use Gemini for free without a credit card, we need to switch from the Firebase SDK to the standard Google Gen AI SDK.";
            }
            
            appendMessage(`**System Error:** ${errMsg}`, 'ai');
        } finally {
            chatInput.disabled = false;
            sendChat.disabled = false;
            chatInput.focus();
        }
    }

    sendChat.addEventListener('click', sendMessage);
    chatInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            sendMessage();
        }
    });

    // Helper to append message
    function appendMessage(text, sender, id = null) {
        const msgDiv = document.createElement('div');
        if (id) msgDiv.id = id;
        
        if (sender === 'user') {
            msgDiv.className = 'self-end bg-teal-600 text-white rounded-2xl rounded-tr-sm px-4 py-2 text-sm max-w-[85%] shadow-sm';
            msgDiv.textContent = text;
        } else {
            msgDiv.className = 'self-start bg-slate-200 text-slate-800 rounded-2xl rounded-tl-sm px-4 py-2 text-sm max-w-[85%] shadow-sm font-sans whitespace-pre-wrap';
            // Simple markdown-style bolding parsing
            const formattedText = text.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
            msgDiv.innerHTML = formattedText;
        }

        chatMessages.appendChild(msgDiv);
        chatMessages.scrollTop = chatMessages.scrollHeight;
    }
}

initChat();
