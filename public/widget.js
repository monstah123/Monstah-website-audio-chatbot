(function() {
  const VERCEL_URL = "https://monstah-website-audio-chatbot.vercel.app";
  
  const currentScript = document.currentScript;
  const position = 'right'; // FORCE TO RIGHT SIDE
  
  let uid = '';
  if (currentScript && currentScript.src) {
    try {
      const scriptUrl = new URL(currentScript.src);
      uid = scriptUrl.searchParams.get('uid') || '';
    } catch (e) {}
  }
  
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

  // Pass the current page origin to the iframe so it can build absolute URLs correctly
  const pageOrigin = window.location.origin;

  const iframe = document.createElement('iframe');
  iframe.src = `${VERCEL_URL}/widget?pos=${position}&uid=${uid}&origin=${encodeURIComponent(pageOrigin)}&v=${Date.now()}`;
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
      let url = event.data.url;
      // Safety net: resolve relative URLs against the current page origin
      // This handles cases where the AI returns a path like /product/knee-wraps/
      if (url && !url.startsWith('http')) {
        url = window.location.origin + (url.startsWith('/') ? '' : '/') + url;
      }
      if (url) {
        window.location.href = url;
      }
    }
  });
})();
