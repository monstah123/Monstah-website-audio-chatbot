(function() {
  const VERCEL_URL = "https://monstah-website-audio-chatbot.vercel.app";
  
  const currentScript = document.currentScript;
  const position = currentScript?.getAttribute('data-position') === 'left' ? 'left' : 'right';
  
  const container = document.createElement('div');
  container.id = 'monstah-ai-widget-root';
  document.body.appendChild(container);

  const iframe = document.createElement('iframe');
  iframe.src = `${VERCEL_URL}/widget?pos=${position}&v=${Date.now()}`; 
  
  // Use !important on everything to override WordPress theme CSS
  iframe.style.setProperty('position', 'fixed', 'important');
  iframe.style.setProperty('bottom', '20px', 'important');
  iframe.style.setProperty('top', 'auto', 'important');
  
  if (position === 'left') {
    iframe.style.setProperty('left', '20px', 'important');
    iframe.style.setProperty('right', 'auto', 'important');
  } else {
    iframe.style.setProperty('right', '20px', 'important');
    iframe.style.setProperty('left', 'auto', 'important');
  }

  iframe.style.setProperty('width', '450px', 'important');
  iframe.style.setProperty('height', '700px', 'important');
  iframe.style.setProperty('border', 'none', 'important');
  iframe.style.setProperty('z-index', '999999999', 'important');
  iframe.style.setProperty('background', 'transparent', 'important');
  iframe.style.setProperty('display', 'block', 'important');
  iframe.style.setProperty('visibility', 'visible', 'important');
  iframe.allow = 'microphone';

  container.appendChild(iframe);

  window.addEventListener('message', (event) => {
    if (event.origin !== VERCEL_URL) return;
    if (event.data === 'close-chatbot') {
      iframe.style.display = 'none';
    }
  });
})();
