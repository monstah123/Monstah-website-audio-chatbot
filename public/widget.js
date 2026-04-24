(function() {
  const VERCEL_URL = "https://monstah-website-audio-chatbot.vercel.app";
  
  const currentScript = document.currentScript;
  const position = currentScript?.getAttribute('data-position') === 'left' ? 'left' : 'right';
  
  const container = document.createElement('div');
  container.id = 'monstah-ai-widget-root';
  document.body.appendChild(container);

  const iframe = document.createElement('iframe');
  iframe.src = `${VERCEL_URL}/widget?pos=${position}&v=${Date.now()}`; 
  
  // ULTRA STUBBORN STYLING
  const styles = {
    'position': 'fixed',
    'bottom': '0',
    'top': 'auto',
    'width': '450px',
    'height': '700px',
    'border': 'none',
    'z-index': '2147483647', // Maximum possible z-index
    'background': 'transparent',
    'display': 'block',
    'visibility': 'visible',
    'color-scheme': 'none'
  };

  if (position === 'left') {
    styles['left'] = '0';
    styles['right'] = 'auto';
  } else {
    styles['right'] = '0';
    styles['left'] = 'auto';
  }

  for (let prop in styles) {
    iframe.style.setProperty(prop, styles[prop], 'important');
  }

  iframe.allow = 'microphone';
  container.appendChild(iframe);

  window.addEventListener('message', (event) => {
    if (event.origin !== VERCEL_URL) return;
    if (event.data === 'close-chatbot') {
      iframe.style.display = 'none';
    }
  });
})();
