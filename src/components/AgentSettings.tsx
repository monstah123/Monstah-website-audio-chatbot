"use client";

import { useState, useEffect } from "react";
import { auth } from "@/lib/firebase-client";
import { Save, Loader2, Bot, MessageSquare, Lock, Unlock, RefreshCw } from "lucide-react";

export default function AgentSettings() {
  const [agentName, setAgentName] = useState("");
  const [systemPrompt, setSystemPrompt] = useState("");
  const [firstMessage, setFirstMessage] = useState("");
  const [themeColor, setThemeColor] = useState("#44ff44");
  const [idleTimeout, setIdleTimeout] = useState(3);
  const [trainingSchedule, setTrainingSchedule] = useState("manual");
  const [brandName, setBrandName] = useState("");
  const [unlockCode, setUnlockCode] = useState("");
  const [isBrandingUnlocked, setIsBrandingUnlocked] = useState(false);
  const [navigationLinks, setNavigationLinks] = useState<{ name: string; url: string }[]>([]);
  const [quickLinks, setQuickLinks] = useState<{ label: string; action: string }[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [status, setStatus] = useState<{ type: "success" | "error"; message: string } | null>(null);

  useEffect(() => {
    const fetchSettings = async () => {
      if (!auth.currentUser) return;
      
      try {
        const res = await fetch(`/api/settings?uid=${auth.currentUser.uid}`);
        if (res.ok) {
          const data = await res.json();
          setAgentName(data.agentName || "Monstah AI");
          setSystemPrompt(data.systemPrompt || "");
          setFirstMessage(data.firstMessage || "");
          setThemeColor(data.themeColor || "green");
          setIdleTimeout(data.idleTimeout || 3);
          setTrainingSchedule(data.trainingSchedule || "manual");
          setBrandName(data.brandName || "");
          setIsBrandingUnlocked(!!data.brandName);
          setQuickLinks(data.quickLinks || []);
          // Convert the saved {name: url} map back to array for the UI
          if (data.navigationLinks) {
            // Support both array format and legacy {name:url} object
            if (Array.isArray(data.navigationLinks)) {
              setNavigationLinks(data.navigationLinks);
            } else {
              setNavigationLinks(
                Object.entries(data.navigationLinks).map(([name, url]) => ({ name, url: url as string }))
              );
            }
          }
        }
      } catch (e) {
        console.error("Failed to load settings", e);
      } finally {
        setIsLoading(false);
      }
    };

    // Wait a brief moment for auth to initialize if needed
    setTimeout(fetchSettings, 500);
  }, []);

  const handleSave = async () => {
    if (!auth.currentUser) return;
    
    setIsSaving(true);
    setStatus(null);

    try {
      const res = await fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: auth.currentUser.uid,
          agentName,
          systemPrompt,
          firstMessage,
          themeColor,
          idleTimeout,
          trainingSchedule,
          brandName,
          // Send as array directly — no conversion needed
          navigationLinks: navigationLinks.filter(l => l.name.trim() && l.url.trim()),
          quickLinks: quickLinks.filter(q => q.label.trim() && q.action.trim()),
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      setStatus({ type: "success", message: "Agent Settings Saved!" });
      setTimeout(() => setStatus(null), 3000);
    } catch (e: any) {
      setStatus({ type: "error", message: e.message });
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return <div className="settings-card glass loading"><Loader2 className="spin" /> Loading Settings...</div>;
  }

  return (
    <div className="settings-card glass">
      <div className="settings-header">
        <Bot size={24} color="var(--primary)" />
        <h2>Agent Identity</h2>
      </div>
      <p className="subtitle">Customize exactly how your AI behaves and talks to customers.</p>

      {/* ---- White-Label Branding (Pro Feature) ---- */}
      <div className={`input-group branding-panel ${isBrandingUnlocked ? 'unlocked' : 'locked'}`}>
        <div className="branding-header">
          {isBrandingUnlocked ? <Unlock size={16} color="#44ff44" /> : <Lock size={16} color="#ff9900" />}
          <label style={{ margin: 0 }}>White-Label Brand Name</label>
          {!isBrandingUnlocked && <span className="pro-badge">PRO</span>}
        </div>
        <p className="help-text">
          {isBrandingUnlocked
            ? "Your custom brand name is shown in the chat widget header instead of \"Monstah AI\"."
            : "Enter your unlock code to customize the brand name displayed in the widget header."}
        </p>

        {!isBrandingUnlocked ? (
          <div className="unlock-row">
            <input
              type="password"
              value={unlockCode}
              onChange={(e) => setUnlockCode(e.target.value)}
              placeholder="Enter unlock code..."
              className="unlock-input"
            />
            <button
              className="btn-unlock"
              onClick={async () => {
                try {
                  const res = await fetch("/api/unlock", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ code: unlockCode }),
                  });
                  const data = await res.json();
                  if (data.success) {
                    setIsBrandingUnlocked(true);
                    setStatus({ type: "success", message: "🔓 White-label branding unlocked!" });
                    setTimeout(() => setStatus(null), 3000);
                  } else {
                    setStatus({ type: "error", message: "❌ Invalid unlock code." });
                    setTimeout(() => setStatus(null), 3000);
                  }
                } catch {
                  setStatus({ type: "error", message: "❌ Something went wrong." });
                  setTimeout(() => setStatus(null), 3000);
                }
              }}
            >
              Unlock
            </button>
          </div>
        ) : (
          <input
            type="text"
            value={brandName}
            onChange={(e) => setBrandName(e.target.value)}
            placeholder="e.g. My Company AI"
          />
        )}
      </div>

      <div className="input-group">
        <label><Bot size={16} /> Widget Theme</label>
        <p className="help-text">Select the color palette for the chat widget's neon glow and vortex animation.</p>
        <select 
          value={themeColor}
          onChange={(e) => setThemeColor(e.target.value)}
          className="theme-select"
        >
          <option value="green">🟢 Monstah Green</option>
          <option value="red">🔴 Crimson Red</option>
          <option value="blue">🔵 Electric Blue</option>
          <option value="pink">🟣 Cyber Pink</option>
          <option value="gold">🟡 Liquid Gold</option>
          <option value="white">⚪️ Phantom White</option>
          <option value="purple">🔮 Amethyst Purple</option>
        </select>
      </div>

      <div className="input-group">
        <label><Bot size={16} /> Agent Name</label>
        <p className="help-text">This will be displayed on the chatbot button (e.g. "Talk to Sarah").</p>
        <input 
          type="text"
          value={agentName}
          onChange={(e) => setAgentName(e.target.value)}
          placeholder="e.g. Sarah"
        />
      </div>

      <div className="input-group">
        <label><MessageSquare size={16} /> First Message</label>
        <p className="help-text">The very first thing the agent will say when the user opens the chatbot.</p>
        <input 
          type="text"
          value={firstMessage}
          onChange={(e) => setFirstMessage(e.target.value)}
          placeholder="Hi! How can I help you today?"
        />
      </div>

      <div className="input-group">
        <label><MessageSquare size={16} /> Idle Mic Timeout</label>
        <p className="help-text">Adjust how long (in minutes) the AI waits for you to speak before it says something to keep the conversation going.</p>
        <div className="timeout-control" style={{ background: 'rgba(0,0,0,0.2)', padding: '15px', borderRadius: '12px' }}>
          <input 
            type="range" min="1" max="10" step="1" 
            value={idleTimeout} 
            onChange={(e) => setIdleTimeout(parseInt(e.target.value))} 
            style={{ accentColor: 'var(--primary)' }}
          />
          <span className="timeout-val" style={{ color: 'var(--primary)', fontWeight: 'bold' }}>{idleTimeout} min</span>
        </div>
      </div>

      <div className="input-group">
        <label><RefreshCw size={16} /> Data Training Schedule</label>
        <p className="help-text">Choose how often your AI should re-scan your website to learn about new products or updates.</p>
        <select 
          className="nav-input" 
          value={trainingSchedule} 
          onChange={(e) => setTrainingSchedule(e.target.value)}
          style={{ width: '100%', background: 'rgba(0,0,0,0.3)', color: 'white', cursor: 'pointer' }}
        >
          <option value="manual">Manual Refresh Only</option>
          <option value="daily">Daily Auto-Refresh (PRO)</option>
          <option value="weekly">Weekly Auto-Refresh (PRO)</option>
        </select>
      </div>

      {/* ---- Quick Action Buttons (FastBots Style) ---- */}
      <div className="input-group">
        <label><MessageSquare size={16} /> Quick Action Buttons</label>
        <p className="help-text">
          Add buttons that appear at the bottom of the chat. Users can click them to instantly ask a question or go to a link.
        </p>
        {quickLinks.map((ql, i) => (
          <div key={i} className="nav-link-row">
            <input
              type="text"
              value={ql.label}
              onChange={(e) => {
                const updated = [...quickLinks];
                updated[i].label = e.target.value;
                setQuickLinks(updated);
              }}
              placeholder="Button Label (e.g. Pricing)"
              className="nav-input"
            />
            <input
              type="text"
              value={ql.action}
              onChange={(e) => {
                const updated = [...quickLinks];
                updated[i].action = e.target.value;
                setQuickLinks(updated);
              }}
              placeholder="Question or URL"
              className="nav-input"
            />
            <button
              className="btn-remove-nav"
              onClick={() => setQuickLinks(quickLinks.filter((_, idx) => idx !== i))}
            >✕</button>
          </div>
        ))}
        <button
          className="btn-add-nav"
          onClick={() => setQuickLinks([...quickLinks, { label: "", action: "" }])}
        >+ Add Quick Button</button>
      </div>

      {/* ---- Navigation Links ---- */}
      <div className="input-group">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
          <label style={{ margin: 0 }}><MessageSquare size={16} /> Page Navigation Links</label>
          <span className="link-count-badge">
            {navigationLinks.filter(l => l.name.trim() && l.url.trim()).length} Active Links
          </span>
        </div>
        <p className="help-text">
          Add as many pages as you want. The AI will send users there when they ask 
          (e.g. &ldquo;Take me to the hoodies page&rdquo;). URLs must be complete and exact — copy them directly from your browser.
        </p>
        
        {navigationLinks.map((link, i) => (
          <div key={i} className="nav-link-row">
            <input
              type="text"
              value={link.name}
              onChange={(e) => {
                const updated = [...navigationLinks];
                updated[i].name = e.target.value;
                setNavigationLinks(updated);
              }}
              placeholder={`Page name (e.g. Hoodies, Contact, Pricing)`}
              className="nav-input"
            />
            <input
              type="text"
              value={link.url}
              onChange={(e) => {
                const updated = [...navigationLinks];
                updated[i].url = e.target.value;
                setNavigationLinks(updated);
              }}
              placeholder="https://yoursite.com/exact-page-path"
              className="nav-input"
            />
            <button
              className="btn-test-nav"
              title="Test this link"
              onClick={() => {
                if (link.url.trim()) {
                  window.open(link.url.startsWith('http') ? link.url : `https://${link.url}`, '_blank');
                }
              }}
            >🔗</button>
            <button
              className="btn-remove-nav"
              onClick={() => setNavigationLinks(navigationLinks.filter((_, idx) => idx !== i))}
            >✕</button>
          </div>
        ))}

        <button
          className="btn-add-nav"
          onClick={() => setNavigationLinks([...navigationLinks, { name: "", url: "" }])}
        >+ Add Another Page Link</button>

        {navigationLinks.length > 0 && (
          <p className="help-text" style={{ marginTop: '10px', color: 'rgba(255,200,100,0.8)' }}>
            ⚠️ Paste URLs exactly from your browser address bar. One wrong character = 404 error.
          </p>
        )}
      </div>

      <div className="input-group">
        <label><Bot size={16} /> System Prompt</label>
        <p className="help-text">Give your AI a name, personality, and specific rules (e.g. "You are Sarah, a helpful real estate assistant...").</p>
        <textarea 
          value={systemPrompt}
          onChange={(e) => setSystemPrompt(e.target.value)}
          placeholder="You are a helpful and friendly customer service representative..."
          rows={6}
        />
      </div>

      {status && (
        <div className={`status-message ${status.type}`}>
          {status.message}
        </div>
      )}

      <button onClick={handleSave} disabled={isSaving} className="btn-save">
        {isSaving ? <Loader2 size={18} className="spin" /> : <><Save size={18} /> Save Agent</>}
      </button>

      <style jsx>{`
        .settings-card {
          padding: 32px;
          border-radius: 20px;
          background: rgba(10, 10, 10, 0.8);
          border: 1px solid var(--glass-border);
          margin-top: 32px;
        }

        .settings-header {
          display: flex;
          align-items: center;
          gap: 12px;
          margin-bottom: 8px;
        }

        .settings-header h2 {
          font-size: 1.5rem;
          font-weight: 700;
          margin: 0;
        }

        .subtitle {
          color: var(--text-secondary);
          margin-bottom: 24px;
          font-size: 0.95rem;
        }

        .input-group {
          margin-bottom: 24px;
        }

        label {
          display: flex;
          align-items: center;
          gap: 8px;
          font-weight: 600;
          margin-bottom: 4px;
          color: white;
        }

        .help-text {
          font-size: 0.85rem;
          color: var(--text-secondary);
          margin-bottom: 12px;
        }

        textarea, input, .theme-select {
          width: 100%;
          background: rgba(0, 0, 0, 0.5);
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 12px;
          padding: 16px;
          color: white;
          font-size: 1rem;
          font-family: inherit;
          transition: border-color 0.2s;
        }

        textarea {
          resize: vertical;
        }

        textarea:focus, input:focus, .theme-select:focus {
          outline: none;
          border-color: var(--primary);
        }

        .theme-select option {
          background: #1a1a1a;
          color: white;
          padding: 10px;
        }

        .btn-save {
          width: 100%;
          padding: 16px;
          background: var(--primary);
          color: #000;
          border: none;
          border-radius: 12px;
          font-weight: 700;
          font-size: 1.05rem;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          transition: transform 0.2s, box-shadow 0.2s;
        }

        .btn-save:hover:not(:disabled) {
          transform: translateY(-2px);
          box-shadow: 0 0 20px rgba(68, 255, 68, 0.4);
        }

        .btn-save:disabled {
          opacity: 0.7;
          cursor: not-allowed;
        }

        .spin {
          animation: spin 1s linear infinite;
        }

        .status-message {
          padding: 12px;
          border-radius: 8px;
          margin-bottom: 16px;
          text-align: center;
          font-weight: 500;
        }

        .status-message.success {
          background: rgba(68, 255, 68, 0.1);
          color: #44ff44;
          border: 1px solid rgba(68, 255, 68, 0.2);
        }

        .status-message.error {
          background: rgba(255, 68, 68, 0.1);
          color: #ff4444;
          border: 1px solid rgba(255, 68, 68, 0.2);
        }

        .loading {
          display: flex;
          gap: 12px;
          justify-content: center;
          align-items: center;
          height: 200px;
          color: var(--text-secondary);
        }

        .branding-panel {
          border-radius: 12px;
          padding: 16px;
          background: rgba(255, 153, 0, 0.05);
          border: 1px solid rgba(255, 153, 0, 0.2);
          transition: all 0.3s;
        }

        .branding-panel.unlocked {
          background: rgba(68, 255, 68, 0.05);
          border-color: rgba(68, 255, 68, 0.2);
        }

        .branding-header {
          display: flex;
          align-items: center;
          gap: 8px;
          margin-bottom: 4px;
        }

        .pro-badge {
          background: linear-gradient(135deg, #ff9900, #ff6600);
          color: #000;
          font-size: 0.65rem;
          font-weight: 800;
          padding: 2px 7px;
          border-radius: 20px;
          letter-spacing: 1px;
          text-transform: uppercase;
          margin-left: auto;
        }

        .unlock-row {
          display: flex;
          gap: 10px;
        }

        .unlock-input {
          flex: 1;
        }

        .btn-unlock {
          padding: 14px 20px;
          background: linear-gradient(135deg, #ff9900, #ff6600);
          color: #000;
          border: none;
          border-radius: 12px;
          font-weight: 700;
          font-size: 0.9rem;
          cursor: pointer;
          white-space: nowrap;
          transition: transform 0.2s, box-shadow 0.2s;
        }

        .btn-unlock:hover {
          transform: translateY(-2px);
          box-shadow: 0 0 20px rgba(255, 153, 0, 0.4);
        }

        .nav-link-row {
          display: flex;
          gap: 8px;
          margin-bottom: 10px;
          align-items: center;
        }

        .nav-input {
          flex: 1;
        }

        .btn-remove-nav {
          background: rgba(255, 68, 68, 0.15);
          border: 1px solid rgba(255, 68, 68, 0.3);
          border-radius: 8px;
          color: #ff4444;
          width: 36px;
          height: 36px;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          font-size: 1rem;
          flex-shrink: 0;
          transition: all 0.2s;
        }

        .btn-remove-nav:hover {
          background: rgba(255, 68, 68, 0.3);
        }

        .btn-add-nav {
          width: 100%;
          padding: 12px;
          background: rgba(68, 255, 68, 0.08);
          border: 1px dashed rgba(68, 255, 68, 0.3);
          border-radius: 12px;
          color: var(--primary);
          font-weight: 600;
          font-size: 0.95rem;
          cursor: pointer;
          transition: all 0.2s;
          margin-top: 4px;
        }

        .btn-add-nav:hover {
          background: rgba(68, 255, 68, 0.15);
        }

        .btn-test-nav {
          background: rgba(255, 255, 255, 0.05);
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 8px;
          color: white;
          width: 36px;
          height: 36px;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          font-size: 1rem;
          flex-shrink: 0;
          transition: all 0.2s;
        }

        .btn-test-nav:hover {
          background: rgba(255, 255, 255, 0.15);
          border-color: var(--primary);
        }

        .link-count-badge {
          background: rgba(68, 255, 68, 0.1);
          color: var(--primary);
          padding: 4px 10px;
          border-radius: 20px;
          font-size: 0.75rem;
          font-weight: 700;
          border: 1px solid rgba(68, 255, 68, 0.2);
        }

        @keyframes spin {
          100% { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
