/**
 * AI Chef - The "Super Wow" Brain 🧠
 * Isolated module to ensure zero side-effects on the main app.
 */

class AIChef {
    constructor() {
        this.isOpen = false;
        this.provider = localStorage.getItem('aiChefProvider') || 'demo'; // demo, openai, ollama
        this.apiKey = localStorage.getItem('aiChefKey') || '';
        this.envApiKey = ''; // Loaded from backend
        this.model = localStorage.getItem('aiChefModel') || 'gpt-3.5-turbo';
        this.history = [];


        this.init();

        this.checkEnvConfig();
    }

    async checkEnvConfig() {
        if (window.Foodie && window.Foodie.getEnvConfig) {
            try {
                const config = await window.Foodie.getEnvConfig();
                if (config.openaiApiKey) {
                    this.envApiKey = config.openaiApiKey;
                    console.log('🤖 AI Chef: Loaded OpenAI API Key from environment');
                }
            } catch (e) {
                console.error('Failed to load env config', e);
            }
        }
    }

    init() {
        // Inject HTML
        const html = `
            <div id="aiChefTrigger" title="Ask AI Chef">
                <span style="font-size:32px;">🤖</span>
            </div>
  
            <div id="aiChefPanel">
                <div class="ai-header">
                    <div class="ai-title">
                        <span>👨‍🍳 AI Chef</span>
                        <span class="ai-badge" id="aiBadge">New</span>
                    </div>
                    <div style="display:flex; align-items:center; gap:8px;">
                        <button class="ai-icon-btn" id="aiClearBtn" title="Clear Chat">🗑️</button>
                        <button class="ai-close" id="aiCloseBtn">✕</button>
                    </div>
                </div>
  
                <!-- Chat Area -->
                <div id="aiChatHistory">
                    <div class="ai-msg ai-msg-bot">
                        Hello! I'm your AI Chef. 🍳<br><br>
                        I can help you plan meals, suggest recipes based on what's in your pantry, or answer cooking questions.<br><br>
                        <small>Currently in <b>${this.provider.toUpperCase()}</b> mode.</small>
                    </div>
                </div>
  
                <!-- Quick Chips -->
                <div class="ai-chips">
                    <button class="ai-chip" onclick="chef.chip('What can I cook with my pantry items?')">🥫 Pantry Search</button>
                    <button class="ai-chip" onclick="chef.chip('Suggest a healthy dinner for tonight')">🥗 Healthy Dinner</button>
                    <button class="ai-chip" onclick="chef.chip('How do I dice an onion?')">🔪 Technique</button>
                </div>
  
                <!-- Input Area -->
                <div class="ai-input-area">
                    <div class="ai-input-wrapper">
                        <textarea id="aiInput" placeholder="Ask anything... (Shift+Enter for new line)" rows="1"></textarea>
                        <button id="aiSendBtn">➤</button>
                    </div>
                    <div class="ai-settings-toggle" id="aiSettingsToggle">⚙️ Settings</div>
                </div>
  
                <!-- Settings Overlay -->
                <div id="aiSettingsOverlay">
                    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:20px;">
                        <h3 style="margin:0; color:white;">AI Settings</h3>
                        <button class="ai-close" id="aiSettingsClose">✕</button>
                    </div>
  
                    <div class="ai-form-group">
                        <label class="ai-label">Provider</label>
                        <select id="aiProviderSelect" class="ai-select">
                            <option value="demo">Demo Mode (Free, Pre-set)</option>
                            <option value="openai">OpenAI (Requires Key)</option>
                            <option value="ollama">Local LLM (Ollama)</option>
                        </select>
                    </div>
  
                    <div class="ai-form-group" id="aiKeyGroup" style="display:none;">
                        <label class="ai-label">API Key</label>
                        <input type="password" id="aiApiKey" class="ai-text-input" placeholder="sk-..." />
                    </div>
  
                    <div class="ai-form-group" id="aiModelGroup" style="display:none;">
                        <label class="ai-label">Model Name</label>
                        <input type="text" id="aiModel" class="ai-text-input" placeholder="e.g. gpt-4o, llama3" />
                    </div>
  
                    <button class="primary" style="width:100%; margin-top:20px;" id="aiSaveSettings">Save Changes</button>
                </div>
            </div>
        `;

        const container = document.createElement('div');
        container.innerHTML = html;
        document.body.appendChild(container); // Append to body (top level)

        // Bind Events
        document.getElementById('aiChefTrigger').onclick = () => this.toggle();
        document.getElementById('aiCloseBtn').onclick = () => this.toggle();
        document.getElementById('aiClearBtn').onclick = () => this.clearChat();
        document.getElementById('aiSendBtn').onclick = () => this.handleSend();

        const input = document.getElementById('aiInput');
        input.onkeydown = (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                this.handleSend();
            }
        };
        input.oninput = () => {
            input.style.height = 'auto';
            input.style.height = (input.scrollHeight) + 'px';
        };

