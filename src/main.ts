import './style.css'

declare const AFRAME: any;

AFRAME.registerComponent('reddie-controller', {
  init: function () {
    const el = this.el;
    const chatUi = document.getElementById('chat-ui');
    const chatInput = document.getElementById('chat-input') as HTMLInputElement;
    const chatSend = document.getElementById('chat-send');
    const chatMessages = document.getElementById('chat-messages');
    const landingScreen = document.getElementById('landing-screen');
    const reddieModel = el.querySelector('[gltf-model]') as any;
    const statusBadge = document.getElementById('reddie-status');

    // Hide model initially
    if (reddieModel) reddieModel.setAttribute('visible', 'false');

    // ─── EXPRESSION & MOVEMENT SYSTEM ────────────────────────────────────────
    let expressionTimeout: number | null = null;

    const EXPRESSIONS: Record<string, { timeScale: number; bobSpeed: number; bobHeight: number; tilt: number; label: string }> = {
      idle:     { timeScale: 0.5,  bobSpeed: 2000, bobHeight: 0.08, tilt: 0,    label: '' },
      thinking: { timeScale: 0.15, bobSpeed: 4000, bobHeight: 0.02, tilt: 8,    label: '🤔 Thinking...' },
      talking:  { timeScale: 1.8,  bobSpeed: 700,  bobHeight: 0.18, tilt: 0,    label: '💬 Talking' },
      happy:    { timeScale: 1.2,  bobSpeed: 900,  bobHeight: 0.15, tilt: -5,   label: '😊 Happy' },
      excited:  { timeScale: 2.2,  bobSpeed: 500,  bobHeight: 0.22, tilt: 0,    label: '🎉 Excited!' },
      sad:      { timeScale: 0.3,  bobSpeed: 3500, bobHeight: 0.04, tilt: 10,   label: '😔 Sad' },
      curious:  { timeScale: 0.9,  bobSpeed: 1500, bobHeight: 0.12, tilt: -12,  label: '🤨 Curious' },
    };

    let bobAnimFrame: number | null = null;
    let bobStart: number | null = null;
    let currentBobSpeed = 2000;
    let currentBobHeight = 0.08;
    const BASE_Y = 0;

    // Smooth floating bob animation loop
    const bobLoop = (timestamp: number) => {
      if (!bobStart) bobStart = timestamp;
      const elapsed = timestamp - bobStart;
      const y = BASE_Y + Math.sin((elapsed / currentBobSpeed) * Math.PI * 2) * currentBobHeight;
      if (reddieModel) reddieModel.setAttribute('position', `0 ${y.toFixed(3)} 0`);
      bobAnimFrame = requestAnimationFrame(bobLoop);
    };

    const startBob = () => {
      if (bobAnimFrame) cancelAnimationFrame(bobAnimFrame);
      bobStart = null;
      bobAnimFrame = requestAnimationFrame(bobLoop);
    };

    const setExpression = (state: string) => {
      const expr = EXPRESSIONS[state] || EXPRESSIONS['idle'];
      if (!reddieModel) return;

      // Update animation speed
      reddieModel.setAttribute('animation-mixer', `timeScale: ${expr.timeScale}`);

      // Update bob
      currentBobSpeed = expr.bobSpeed;
      currentBobHeight = expr.bobHeight;
      bobStart = null; // reset bob phase

      // Head tilt via A-Frame animation
      reddieModel.setAttribute('animation__tilt', `
        property: rotation;
        to: 0 0 ${expr.tilt};
        dur: 400;
        easing: easeOutQuad;
      `);

      // Status badge
      if (statusBadge) {
        statusBadge.textContent = expr.label;
        statusBadge.style.opacity = expr.label ? '1' : '0';
      }
    };

    // Apply emotion from API response
    const applyEmotion = (emotion: string) => {
      // First show "talking" burst
      setExpression('talking');
      if (expressionTimeout) clearTimeout(expressionTimeout);

      // After 1.5s of talking, settle into the emotion
      expressionTimeout = setTimeout(() => {
        setExpression(emotion);

        // After 4s, go back to idle
        expressionTimeout = setTimeout(() => {
          setExpression('idle');
        }, 4000) as unknown as number;
      }, 1500) as unknown as number;
    };

    // ─── LANDING SCREEN ───────────────────────────────────────────────────────
    const enterDemoMode = () => {
      if (landingScreen) {
        landingScreen.style.opacity = '0';
        setTimeout(() => landingScreen.remove(), 500);
      }
      if (reddieModel) {
        reddieModel.setAttribute('visible', 'true');
        reddieModel.setAttribute('scale', '1.5 1.5 1.5');
      }
      el.setAttribute('position', '0 0 -3');
      chatUi?.classList.remove('hidden');
      setExpression('happy');
      startBob();
    };

    document.getElementById('btn-demo-mode')?.addEventListener('click', enterDemoMode);

    document.getElementById('btn-scan-mode')?.addEventListener('click', () => {
      if (landingScreen) {
        landingScreen.style.opacity = '0';
        setTimeout(() => landingScreen.remove(), 500);
      }
      const scene = document.querySelector('a-scene') as any;
      if (reddieModel) {
        reddieModel.setAttribute('visible', 'true');
        reddieModel.setAttribute('scale', '1.5 1.5 1.5');
      }
      chatUi?.classList.remove('hidden');
      setExpression('happy');
      startBob();
      if (scene?.hasLoaded) {
        scene.enterVR();
      } else {
        scene?.addEventListener('loaded', () => scene.enterVR());
      }
    });

    // ─── CHAT ─────────────────────────────────────────────────────────────────
    const addMessage = (text: string, role: 'user' | 'reddie') => {
      const msg = document.createElement('div');
      msg.className = `message ${role}-msg`;
      msg.innerHTML = `<div class="msg-bubble">${text}</div>`;
      chatMessages?.appendChild(msg);
      chatMessages && (chatMessages.scrollTop = chatMessages.scrollHeight);
      return msg;
    };

    const handleSend = () => {
      if (!chatInput || !chatMessages || !chatInput.value.trim()) return;
      const text = chatInput.value.trim();
      chatInput.value = '';

      addMessage(text, 'user');
      setExpression('thinking');

      const reddieMsg = addMessage('<span class="typing-dots"><span>.</span><span>.</span><span>.</span></span>', 'reddie');

      fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text }),
      })
        .then(res => res.json())
        .then(data => {
          reddieMsg.querySelector('.msg-bubble')!.textContent = data.reply || data.error;
          chatMessages.scrollTop = chatMessages.scrollHeight;
          applyEmotion(data.emotion || 'happy');
        })
        .catch(() => {
          reddieMsg.querySelector('.msg-bubble')!.textContent = "Oops! I couldn't reach my brain. Is the backend running?";
          setExpression('sad');
          setTimeout(() => setExpression('idle'), 3000);
        });
    };

    chatSend?.addEventListener('click', handleSend);
    chatInput?.addEventListener('keypress', (e) => { if (e.key === 'Enter') handleSend(); });
  },
});
