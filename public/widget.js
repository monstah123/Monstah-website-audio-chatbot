(function() {
  const SCRIPT_URL = window.location.origin; // This will be your Vercel URL
  
  // Create the container for the chatbot
  const container = document.createElement('div');
  container.id = 'monstah-ai-widget-root';
  document.body.appendChild(container);

  // Inject the iframe
  const iframe = document.createElement('iframe');
  iframe.src = SCRIPT_URL; // Loads your Next.js home page
  iframe.style.position = 'fixed';
  iframe.style.bottom = '20px';
  iframe.style.right = '20px';
  iframe.style.width = '450px';
  iframe.style.height = '700px';
  iframe.style.border = 'none';
  iframe.style.zIndex = '999999';
  iframe.style.colorScheme = 'none';
  iframe.allow = 'microphone'; // Required for voice chat

  container.appendChild(iframe);

  // Listen for messages from the iframe to resize if needed
  window.addEventListener('message', (event) => {
    if (event.data === 'close-chatbot') {
      iframe.style.display = 'none';
    }
  });
})();
