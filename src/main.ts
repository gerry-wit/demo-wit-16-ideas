import './style.css'

// Ensure AFRAME is available globally
declare const AFRAME: any;

AFRAME.registerComponent('reddie-controller', {
  init: function () {
    const el = this.el;
    const chatUi = document.getElementById('chat-ui');
    const chatInput = document.getElementById('chat-input') as HTMLInputElement;
    const chatSend = document.getElementById('chat-send');
    const chatMessages = document.getElementById('chat-messages');
    
    // Hide model initially
    const reddieModel = el.querySelector('[gltf-model]');
    if (reddieModel) {
      reddieModel.setAttribute('visible', 'false');
    }

    // Demo Mode Toggle
    const skipBtn = document.getElementById('skip-tracking-btn');
    skipBtn?.addEventListener('click', () => {
      const scene = document.querySelector('a-scene');
      
      if (scene && reddieModel) {
        // Show the model
        reddieModel.setAttribute('visible', 'true');
        
        // Reposition in front of camera
        el.setAttribute('position', '0 0 -4');
        
        // Show Chat UI and hide button
        chatUi?.classList.remove('hidden');
        skipBtn.style.display = 'none';
        
        console.log("Demo Mode Activated. Reddie spawned!");
      }
    });

    // Handle Chat Submission
    const handleSend = () => {
      if (!chatInput || !chatMessages || chatInput.value.trim() === '') return;
      const text = chatInput.value.trim();
      
      // 1. Add User Message
      const userMsg = document.createElement('div');
      userMsg.className = 'message user-msg';
      userMsg.innerHTML = `<div class="msg-bubble">${text}</div>`;
      chatMessages.appendChild(userMsg);
      chatMessages.scrollTop = chatMessages.scrollHeight;
      
      chatInput.value = '';

      // 2. Send text to Backend endpoint (Gemini + RAG)
      const reddieMsg = document.createElement('div');
      reddieMsg.className = 'message reddie-msg';
      reddieMsg.innerHTML = `<div class="msg-bubble">Thinking...</div>`;
      chatMessages.appendChild(reddieMsg);
      chatMessages.scrollTop = chatMessages.scrollHeight;

      fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text })
      })
      .then(res => res.json())
      .then(data => {
        reddieMsg.innerHTML = `<div class="msg-bubble">${data.reply || data.error}</div>`;
        chatMessages.scrollTop = chatMessages.scrollHeight;
      })
      .catch(err => {
        reddieMsg.innerHTML = `<div class="msg-bubble">Oops, I couldn't connect to my brain. Is the backend running?</div>`;
        console.error(err);
      });
    };

    chatSend?.addEventListener('click', handleSend);
    chatInput?.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') handleSend();
    });
  }
});

