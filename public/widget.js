(function() {
  const VERCEL_URL = "https://monstah-website-audio-chatbot.vercel.app";
  
  const currentScript = document.currentScript;
  const position = currentScript?.getAttribute('data-position') === 'left' ? 'left' : 'right';
  
  // Pin directly to the HTML root to bypass Body transforms
  const wrapper = document.createElement('div');
  wrapper.id = 'monstah-ai-widget-container';
  wrapper.style.cssText = `
    position: fixed !important;
    bottom: 20px !important;
    ${position}: 20px !important;
    top: auto !important;
    width: 450px !important;
    height: 700px !important;
    z-index: 2147483647 !important;
    pointer-events: none !important;
    display: block !important;
    margin: 0 !important;
    padding: 0 !important;
  `;
  
  // Inject at the very highest level possible
  (document.documentElement || document.body).appendChild(wrapper);

  const iframe = document.createElement('iframe');
  iframe.src = `${VERCEL_URL}/widget?pos=${position}&v=${Date.now()}`; 
  iframe.style.cssText = `
    width: 100% !important;
    height: 100% !important;
    border: none !important;
    background: transparent !important;
    pointer-events: auto !important;
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
