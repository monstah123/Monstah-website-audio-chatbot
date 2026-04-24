(function() {
  const VERCEL_URL = "https://monstah-website-audio-chatbot.vercel.app";
  
  const currentScript = document.currentScript;
  const position = currentScript?.getAttribute('data-position') === 'left' ? 'left' : 'right';
  
  // Create a high-level wrapper
  const wrapper = document.createElement('div');
  wrapper.style.cssText = `
    position: fixed !important;
    bottom: 0 !important;
    ${position}: 0 !important;
    width: 450px !important;
    height: 700px !important;
    z-index: 2147483647 !important;
    pointer-events: none !important;
    display: block !important;
  `;
  document.body.appendChild(wrapper);

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
    if (event.data === 'close-chatbot') {
      wrapper.style.display = 'none';
    }
  });
})();
