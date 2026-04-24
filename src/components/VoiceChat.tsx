"use client";

import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Mic, Send, X, Volume2, Loader2, RotateCcw, History } from "lucide-react";

export default function VoiceChat() {
  const [isOpen, setIsOpen] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const initialGreeting = { role: "assistant", content: "Hi, I'm Peterson. How can I help you today?" };
  const [showHistory, setShowHistory] = useState(false);
  const [sessions, setSessions] = useState<{ id: string; timestamp: string; messages: any[] }[]>(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("monstah_sessions");
      return saved ? JSON.parse(saved) : [];
    }
    return [];
  });

  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);

  const [messages, setMessages] = useState<{ role: string; content: string }[]>([initialGreeting]);

  // Save to localStorage whenever messages change
  useEffect(() => {
    if (messages.length > 1) {
      localStorage.setItem("monstah_chat_history", JSON.stringify(messages));
    }
    
    // Update or create session in sessions list
    if (messages.length > 1) {
      setSessions(prev => {
        const now = new Date().toLocaleString();
        const updated = [...prev];
        const existingIdx = updated.findIndex(s => s.id === currentSessionId);
        
        if (existingIdx >= 0) {
          updated[existingIdx].messages = messages;
        } else {
          const newId = Date.now().toString();
          setCurrentSessionId(newId);
          updated.unshift({ id: newId, timestamp: now, messages });
        }
        
        localStorage.setItem("monstah_sessions", JSON.stringify(updated.slice(0, 20))); // Limit to 20
        return updated;
      });
    }
  }, [messages]);

  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  
  const recognitionRef = useRef<any>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const idleTimerRef = useRef<NodeJS.Timeout | null>(null);
  const isSpeakingRef = useRef(false);
  const isListeningRef = useRef(false);

  // ---- Idle Timer (15s) ----
  const startIdleTimer = () => {
    if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
    idleTimerRef.current = setTimeout(() => {
      recognitionRef.current?.stop();
      setIsListening(false);
      isListeningRef.current = false;
    }, 15000);
  };

  const resetIdleTimer = () => {
    if (isListeningRef.current) startIdleTimer();
  };

  // ---- Scroll ----
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => { scrollToBottom(); }, [messages]);

  // ---- Clear Chat ----
  const clearChat = () => {
    setMessages([initialGreeting]);
    setCurrentSessionId(null);
    localStorage.removeItem("monstah_chat_history");
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.src = "";
    }
    recognitionRef.current?.stop();
    setIsListening(false);
    isListeningRef.current = false;
    isSpeakingRef.current = false;
  };

  const loadSession = (session: any) => {
    setMessages(session.messages);
    setCurrentSessionId(session.id);
    setShowHistory(false);
  };

  // ---- Notify parent iframe of open/close ----
  useEffect(() => {
    if (window.parent) {
      window.parent.postMessage({ type: 'toggle-chat', isOpen }, "*");
    }
    
    // Greet audibly when opened
    if (isOpen && messages.length === 1 && messages[0].content === initialGreeting.content) {
      setTimeout(async () => {
        if (audioRef.current) {
          audioRef.current.play().catch(() => {});
          audioRef.current.pause();
        }
        await speak(initialGreeting.content);
      }, 800);
    }
  }, [isOpen]);

  // ---- Speech Recognition Setup ----
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!("SpeechRecognition" in window || "webkitSpeechRecognition" in window)) return;

    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    const recognition = new SR();
    recognition.continuous = true;       // STAY ALIVE between utterances
    recognition.interimResults = false;

    recognition.onresult = (event: any) => {
      if (isSpeakingRef.current) return; // ignore while AI speaks
      const last = event.results[event.results.length - 1];
      if (last.isFinal) {
        resetIdleTimer();
        const transcript = last[0].transcript;
        setInput(transcript);
        handleSend(transcript);
      }
    };

    recognition.onend = () => {
      // Auto-restart if we're supposed to be listening
      if (isListeningRef.current) {
        try { recognition.start(); } catch { 
          setIsListening(false);
          isListeningRef.current = false;
        }
      } else {
        setIsListening(false);
      }
    };

    recognitionRef.current = recognition;
  }, []);

  // ---- Mic Toggle ----
  const toggleListening = () => {
    // Unlock audio on iOS
    if (audioRef.current) {
      audioRef.current.play().catch(() => {});
      audioRef.current.pause();
    }

    if (isListening) {
      recognitionRef.current?.stop();
      setIsListening(false);
      isListeningRef.current = false;
    } else {
      setIsListening(true);
      isListeningRef.current = true;
      startIdleTimer();
      try { 
        recognitionRef.current?.start(); 
      } catch (e) {
        console.error("Mic start error:", e);
      }
    }
  };

  const handleCTAOpen = () => {
    setIsOpen(true);
    // INSTANT ARM FOR CHROME
    setIsListening(true);
    isListeningRef.current = true;
    startIdleTimer();
    try { 
      recognitionRef.current?.start(); 
    } catch (e) {
      console.error("CTA Mic start error:", e);
    }
  };

  // ---- Send Message ----
  const handleSend = async (text: string) => {
    if (!text.trim()) return;
    
    // Pause idle timer while AI thinks/speaks
    if (idleTimerRef.current) clearTimeout(idleTimerRef.current);

    const newMessages = [...messages, { role: "user", content: text }];
    setMessages(newMessages);
    setInput("");
    setIsLoading(true);

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        body: JSON.stringify({ messages: newMessages }),
      });

      if (!response.ok) throw new Error("Failed to fetch response");

      const reader = response.body?.getReader();
      let aiResponse = "";
      
      setMessages(prev => [...prev, { role: "assistant", content: "" }]);

      while (true) {
        const { done, value } = await reader!.read();
        if (done) break;
        const chunk = new TextDecoder().decode(value);
        aiResponse += chunk;
        
        // Hide the navigation tag from the UI while streaming
        const displayResponse = aiResponse.replace(/\[NAVIGATE:.*?\]/g, "").trim();
        
        setMessages(prev => {
          const last = prev[prev.length - 1];
          return [...prev.slice(0, -1), { ...last, content: displayResponse }];
        });
      }

      // Check for navigation command after stream is complete
      const navMatch = aiResponse.match(/\[NAVIGATE:\s*(https?:\/\/[^\]]+)\]/);
      if (navMatch) {
        const url = navMatch[1];
        aiResponse = aiResponse.replace(navMatch[0], "").trim();
        
        // Trigger redirect in parent window
        if (window.parent) {
          window.parent.postMessage({ type: 'redirect', url }, "*");
        }
      }

      await speak(aiResponse);
    } catch (error) {
      console.error("Chat Error:", error);
    } finally {
      setIsLoading(false);
    }
  };

  // ---- TTS Playback ----
  const speak = async (text: string) => {
    try {
      isSpeakingRef.current = true;

      // TEMPORARILY SUSPEND LISTENING SO OS DOES NOT DUCK VOLUME
      const wasListening = isListeningRef.current;
      if (wasListening) {
        isListeningRef.current = false;
        try { recognitionRef.current?.stop(); } catch (e) {}
      }

      const response = await fetch("/api/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, voice: "onyx" }),
      });

      if (!response.ok) throw new Error("TTS failed");

      const audioBlob = await response.blob();
      const audioUrl = URL.createObjectURL(audioBlob);
      
      if (audioRef.current) {
        audioRef.current.src = audioUrl;
        audioRef.current.onended = () => {
          isSpeakingRef.current = false;
          URL.revokeObjectURL(audioUrl);
          
          // RE-ARM MIC AUTOMATICALLY IF WE WERE LISTENING
          if (wasListening) {
            isListeningRef.current = true;
            try {
              recognitionRef.current?.start();
            } catch (e) {
              console.error("Auto-restart error:", e);
            }
          }
          // Restart the 15s countdown for the user to speak
          startIdleTimer();
        };
        await audioRef.current.play();
      } else {
        isSpeakingRef.current = false;
      }
    } catch (error) {
      isSpeakingRef.current = false;
      console.error("Playback error:", error);
    }
  };

  return (
    <>
      <AnimatePresence>
        {isOpen && (
            <motion.div
              initial={{ x: "100%", opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: "100%", opacity: 0 }}
              transition={{ type: "spring", damping: 25, stiffness: 200 }}
              className="chat-window neon-pulse"
              style={{ 
                position: 'fixed',
                bottom: '20px',
                right: '20px',
                width: 'calc(100vw - 40px)',
                maxWidth: '400px',
                height: 'calc(100vh - 40px)',
                maxHeight: '650px',
                pointerEvents: 'auto',
                zIndex: 2147483647
              }}
            >
            <audio ref={audioRef} style={{ display: 'none' }} playsInline />
            
            <div className="chat-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div className="status-dot" />
                <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700 }}>MONSTAH AI</h3>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <button onClick={() => setShowHistory(!showHistory)} className="header-icon-btn" title="History">
                  <History size={18} />
                </button>
                <button onClick={clearChat} className="header-icon-btn" title="Reset">
                  <RotateCcw size={18} />
                </button>
                <button onClick={() => setIsOpen(false)} className="header-icon-btn close-btn" title="Close">
                  <X size={20} />
                </button>
              </div>
            </div>

            <div className="chat-messages-container">
              <AnimatePresence>
                {showHistory && (
                  <motion.div 
                    initial={{ x: -300 }}
                    animate={{ x: 0 }}
                    exit={{ x: -300 }}
                    className="history-sidebar"
                  >
                    <div className="history-header">
                      <h4>Archive of Gains</h4>
                      <button onClick={() => setShowHistory(false)}><X size={16}/></button>
                    </div>
                    <div className="history-list">
                      {sessions.length === 0 ? (
                        <p className="p-4 text-center text-gray-500">No past sessions yet.</p>
                      ) : (
                        sessions.map(s => (
                          <div 
                            key={s.id} 
                            onClick={() => loadSession(s)}
                            className={`history-item ${s.id === currentSessionId ? 'active' : ''}`}
                          >
                            <span className="text-xs opacity-50">{s.timestamp}</span>
                            <p className="truncate text-sm">{s.messages[1]?.content || 'Empty Chat'}</p>
                          </div>
                        ))
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              <div className="chat-messages">
                {messages.map((m, i) => (
                  <div key={i} className={`message ${m.role}`}>
                    {m.content}
                  </div>
                ))}
                {isLoading && (
                  <div className="message assistant">
                    <Loader2 className="spin" size={16} />
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>
            </div>

            <div className="chat-input-area">
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyPress={(e) => e.key === "Enter" && handleSend(input)}
                placeholder="Ask anything..."
              />
              <button 
                onClick={toggleListening} 
                className={`mic-btn ${isListening ? "active" : ""}`}
              >
                <Mic size={18} />
              </button>
              <button onClick={() => handleSend(input)} className="send-btn">
                <Send size={18} />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {!isOpen && (
          <motion.div
            initial={{ x: 100, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: 100, opacity: 0 }}
            whileHover={{ scale: 1.02 }}
            onClick={handleCTAOpen}
            className="savage-cta-container"
            style={{ 
              position: 'fixed',
              bottom: '20px',
              right: '20px',
              zIndex: 999999,
              cursor: 'pointer'
            }}
          >
            <div className="cta-content">
              <div className="cta-top">
                <div className="vortex-avatar" />
                <span className="cta-text">Need help?</span>
              </div>
              <div className="cta-button">
                <Volume2 size={16} fill="white" />
                <span>Talk to Peterson</span>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <style jsx>{`
        .savage-cta-container {
          background: white;
          padding: 12px 16px;
          border-radius: 24px;
          box-shadow: 0 10px 40px rgba(0,0,0,0.2);
          width: 240px;
          border: 1px solid rgba(0,0,0,0.05);
        }

        .cta-content {
          display: flex;
          flex-direction: column;
          gap: 10px;
        }

        .cta-top {
          display: flex;
          align-items: center;
          gap: 12px;
        }

        .cta-text {
          color: #111;
          font-size: 1.1rem;
          font-weight: 600;
          font-family: 'Inter', sans-serif;
        }

        .vortex-avatar {
          width: 40px;
          height: 40px;
          border-radius: 50%;
          background: conic-gradient(#000 0deg, #44ff44 90deg, #000 180deg, #44ff44 270deg, #000 360deg);
          animation: rotate-vortex 4s linear infinite;
          box-shadow: inset 0 0 10px rgba(0,0,0,0.5);
          position: relative;
        }
        .vortex-avatar::after {
          content: '';
          position: absolute;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          width: 8px;
          height: 8px;
          background: #000;
          border-radius: 50%;
        }

        @keyframes rotate-vortex {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }

        .cta-button {
          background: #000;
          color: white;
          padding: 10px 20px;
          border-radius: 30px;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 10px;
          font-weight: 700;
          font-size: 0.95rem;
          transition: all 0.2s;
        }
        .cta-button:hover {
          background: #222;
          transform: translateY(-1px);
        }

        .chat-window {
          display: grid;
          grid-template-rows: 60px 1fr 75px; /* RIGID GRID */
          width: 100%;
          height: 100%;
          background: #0d0d0f !important;
          border: 2px solid #44ff44 !important; /* NEON LOCKDOWN */
          border-radius: 28px !important;
          overflow: hidden !important;
          box-shadow: 0 0 20px rgba(68, 255, 68, 0.4) !important;
          position: relative;
        }

        .neon-pulse {
          animation: neon-breathe 3s ease-in-out infinite !important;
        }

        @keyframes neon-breathe {
          0% { border-color: #44ff44 !important; box-shadow: 0 0 15px rgba(68, 255, 68, 0.2) !important; }
          50% { border-color: #77ff77 !important; box-shadow: 0 0 30px rgba(68, 255, 68, 0.6) !important; }
          100% { border-color: #44ff44 !important; box-shadow: 0 0 15px rgba(68, 255, 68, 0.2) !important; }
        }

        .chat-header {
          height: 60px;
          padding: 0 20px;
          background: #161618;
          border-bottom: 1px solid rgba(255, 255, 255, 0.1);
          display: flex;
          justify-content: space-between;
          align-items: center;
          position: relative;
          z-index: 1000; /* FRONT OF THE LINE */
        }

        .chat-messages-container {
          position: relative;
          min-height: 0; /* THE SECRET: allows row to shrink */
          overflow: hidden;
          background: #0d0d0f;
          z-index: 1;
        }

        .history-sidebar {
          position: absolute;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          background: #161618;
          z-index: 500;
          border-right: 1px solid rgba(255, 255, 255, 0.1);
          display: flex;
          flex-direction: column;
        }

        .history-header {
          padding: 15px 20px;
          display: flex;
          justify-content: space-between;
          align-items: center;
          border-bottom: 1px solid rgba(255, 255, 255, 0.1);
        }

        .history-list {
          flex: 1;
          overflow-y: auto;
          padding: 10px;
        }

        .history-item {
          padding: 12px;
          border-radius: 12px;
          cursor: pointer;
          transition: all 0.2s;
          border: 1px solid rgba(255, 255, 255, 0.05);
          margin-bottom: 8px;
          background: #0d0d0f;
        }

        .history-item:hover {
          background: #1c1c1f;
          border-color: var(--primary);
        }

        .history-item.active {
          border-color: var(--primary);
          background: rgba(var(--primary-rgb), 0.1);
        }

        .chat-messages {
          height: 100%;
          padding: 20px;
          overflow-y: auto;
          display: flex;
          flex-direction: column;
          gap: 15px;
          background: #0d0d0f;
          -webkit-overflow-scrolling: touch;
        }

        .chat-input-area {
          height: 75px;
          padding: 0 15px;
          background: #1c1c1f; /* LIGHTER GREY TO STAND OUT */
          border-top: 1px solid rgba(255, 255, 255, 0.2);
          display: flex;
          align-items: center;
          gap: 10px;
          position: relative;
          z-index: 1000;
        }

        .message {
          padding: 12px 18px;
          border-radius: 20px;
          max-width: 90%;
          font-size: 0.95rem;
          line-height: 1.5;
          word-wrap: break-word;
        }

        .user {
          align-self: flex-end;
          background: var(--primary);
          color: #000;
          font-weight: 600;
          border-bottom-right-radius: 4px;
        }

        .assistant {
          align-self: flex-start;
          background: #1c1c1f;
          color: #fff;
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-bottom-left-radius: 4px;
        }

        .chat-messages::-webkit-scrollbar {
          width: 6px;
        }
        .chat-messages::-webkit-scrollbar-thumb {
          background: #333;
          border-radius: 10px;
        }

        input {
          flex: 1;
          background: #0d0d0f;
          border: 1px solid rgba(255, 255, 255, 0.3);
          border-radius: 14px;
          padding: 12px 15px;
          color: white;
          outline: none;
          font-size: 1rem;
        }
        .status-dot {
          width: 8px;
          height: 8px;
          background: #44ff44;
          border-radius: 50%;
          box-shadow: 0 0 10px #44ff44;
          animation: pulse 2s infinite;
        }

        @keyframes pulse {
          0% { opacity: 0.4; }
          50% { opacity: 1; }
          100% { opacity: 0.4; }
        }

        .header-icon-btn {
          background: #252529;
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 10px;
          width: 36px;
          height: 36px;
          display: flex;
          align-items: center;
          justify-content: center;
          color: #fff;
          cursor: pointer;
          transition: all 0.2s;
        }
        .header-icon-btn:hover {
          background: #323238;
          border-color: var(--primary);
          color: var(--primary);
        }
        .header-icon-btn.close-btn {
          color: #ff4444;
        }
        .header-icon-btn.close-btn:hover {
          background: rgba(255, 0, 0, 0.1);
          border-color: #ff4444;
        }

        .mic-btn, .send-btn {
          background: #252529;
          border: 1px solid rgba(255, 255, 255, 0.2);
          border-radius: 12px;
          width: 42px;
          height: 42px;
          display: flex;
          align-items: center;
          justify-content: center;
          color: var(--primary);
          cursor: pointer;
        }

        .mic-btn.active {
          background: var(--accent);
          color: white;
          animation: pulse-glow 1.5s infinite;
        }

        .spin {
          animation: spin 1s linear infinite;
        }
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </>
  );
}
