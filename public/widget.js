(function() {
  // Use the actual Vercel URL
  const VERCEL_URL = "https://monstah-website-audio-chatbot.vercel.app";
  
  // Get the script element to read data attributes
  const currentScript = document.currentScript;
  const position = currentScript?.getAttribute('data-position') === 'left' ? 'left' : 'right';
  
  // Create the container for the chatbot
  const container = document.createElement('div');
  container.id = 'monstah-ai-widget-root';
  document.body.appendChild(container);

  // Inject the iframe
  const iframe = document.createElement('iframe');
  iframe.src = VERCEL_URL; 
  iframe.style.position = 'fixed';
  iframe.style.bottom = '20px';
  
  // Dynamic positioning
  if (position === 'left') {
    iframe.style.left = '20px';
  } else {
    iframe.style.right = '20px';
  }

  iframe.style.width = '450px';
  iframe.style.height = '700px';
  iframe.style.border = 'none';
  iframe.style.zIndex = '999999';
  iframe.style.colorScheme = 'none';
  iframe.allow = 'microphone'; // Required for voice chat

  container.appendChild(iframe);

  // Handle messages (e.g. closing or resizing)
  window.addEventListener('message', (event) => {
    if (event.origin !== VERCEL_URL) return;
    if (event.data === 'close-chatbot') {
      iframe.style.display = 'none';
    }
  });
})();
