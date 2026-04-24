(function() {
  const VERCEL_URL = "https://monstah-website-audio-chatbot.vercel.app";
  
  const currentScript = document.currentScript;
  const position = currentScript?.getAttribute('data-position') === 'left' ? 'left' : 'right';
  
  const wrapper = document.createElement('div');
  wrapper.id = 'monstah-ai-widget-container';
  wrapper.style.cssText = `
    position: fixed !important;
    bottom: 0 !important;
    ${position}: 0 !important;
    width: 450px !important;
    height: 750px !important; /* Keep it large but invisible */
    z-index: 2147483647 !important;
    pointer-events: none !important;
    display: block !important;
    background: transparent !important;
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

  // We no longer need to resize the wrapper, so no 'toggle-chat' listener needed here
  // The internal page will handle the sliding animation
})();
