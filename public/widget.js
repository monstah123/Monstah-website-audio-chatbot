(function() {
  const VERCEL_URL = "https://monstah-website-audio-chatbot.vercel.app";
  
  const currentScript = document.currentScript;
  const position = currentScript?.getAttribute('data-position') === 'left' ? 'left' : 'right';
  
  // The Ghost Overlay: Covers everything but is invisible to clicks
  const wrapper = document.createElement('div');
  wrapper.id = 'monstah-ai-ghost-overlay';
  wrapper.style.cssText = `
    position: fixed !important;
    top: 0 !important;
    left: 0 !important;
    width: 100vw !important;
    height: 100vh !important;
    z-index: 2147483647 !important;
    pointer-events: none !important;
    display: block !important;
    background: transparent !important;
    margin: 0 !important;
    padding: 0 !important;
    border: none !important;
  `;
  
  (document.documentElement || document.body).appendChild(wrapper);

  const iframe = document.createElement('iframe');
  iframe.src = `${VERCEL_URL}/widget?pos=${position}&v=${Date.now()}`; 
  iframe.style.cssText = `
    width: 100% !important;
    height: 100% !important;
    border: none !important;
    background: transparent !important;
    pointer-events: none !important; /* Internal content will re-enable this */
    display: block !important;
  `;
  iframe.allow = 'microphone';

  wrapper.appendChild(iframe);

  window.addEventListener('message', (event) => {
    if (event.origin !== VERCEL_URL) return;
    if (event.data === 'close-chatbot') {
      wrapper.style.display = 'none';
    }
  });
})();