        // Settings Events
        document.getElementById('aiSettingsToggle').onclick = () => {
            document.getElementById('aiSettingsOverlay').classList.add('visible');
            this.loadSettingsUI();
        };
        document.getElementById('aiSettingsClose').onclick = () => {
            document.getElementById('aiSettingsOverlay').classList.remove('visible');
        };
        document.getElementById('aiProviderSelect').onchange = (e) => this.updateSettingsVisibility(e.target.value);
        document.getElementById('aiSaveSettings').onclick = () => this.saveSettings();

        this.updateSettingsVisibility(this.provider);
    }

    toggle() {
        this.isOpen = !this.isOpen;
        const panel = document.getElementById('aiChefPanel');
        if (this.isOpen) {
            panel.classList.add('open');
            document.getElementById('aiInput').focus();
            document.getElementById('aiBadge').classList.remove('show'); // Hide badge on open
        } else {
            panel.classList.remove('open');
        }
    }

    chip(text) {
        document.getElementById('aiInput').value = text;
        this.handleSend();
    }

    async handleSend() {
        const input = document.getElementById('aiInput');
        const text = input.value.trim();
        if (!text) return;

        // User Message
        this.addMessage(text, 'user');
        input.value = '';
        input.style.height = 'auto';

        // Show Typing
        const typingId = this.showTyping();

        // Process
        try {
            const response = await this.fetchAIResponse(text);
            this.removeMessage(typingId);
            this.addMessage(response, 'bot');
        } catch (e) {
            this.removeMessage(typingId);
            this.addMessage(`Error: ${e.message}. Check your settings.`, 'bot');
        }
    }

    addMessage(text, type) {
        const history = document.getElementById('aiChatHistory');
        const div = document.createElement('div');
        div.className = `ai-msg ai-msg-${type}`;

        // Guard against null/undefined or non-string input
        const safeText = String(text || '');

        // Simple Markdown parsing
        let html = safeText
            .replace(/\n/g, '<br>')
            .replace(/\*\*(.*?)\*\*/g, '<b>$1</b>')
            .replace(/\*(.*?)\*/g, '<i>$1</i>')
            .replace(/`(.*?)`/g, '<code style="background:rgba(255,255,255,0.1); padding:2px 4px; border-radius:4px;">$1</code>');

        div.innerHTML = html;
        history.appendChild(div);

        // Use a tiny timeout to scroll after render
        setTimeout(() => {
            history.scrollTop = history.scrollHeight;
        }, 10);

        return div;
    }

    showTyping() {
        const history = document.getElementById('aiChatHistory');
        const id = 'typing-' + Date.now();
        const div = document.createElement('div');
        div.id = id;
        div.className = 'typing-indicator';
        div.innerHTML = '<div class="typing-dot"></div><div class="typing-dot"></div><div class="typing-dot"></div>';
        history.appendChild(div);
        history.scrollTop = history.scrollHeight;
        return id;
    }

    removeMessage(id) {
        const el = document.getElementById(id);
        if (el) el.remove();
    }

    clearChat() {
        this.history = [];
        const container = document.getElementById('aiChatHistory');
        container.innerHTML = `
            <div class="ai-msg ai-msg-bot">
                Hello! I'm your AI Chef. 🍳<br><br>
                I can help you plan meals, suggest recipes based on what's in your pantry, or answer cooking questions.<br><br>
                <small>Currently in <b>${this.provider.toUpperCase()}</b> mode.</small>
            </div>
        `;
    }

    // ================= LOGIC & BRAINS =================

    async fetchAIResponse(prompt) {
        // Collect context from the app
        const context = await this.getContext();
        const fullPrompt = `Context: ${context}\n\nUser Question: ${prompt}`;

        if (this.provider === 'demo') {
            return await this.mockResponse(prompt);
        } else if (this.provider === 'openai') {
            return await this.callOpenAI(fullPrompt);
        } else if (this.provider === 'ollama') {
            return await this.callOllama(fullPrompt);
        }
        return "Unknown provider selected.";
    }

    async getContext() {
        let pantryContext = "Pantry information unavailable.";

        // Try to fetch real pantry data via IPC
        if (window.Foodie && window.Foodie.api) {
            try {
                const res = await window.Foodie.api('listPantry', {});
                if (res.ok && res.items && res.items.length > 0) {
                    const items = res.items.map(i => i.IngredientName).join(', ');
                    pantryContext = `User has these items in availability: ${items}.`;
                } else {
                    pantryContext = "User's pantry is empty.";
                }
            } catch (e) {
                console.error("AI Chef: Failed to fetch pantry", e);
            }
        }

        try {
            const page = document.querySelector('.view-section.active-view')?.id || 'home';
            return `User is on page: ${page}. ${pantryContext}`;
        } catch (e) {
            return pantryContext;
        }
    }

    // --- PROVIDERS ---


    async mockResponse(prompt) {
        return new Promise(resolve => {
            setTimeout(() => {
                const lower = prompt.toLowerCase();
                if (lower.includes('pantry')) {

                    // Extract items from context if available for the demo response
                    /* Context string format: "User is on page: ... User has these items in availability: apples, milk." */
                    // We can't easily parse it here without passing it, but let's just make it generic but acknowledging functionality.
                    resolve("I checked your **Real Pantry**! \n\nIn **Demo Mode**, I can't generate a specific recipe for your ingredients dynamically, but if you switch to Ollama or OpenAI, I will see exactly what you have and create a custom recipe for you! 🍳");
                } else if (lower.includes('healthy')) {
                    resolve("How about **Grilled Salmon with Asparagus**? It's high in protein and omega-3s.");
                } else if (lower.includes('dice') || lower.includes('onion')) {
                    resolve("To dice an onion: \n1. Cut in half through the root.\n2. Peel back the skin.\n3. Make vertical cuts, leaving the root intact.\n4. Slice horizontally.\n5. Chop downwards.");
                } else {
                    resolve("That sounds interesting! Since I'm in **Demo Mode**, I have limited responses, but if you connect me to OpenAI or Ollama, I can tell you anything!");
                }
            }, 1000);
        });
    }

    async callOpenAI(prompt) {
        const key = this.envApiKey || this.apiKey;
        if (!key) throw new Error("API Key missing (Set in Settings or .env)");

        const res = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${key}`
            },
            body: JSON.stringify({
                model: this.model || 'gpt-3.5-turbo',
                messages: [
                    { role: 'system', content: 'You are a helpful culinary expert assistant for the Foodie Meal Planner app.' },
                    { role: 'user', content: prompt }
                ]
            })
        });

        const data = await res.json();
        if (data.error) throw new Error(data.error.message);
        return data.choices[0].message.content;
    }

    async callOllama(prompt) {
        try {
            const res = await fetch('http://localhost:11434/api/generate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    model: this.model || 'llama3',
                    prompt: `You are a helpful culinary expert.\n${prompt}`,
                    stream: false
                })
            });
            const data = await res.json();
            if (data.error) throw new Error(data.error);
            if (!data.response) throw new Error("Ollama returned an empty response. Is the model correctly loaded?");

            return data.response;
        } catch (e) {
            throw new Error("Could not connect to Ollama (localhost:11434). Is it running?");
        }
    }

    // --- SETTINGS MANAGEMENT ---

    loadSettingsUI() {
        document.getElementById('aiProviderSelect').value = this.provider;

        const keyInput = document.getElementById('aiApiKey');
        if (this.envApiKey) {
            keyInput.value = 'Managed by Environment Variable';
            keyInput.disabled = true;
            keyInput.title = 'This key is set in the .env file';
        } else {
            keyInput.value = this.apiKey;
            keyInput.disabled = false;
            keyInput.title = '';
        }

        document.getElementById('aiModel').value = this.model;
        this.updateSettingsVisibility(this.provider);
    }

    updateSettingsVisibility(provider) {
        const keyGroup = document.getElementById('aiKeyGroup');
        const modelGroup = document.getElementById('aiModelGroup');

        if (provider === 'demo') {
            keyGroup.style.display = 'none';
            modelGroup.style.display = 'none';
        } else if (provider === 'openai') {
            keyGroup.style.display = 'block';
            modelGroup.style.display = 'block';
            document.getElementById('aiModel').placeholder = 'gpt-3.5-turbo';
        } else if (provider === 'ollama') {
            keyGroup.style.display = 'none'; // No key needed usually
            modelGroup.style.display = 'block';
            document.getElementById('aiModel').placeholder = 'llama3';
        }
    }

    saveSettings() {
        this.provider = document.getElementById('aiProviderSelect').value;

        const keyInput = document.getElementById('aiApiKey');
        if (!keyInput.disabled) {
            this.apiKey = keyInput.value;
            localStorage.setItem('aiChefKey', this.apiKey);
        }

        this.model = document.getElementById('aiModel').value;
        localStorage.setItem('aiChefModel', this.model);

        document.getElementById('aiSettingsOverlay').classList.remove('visible');

        // Notify user in chat
        this.addMessage(`Saved! Switched to <b>${this.provider.toUpperCase()}</b> provider.`, 'system');
    }
}

// Initialize on load
window.addEventListener('DOMContentLoaded', () => {
    window.chef = new AIChef();
    console.log("👨‍🍳 AI Chef Loaded");
});
