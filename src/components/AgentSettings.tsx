"use client";

import { useState, useEffect } from "react";
import { auth } from "@/lib/firebase-client";
import { Save, Loader2, Bot, MessageSquare } from "lucide-react";

export default function AgentSettings() {
  const [agentName, setAgentName] = useState("");
  const [systemPrompt, setSystemPrompt] = useState("");
  const [firstMessage, setFirstMessage] = useState("");
  const [themeColor, setThemeColor] = useState("green");
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
          setAgentName(data.agentName || "Peterson");
          setSystemPrompt(data.systemPrompt || "");
          setFirstMessage(data.firstMessage || "");
          setThemeColor(data.themeColor || "green");
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
        <label><Bot size={16} /> System Prompt</label>
        <p className="help-text">Give your AI a name, personality, and specific rules (e.g. "You are Sarah, a helpful real estate assistant...").</p>
        <textarea 
          value={systemPrompt}
          onChange={(e) => setSystemPrompt(e.target.value)}
          placeholder="You are a helpful and friendly customer service representative..."
          rows={6}
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

        @keyframes spin {
          100% { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
