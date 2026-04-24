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
    width: 400px !important;
    height: 600px !important;
    z-index: 2147483647 !important;
    background: transparent !important;
    pointer-events: none !important;
    display: block !important;
    margin: 0 !important;
    padding: 0 !important;
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
