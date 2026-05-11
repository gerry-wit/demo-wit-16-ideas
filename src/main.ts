import './style.css'

// Ensure AFRAME is available globally (it's injected via 8th Wall script in index.html)
declare const AFRAME: any;

AFRAME.registerComponent('reddie-controller', {
  init: function () {
    const el = this.el;
    const chatUi = document.getElementById('chat-ui');
    const chatInput = document.getElementById('chat-input') as HTMLInputElement;
    const chatSend = document.getElementById('chat-send');
    const chatMessages = document.getElementById('chat-messages');
    
    // Demo Mode Toggle
    const skipBtn = document.getElementById('skip-tracking-btn');
    skipBtn?.addEventListener('click', () => {
      const scene = document.querySelector('a-scene');
      const reddieModel = el.querySelector('[gltf-model]');
      
      if (scene && reddieModel) {
        // Remove from image target
        el.removeChild(reddieModel);
        
        // Add to global scene in front of the camera
        const freeReddie = document.createElement('a-entity');
        freeReddie.setAttribute('gltf-model', '#reddieModel');
        freeReddie.setAttribute('scale', '0.5 0.5 0.5');
        freeReddie.setAttribute('position', '0 0 -4');
        freeReddie.setAttribute('animation-mixer', '');
        
        scene.appendChild(freeReddie);
        
        // Show Chat UI and hide button
        chatUi?.classList.remove('hidden');
        skipBtn.style.display = 'none';
        
        console.log("Demo Mode Activated. Reddie spawned without tracking.");
      }
    });

    // Show UI when image is found
    el.sceneEl.addEventListener('xrimagefound', (e: any) => {
      if (e.detail.name === 'wit-logo') {
        console.log("WIT Logo Found! Spawning Reddie.");
        chatUi?.classList.remove('hidden');
        if (skipBtn) skipBtn.style.display = 'none';
        // TODO: Start idle or talking animations here if needed
      }
    });

    // Hide UI when image is lost
    el.sceneEl.addEventListener('xrimagelost', (e: any) => {
      if (e.detail.name === 'wit-logo') {
        console.log("WIT Logo Lost.");
        chatUi?.classList.add('hidden');
        if (skipBtn) skipBtn.style.display = 'block';
        // TODO: Pause animations
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

