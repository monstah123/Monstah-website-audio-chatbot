(function() {
  const VERCEL_URL = "https://monstah-website-audio-chatbot.vercel.app";
  
  const currentScript = document.currentScript;
  const position = currentScript?.getAttribute('data-position') === 'left' ? 'left' : 'right';
  
  const wrapper = document.createElement('div');
  wrapper.id = 'monstah-ai-final-anchor';
  wrapper.style.cssText = `
    position: fixed !important;
    bottom: 20px !important;
    ${position}: 20px !important;
    width: 80px !important;
    height: 80px !important;
    z-index: 2147483647 !important;
    background: transparent !important;
    pointer-events: auto !important; /* ENABLE TOUCH */
    transition: all 0.3s ease-in-out;
    border-radius: 50%;
    overflow: hidden;
  `;
  
  (document.documentElement || document.body).appendChild(wrapper);

  const iframe = document.createElement('iframe');
  iframe.src = `${VERCEL_URL}/widget?pos=${position}&v=${Date.now()}`; 
  iframe.style.cssText = `
    width: 100% !important;
    height: 100% !important;
    border: none !important;
    background: transparent !important;
    pointer-events: auto !important;
  `;
  iframe.allow = 'microphone';
  wrapper.appendChild(iframe);

  window.addEventListener('message', (event) => {
    if (event.origin !== VERCEL_URL) return;
    
    if (event.data.type === 'toggle-chat') {
      if (event.data.isOpen) {
        const isMobile = window.innerWidth < 600;
        wrapper.style.width = isMobile ? 'calc(100vw - 40px)' : '400px';
        wrapper.style.height = isMobile ? '80vh' : '650px';
        wrapper.style.borderRadius = '28px';
      } else {
        wrapper.style.width = '80px';
        wrapper.style.height = '80px';
        wrapper.style.borderRadius = '50%';
      }
    }
  });
})();
