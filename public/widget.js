(function() {
  const VERCEL_URL = "https://monstah-website-audio-chatbot.vercel.app";
  
  const currentScript = document.currentScript;
  const position = currentScript?.getAttribute('data-position') === 'left' ? 'left' : 'right';
  
  const container = document.createElement('div');
  container.id = 'monstah-ai-widget-root';
  document.body.appendChild(container);

  const iframe = document.createElement('iframe');
  // Pass the position as a query parameter so the internal page knows where to align
  iframe.src = `${VERCEL_URL}/widget?pos=${position}`; 
  iframe.style.position = 'fixed';
  iframe.style.bottom = '20px'; // Give it a little breathing room from the edge
  
  if (position === 'left') {
    iframe.style.left = '20px';
  } else {
    iframe.style.right = '20px';
  }

  iframe.style.width = '450px';
  iframe.style.height = '700px';
  iframe.style.border = 'none';
  iframe.style.zIndex = '999999';
  iframe.style.background = 'transparent';
  iframe.allow = 'microphone';

  container.appendChild(iframe);

  window.addEventListener('message', (event) => {
    if (event.origin !== VERCEL_URL) return;
    if (event.data === 'close-chatbot') {
      iframe.style.display = 'none';
    }
  });
})();
