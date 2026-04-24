(function() {
  const VERCEL_URL = "https://monstah-website-audio-chatbot.vercel.app";
  
  const currentScript = document.currentScript;
  const position = 'right'; // FORCE TO RIGHT SIDE
  
  const wrapper = document.createElement('div');
  wrapper.id = 'monstah-ai-final-anchor';
  wrapper.style.cssText = `
    position: fixed !important;
    bottom: 0 !important;
    ${position}: 0 !important;
    width: 280px !important;
    height: 140px !important;
    z-index: 2147483647 !important;
    background: transparent !important;
    pointer-events: auto !important;
    cursor: pointer !important;
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
        wrapper.style.width = isMobile ? '100vw' : '440px';
        wrapper.style.height = isMobile ? '80vh' : '690px';
      } else {
        wrapper.style.width = '280px'; 
        wrapper.style.height = '140px';
      }
    } else if (event.data.type === 'redirect') {
      window.location.href = event.data.url;
    }
  });
})();
