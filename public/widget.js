(function() {
  const VERCEL_URL = "https://monstah-website-audio-chatbot.vercel.app";

  // ── Browser Compatibility Check ──────────────────────────────────────────
  // Next.js 16 requires Safari 16.4+. iPhone 7 (iOS 15) runs Safari 15 and
  // will get a blank iframe. Detect this early and show a graceful fallback.
  function getIOSSafariVersion() {
    var ua = navigator.userAgent;
    // Match iPhone/iPad running Safari (not Chrome/Firefox on iOS)
    var iOSMatch = ua.match(/iP(?:hone|ad|od).+OS (\d+)_/);
    var isSafari = /Safari\//.test(ua) && !/CriOS\//.test(ua) && !/FxiOS\//.test(ua);
    if (iOSMatch && isSafari) {
      return parseInt(iOSMatch[1], 10);
    }
    return null;
  }

  var iosMajor = getIOSSafariVersion();
  if (iosMajor !== null && iosMajor < 16) {
    // iOS 15 and below can't run this app at all (Next.js 16 requires Safari 16.4+).
    // Show a purely static message — no link, no broken page.
    var fallback = document.createElement('div');
    fallback.style.cssText = [
      'position:fixed',
      'bottom:20px',
      'right:20px',
      'z-index:2147483647',
      'font-family:-apple-system,sans-serif',
      'background:#000',
      'color:#44ff44',
      'border:2px solid #44ff44',
      'border-radius:16px',
      'padding:12px 16px',
      'font-size:13px',
      'font-weight:600',
      'max-width:220px',
      'text-align:center',
      'box-shadow:0 0 15px rgba(68,255,68,0.3)',
      'pointer-events:none'
    ].join('!important;') + '!important';

    fallback.textContent = '🤖 AI Chat requires iOS 16 or newer. Please update your iPhone to use this feature.';
    (document.body || document.documentElement).appendChild(fallback);
    return; // Stop here — don't load the iframe
  }
  // ── End Compatibility Check ───────────────────────────────────────────────

  const currentScript = document.currentScript;
  const position = 'right'; // FORCE TO RIGHT SIDE
  
  let uid = '';
  if (currentScript && currentScript.src) {
    try {
      const scriptUrl = new URL(currentScript.src);
      uid = scriptUrl.searchParams.get('uid') || '';
    } catch (e) {}
  }
  
  const wrapper = document.createElement('div');
  wrapper.id = 'monstah-ai-final-anchor';
  wrapper.style.cssText = `
    position: fixed !important;
    bottom: 0 !important;
    ${position}: 0 !important;
    width: 280px !important;
    height: 140px !important;
    z-index: 2147483647 !important;
    background: transparent !important;
    pointer-events: auto !important;
    cursor: pointer !important;
  `;
  
  (document.documentElement || document.body).appendChild(wrapper);

  // Pass the current page origin to the iframe so it can build absolute URLs correctly
  const pageOrigin = window.location.origin;

  const iframe = document.createElement('iframe');
  iframe.src = `${VERCEL_URL}/widget?pos=${position}&uid=${uid}&origin=${encodeURIComponent(pageOrigin)}&v=${Date.now()}`;
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
    
    if (event.data.type === 'toggle-chat') {
      if (event.data.isOpen) {
        const isMobile = window.innerWidth < 600;
        wrapper.style.width = isMobile ? '100vw' : '440px';
        wrapper.style.height = isMobile ? '80vh' : 'min(690px, 100vh)';
        wrapper.style.maxHeight = '100vh';
      } else {
        wrapper.style.width = '280px'; 
        wrapper.style.height = '140px';
      }
    } else if (event.data.type === 'redirect') {
      let url = event.data.url;
      // Safety net: resolve relative URLs against the current page origin
      // This handles cases where the AI returns a path like /product/knee-wraps/
      if (url && !url.startsWith('http')) {
        url = window.location.origin + (url.startsWith('/') ? '' : '/') + url;
      }
      if (url) {
        window.location.href = url;
      }
    }
  });
})();
