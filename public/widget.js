(function() {
  const VERCEL_URL = "https://monstah-website-audio-chatbot.vercel.app";
  
  const currentScript = document.currentScript;
  const position = currentScript?.getAttribute('data-position') === 'left' ? 'left' : 'right';
  
  const container = document.createElement('div');
  container.id = 'monstah-ai-widget-root';
  document.body.appendChild(container);

  const iframe = document.createElement('iframe');
  // Load the CLEAN widget page
  iframe.src = `${VERCEL_URL}/widget`; 
  iframe.style.position = 'fixed';
  iframe.style.bottom = '0px';
  
  if (position === 'left') {
    iframe.style.left = '0px';
  } else {
    iframe.style.right = '0px';
  }

  // Adjust size to fit only the bubble/chat
  iframe.style.width = '450px';
  iframe.style.height = '700px';
  iframe.style.border = 'none';
  iframe.style.zIndex = '999999';
  iframe.style.background = 'transparent'; // Make it transparent
  iframe.allow = 'microphone';

  container.appendChild(iframe);

  window.addEventListener('message', (event) => {
    if (event.origin !== VERCEL_URL) return;
    if (event.data === 'close-chatbot') {
      iframe.style.display = 'none';
    }
  });
})();
