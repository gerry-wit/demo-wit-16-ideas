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
    const landingScreen = document.getElementById('landing-screen');
    
    // Hide model initially
    const reddieModel = el.querySelector('[gltf-model]');
    if (reddieModel) {
      reddieModel.setAttribute('visible', 'false');
    }

    // Function to trigger an expression (animation speed / scale tweak)
    const setExpression = (state: 'idle' | 'talking' | 'thinking') => {
      if (!reddieModel) return;
      
      if (state === 'idle') {
        reddieModel.setAttribute('animation-mixer', 'timeScale: 0.5'); // Slow down for idle
        reddieModel.setAttribute('scale', '0.1 0.1 0.1'); // Normal size
      } else if (state === 'talking') {
        reddieModel.setAttribute('animation-mixer', 'timeScale: 1.5'); // Speed up for talking/energetic
        reddieModel.setAttribute('scale', '0.105 0.105 0.105'); // Slightly larger to emphasize
      } else if (state === 'thinking') {
        reddieModel.setAttribute('animation-mixer', 'timeScale: 0.1'); // Almost frozen
        reddieModel.setAttribute('scale', '0.095 0.095 0.095'); // Slightly smaller, contracted
      }
    };

    // Initialize with idle state
    setExpression('idle');

    // Mode Selection Logic
    document.getElementById('btn-demo-mode')?.addEventListener('click', () => {
      if (landingScreen) landingScreen.style.opacity = '0';
      setTimeout(() => landingScreen?.remove(), 500);

      const scene = document.querySelector('a-scene');
      if (scene && reddieModel) {
        reddieModel.setAttribute('visible', 'true');
        el.setAttribute('position', '0 0 -3'); // Closer for demo
        chatUi?.classList.remove('hidden');
        console.log("Demo Mode Activated. Reddie spawned!");
      }
    });

    document.getElementById('btn-scan-mode')?.addEventListener('click', () => {
      if (landingScreen) landingScreen.style.opacity = '0';
      setTimeout(() => landingScreen?.remove(), 500);

      const scene = document.querySelector('a-scene') as any;
      if (scene && reddieModel) {
        reddieModel.setAttribute('visible', 'true');
        // If device supports WebXR AR, prompt to enter it
        if (scene.hasLoaded) {
          scene.enterVR(); // Enters WebXR mode
        } else {
          scene.addEventListener('loaded', () => scene.enterVR());
        }
        chatUi?.classList.remove('hidden');
      }
    });

    // Handle Chat Submission
    const handleSend = () => {
      if (!chatInput || !chatMessages || chatInput.value.trim() === '') return;
      const text = chatInput.value.trim();
      
      // Add User Message
      const userMsg = document.createElement('div');
      userMsg.className = 'message user-msg';
      userMsg.innerHTML = `<div class="msg-bubble">${text}</div>`;
      chatMessages.appendChild(userMsg);
      chatMessages.scrollTop = chatMessages.scrollHeight;
      chatInput.value = '';

      // Set expression to thinking
      setExpression('thinking');

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
        
        // Set expression to talking
        setExpression('talking');
        
        // Return to idle after 3 seconds
        setTimeout(() => setExpression('idle'), 3000);
      })
      .catch(err => {
        reddieMsg.innerHTML = `<div class="msg-bubble">Oops, I couldn't connect to my brain. Is the backend running?</div>`;
        setExpression('idle');
        console.error(err);
      });
    };

    chatSend?.addEventListener('click', handleSend);
    chatInput?.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') handleSend();
    });
  }
});

