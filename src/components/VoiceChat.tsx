"use client";

import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Mic, MicOff, Send, X, Volume2, Loader2, RotateCcw, History, AlertCircle, ShieldCheck } from "lucide-react";

export default function VoiceChat({ uid }: { uid?: string }) {
  const [isOpen, setIsOpen] = useState(false);
  const [isListening, setIsListening] = useState(false);
  
  const [agentName, setAgentName] = useState("Monstah AI");
  const [firstMessage, setFirstMessage] = useState("Hey! I'm Monstah AI. Ask me anything about how I can help your business — or just say hi! 👋");
  const [themeColor, setThemeColor] = useState("green");
  const [idleTimeout, setIdleTimeout] = useState(15);
  const [brandName, setBrandName] = useState("Monstah AI");
  const [messages, setMessages] = useState<{ role: string; content: string }[]>([]);
  const [micError, setMicError] = useState<string | null>(null);
  const [showPermissionModal, setShowPermissionModal] = useState(false);
  const [navigationLinks, setNavigationLinks] = useState<any[]>([]);
  const [quickLinks, setQuickLinks] = useState<{ label: string; action: string }[]>([]);

  useEffect(() => {
    // Fetch custom first message and agent name based on the widget uid
    const fetchSettings = async () => {
      const urlParams = new URLSearchParams(window.location.search);
      const widgetUid = uid || urlParams.get('uid');
      if (widgetUid) {
        try {
          const res = await fetch(`/api/settings?uid=${widgetUid}`);
          if (res.ok) {
            const data = await res.json();
            if (data.firstMessage) {
              setFirstMessage(data.firstMessage);
            }
            if (data.agentName) {
              setAgentName(data.agentName);
            }
            if (data.themeColor) {
              setThemeColor(data.themeColor);
            }
            if (data.idleTimeout) {
              setIdleTimeout(data.idleTimeout);
            }
            if (data.brandName) {
              setBrandName(data.brandName);
            }
            if (data.navigationLinks) {
              setNavigationLinks(data.navigationLinks);
            }
            if (data.quickLinks) {
              setQuickLinks(data.quickLinks);
            }
          }
        } catch (e) {
          console.error("Failed to load widget settings", e);
        }
      }
    };
    fetchSettings();
  }, []);

  // ---- Auto-Open (Pop-up) Logic ----
  useEffect(() => {
    // Check if we've already auto-opened this session to avoid annoying the user
    const hasAutoOpened = sessionStorage.getItem("monstah_auto_opened");
    
    if (!hasAutoOpened) {
      const timer = setTimeout(() => {
        setIsOpen(true);
        // Attempt to activate mic — will trigger permission prompt if needed
        setIsListening(true);
        isListeningRef.current = true;
        try { 
          recognitionRef.current?.start(); 
          startIdleTimer();
        } catch (e) {}
        
        sessionStorage.setItem("monstah_auto_opened", "true");
      }, 3000); // 3 second delay for the pop-up
      
      return () => clearTimeout(timer);
    }
  }, []);

  // Set initial greeting only if we have no messages yet, or if firstMessage updates
  useEffect(() => {
    if (messages.length === 0) {
      setMessages([{ role: "assistant", content: firstMessage }]);
    } else if (messages.length === 1 && messages[0].role === "assistant") {
      setMessages([{ role: "assistant", content: firstMessage }]);
    }
  }, [firstMessage]);

  const [showHistory, setShowHistory] = useState(false);
  const [sessions, setSessions] = useState<{ id: string; timestamp: string; messages: any[] }[]>(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("monstah_sessions");
      return saved ? JSON.parse(saved) : [];
    }
    return [];
  });

  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);

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

  // ---- Idle Timer (configurable per tenant) ----
  const startIdleTimer = () => {
    if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
    idleTimerRef.current = setTimeout(() => {
      recognitionRef.current?.stop();
      setIsListening(false);
      isListeningRef.current = false;
    }, idleTimeout * 1000);
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
    setMessages([{ role: "assistant", content: firstMessage }]);
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
    if (isOpen && messages.length === 1 && messages[0].content === firstMessage) {
      setTimeout(async () => {
        if (audioRef.current) {
          audioRef.current.play().catch(() => {});
          audioRef.current.pause();
        }
        await speak(firstMessage);
      }, 800);
    }
  }, [isOpen, messages, firstMessage]);

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

    recognition.onerror = (event: any) => {
      console.error("Speech recognition error", event.error);
      if (event.error === 'not-allowed') {
        setMicError("Permission denied");
        setIsListening(false);
        isListeningRef.current = false;
        setShowPermissionModal(true);
      } else if (event.error === 'network') {
        setMicError("Network error");
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

    if (micError === "Permission denied") {
      setShowPermissionModal(true);
      return;
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
        setMicError(null);
      } catch (e) {
        console.error("Mic start error:", e);
        // If it's already started, just ignore
        if (e instanceof Error && e.message.includes("already started")) {
          return;
        }
        setShowPermissionModal(true);
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

    // Get the tenant UID from the prop or URL if this is an embedded widget
    const urlParams = new URLSearchParams(window.location.search);
    const widgetUid = uid || urlParams.get('uid') || null;

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        body: JSON.stringify({ messages: newMessages, userId: widgetUid }),
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
      let urlToRedirect = "";
      const navMatch = aiResponse.match(/\[NAVIGATE:\s*([^\]\s]+)\s*\]/);
      if (navMatch) {
        const navId = navMatch[1].trim();
        aiResponse = aiResponse.replace(navMatch[0], "").trim();
        
        // Resolve Semantic ID to URL (e.g. PAGE_WRIST_STRAPS_2 -> navigationLinks[2].url)
        if (navId.startsWith("PAGE_")) {
          const parts = navId.split("_");
          const indexStr = parts[parts.length - 1];
          const index = parseInt(indexStr);
          if (!isNaN(index) && navigationLinks[index]) {
            urlToRedirect = navigationLinks[index].url;
          } else {
            console.error("Unknown Navigation ID:", navId);
          }
        } else {
          // SAFETY SHIELD: AI sent a raw string. Check if it matches a known URL exactly.
          const matchedLink = navigationLinks.find(l => l.url === navId);
          if (matchedLink) {
            urlToRedirect = matchedLink.url;
          } else {
            console.error("Blocked hallucinated navigation:", navId);
            // Optionally tell the user
            // aiResponse += "\n\n*(System Note: Blocked a potentially hallucinated link)*";
          }
        }

        if (urlToRedirect) {
          console.log("🚀 Redirecting to:", urlToRedirect);
          // Visual feedback in the chat window
          setMessages(prev => {
            const last = prev[prev.length - 1];
            return [...prev.slice(0, -1), { ...last, content: last.content + `\n\n*(Redirecting to: ${urlToRedirect})*` }];
          });
        } else {
          console.warn("⚠️ Navigation tag found but no valid URL resolved for ID:", navId);
        }
      }

      await speak(aiResponse);

      // Trigger redirect AFTER speaking finishes
      if (urlToRedirect) {
        // If running inside an iframe (embedded widget), notify the parent host page
        const isEmbedded = window.self !== window.top;
        
        // Final fallback: if it's not a full URL (no http/https)
        if (!urlToRedirect.startsWith('http')) {
          // If it looks like a domain (contains a dot and doesn't start with /)
          if (urlToRedirect.includes('.') && !urlToRedirect.startsWith('/')) {
            urlToRedirect = 'https://' + urlToRedirect;
          } else if (!isEmbedded) {
            // Only prepend origin if NOT embedded (otherwise parent handles relative)
            urlToRedirect = window.location.origin + (urlToRedirect.startsWith('/') ? '' : '/') + urlToRedirect;
          }
        }

        if (isEmbedded) {
          window.parent.postMessage({ type: 'redirect', url: urlToRedirect }, "*");
        } else {
          window.location.href = urlToRedirect;
        }
      }
    } catch (error) {
      console.error("Chat Error:", error);
    } finally {
      setIsLoading(false);
    }
  };

  // ---- TTS Playback ----
  const speak = (text: string): Promise<void> => {
    return new Promise(async (resolve) => {
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
            
            // RE-ARM MIC — use setTimeout to give iOS time to release audio session
            // iOS Safari rejects mic.start() if called in the same tick as audio.onended
            setTimeout(() => {
              if (wasListening) {
                isListeningRef.current = true;
                try {
                  recognitionRef.current?.start();
                } catch (e) {
                  console.error("Auto-restart error:", e);
                }
              }
              // Restart the idle countdown
              startIdleTimer();
              resolve();
            }, 350); // 350ms gives iOS time to fully release the audio session
          };
          await audioRef.current.play();
        } else {
          isSpeakingRef.current = false;
          resolve();
        }
      } catch (error) {
        isSpeakingRef.current = false;
        console.error("Playback error:", error);
        resolve();
      }
    });
  };

  const THEMES: Record<string, { primary: string; secondary: string; rgb: string; gradient: string }> = {
    green: { primary: "#44ff44", secondary: "#77ff77", rgb: "68, 255, 68", gradient: "conic-gradient(#000 0deg, #44ff44 90deg, #000 180deg, #44ff44 270deg, #000 360deg)" },
    red: { primary: "#ff1111", secondary: "#ff4444", rgb: "255, 17, 17", gradient: "conic-gradient(#000 0deg, #ff1111 90deg, #000 180deg, #ff1111 270deg, #000 360deg)" },
    blue: { primary: "#00eeff", secondary: "#55ffff", rgb: "0, 238, 255", gradient: "conic-gradient(#000 0deg, #00eeff 90deg, #000 180deg, #00eeff 270deg, #000 360deg)" },
    pink: { primary: "#ff00aa", secondary: "#ff55cc", rgb: "255, 0, 170", gradient: "conic-gradient(#000 0deg, #ff00aa 90deg, #000 180deg, #ff00aa 270deg, #000 360deg)" },
    gold: { primary: "#ffcc00", secondary: "#ffdd44", rgb: "255, 204, 0", gradient: "conic-gradient(#000 0deg, #ffcc00 90deg, #000 180deg, #ffcc00 270deg, #000 360deg)" },
    white: { primary: "#ffffff", secondary: "#dddddd", rgb: "255, 255, 255", gradient: "conic-gradient(#000 0deg, #ffffff 90deg, #000 180deg, #ffffff 270deg, #000 360deg)" },
    purple: { primary: "#aa00ff", secondary: "#cc44ff", rgb: "170, 0, 255", gradient: "conic-gradient(#000 0deg, #aa00ff 90deg, #000 180deg, #aa00ff 270deg, #000 360deg)" }
  };

  const activeTheme = THEMES[themeColor] || THEMES.green;

  return (
    <div style={{
      '--theme-primary': activeTheme.primary,
      '--theme-secondary': activeTheme.secondary,
      '--theme-rgb': activeTheme.rgb,
      '--theme-gradient': activeTheme.gradient,
      '--primary': activeTheme.primary, /* Override global for the widget */
      '--accent': activeTheme.primary, /* Override global for the widget */
    } as React.CSSProperties}>
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
                <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700 }}>{brandName.toUpperCase()}</h3>
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
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                          <button 
                            onClick={() => {
                              if (confirm("Delete all chat history?")) {
                                setSessions([]);
                                localStorage.removeItem("monstah_sessions");
                              }
                            }}
                            className="clear-all-btn"
                          >
                            Clear All History
                          </button>
                          {sessions.map(s => (
                            <div 
                              key={s.id} 
                              className={`history-item-container ${s.id === currentSessionId ? 'active' : ''}`}
                            >
                              <div 
                                onClick={() => loadSession(s)}
                                className="history-item-content"
                              >
                                <span className="text-xs opacity-50">{s.timestamp}</span>
                                <p className="truncate text-sm">{s.messages[1]?.content || 'Empty Chat'}</p>
                              </div>
                              <button 
                                onClick={(e) => {
                                  e.stopPropagation();
                                  const updated = sessions.filter(sess => sess.id !== s.id);
                                  setSessions(updated);
                                  localStorage.setItem("monstah_sessions", JSON.stringify(updated));
                                  if (s.id === currentSessionId) clearChat();
                                }}
                                className="delete-session-btn"
                                title="Delete"
                              >
                                <X size={14} />
                              </button>
                            </div>
                          ))}
                        </div>
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
                className={`mic-btn ${isListening ? "active" : ""} ${micError ? "error" : ""}`}
                title={micError === "Permission denied" ? "Microphone blocked" : "Toggle microphone"}
              >
                {micError === "Permission denied" ? <MicOff size={18} /> : <Mic size={18} />}
              </button>
              <button onClick={() => handleSend(input)} className="send-btn">
                <Send size={18} />
              </button>
            </div>

            {/* Permission Modal Overlay */}
            <AnimatePresence>
              {showPermissionModal && (
                <motion.div 
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="modal-overlay"
                >
                  <motion.div 
                    initial={{ scale: 0.9, y: 20 }}
                    animate={{ scale: 1, y: 0 }}
                    exit={{ scale: 0.9, y: 20 }}
                    className="permission-modal"
                  >
                    <div className="modal-header">
                      <div className="icon-badge">
                        <ShieldCheck size={24} color="var(--theme-primary)" />
                      </div>
                      <button onClick={() => setShowPermissionModal(false)} className="modal-close">
                        <X size={20} />
                      </button>
                    </div>
                    
                    <div className="modal-body">
                      <h3>Enable Microphone</h3>
                      <p>To talk with {agentName}, we need access to your microphone. This allows you to have a natural voice conversation.</p>
                      
                      <div className="instruction-box">
                        <div className="instruction-item">
                          <AlertCircle size={16} />
                          <span>Click the microphone icon in your browser address bar and select "Allow".</span>
                        </div>
                      </div>
                    </div>

                    <div className="modal-footer">
                      <button 
                        onClick={() => {
                          setShowPermissionModal(false);
                          setMicError(null);
                          // Re-attempting start usually triggers the native prompt if it wasn't permanently denied
                          setTimeout(() => toggleListening(), 300);
                        }}
                        className="grant-btn"
                      >
                        Try Again
                      </button>
                      <button onClick={() => setShowPermissionModal(false)} className="cancel-btn">
                        Maybe Later
                      </button>
                    </div>
                  </motion.div>
                </motion.div>
              )}
            </AnimatePresence>
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
              cursor: 'pointer',
              background: '#ffffff',
              borderRadius: '32px',
              padding: '12px 18px',
              boxShadow: '0 10px 40px rgba(0,0,0,0.25)',
              border: '1px solid rgba(0,0,0,0.05)'
            }}
          >
            <div className="cta-content">
              <span className="cta-text">Need help?</span>
              <div className="cta-bottom">
                <div className="vortex-avatar" />
                <div className="cta-button">
                  <Volume2 size={16} fill="white" />
                  <span>Talk to {agentName || "Monstah AI"}</span>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <style jsx>{`
        .cta-content {
          display: flex;
          flex-direction: column;
          gap: 4px;
        }

        .cta-text {
          color: #333;
          font-size: 0.8rem;
          font-weight: 800;
          font-family: 'Inter', sans-serif;
          text-align: center; /* Centered perfectly in the card */
          text-transform: uppercase;
          letter-spacing: 0.5px;
          width: 100%;
        }

        .cta-bottom {
          display: flex;
          align-items: center;
          gap: 8px; /* Pulled the avatar closer to the button */
        }

        .vortex-avatar {
          width: 40px;
          height: 40px;
          border-radius: 50%;
          background: var(--theme-gradient);
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
          padding: 8px 16px;
          border-radius: 30px;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          font-weight: 700;
          font-size: 0.85rem;
          white-space: nowrap; /* Prevent wrapping */
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
          border: 2px solid var(--theme-primary) !important; /* NEON LOCKDOWN */
          border-radius: 28px !important;
          overflow: hidden !important;
          box-shadow: 0 0 20px rgba(var(--theme-rgb), 0.4) !important;
          position: relative;
        }

        .neon-pulse {
          animation: neon-breathe 3s ease-in-out infinite !important;
        }

        @keyframes neon-breathe {
          0% { border-color: var(--theme-primary) !important; box-shadow: 0 0 15px rgba(var(--theme-rgb), 0.2) !important; }
          50% { border-color: var(--theme-secondary) !important; box-shadow: 0 0 30px rgba(var(--theme-rgb), 0.6) !important; }
          100% { border-color: var(--theme-primary) !important; box-shadow: 0 0 15px rgba(var(--theme-rgb), 0.2) !important; }
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

        .history-item-container {
          display: flex;
          align-items: stretch;
          border-radius: 12px;
          cursor: pointer;
          transition: all 0.2s;
          border: 1px solid rgba(255, 255, 255, 0.05);
          margin-bottom: 8px;
          background: #0d0d0f;
          overflow: hidden;
        }
        .history-item-container:hover { background: #1c1c1f; border-color: var(--primary); }
        .history-item-container.active { border-color: var(--primary); background: rgba(var(--primary-rgb), 0.1); }
        
        .history-item-content {
          flex: 1;
          padding: 12px;
          min-width: 0;
        }

        .delete-session-btn {
          width: 40px;
          background: rgba(255, 68, 68, 0.1);
          border: none;
          border-left: 1px solid rgba(255, 255, 255, 0.05);
          color: #ff4444;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          transition: background 0.2s;
        }
        .delete-session-btn:hover { background: rgba(255, 68, 68, 0.3); }

        .clear-all-btn {
          width: 100%;
          padding: 10px;
          background: rgba(255, 255, 255, 0.05);
          border: 1px dashed rgba(255, 255, 255, 0.2);
          border-radius: 8px;
          color: #888;
          font-size: 0.8rem;
          font-weight: 600;
          cursor: pointer;
          margin-bottom: 12px;
          transition: all 0.2s;
        }
        .clear-all-btn:hover { background: rgba(255, 68, 68, 0.1); color: #ff4444; border-color: rgba(255, 68, 68, 0.3); }

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

        .mic-btn.error {
          color: #ff4444;
          border-color: rgba(255, 68, 68, 0.4);
        }

        .modal-overlay {
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0, 0, 0, 0.85);
          backdrop-filter: blur(8px);
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 20px;
          z-index: 2000;
        }

        .permission-modal {
          background: #161618;
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 24px;
          width: 100%;
          max-width: 320px;
          padding: 24px;
          box-shadow: 0 20px 40px rgba(0, 0, 0, 0.5);
        }

        .modal-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          margin-bottom: 20px;
        }

        .icon-badge {
          width: 48px;
          height: 48px;
          background: rgba(var(--theme-rgb), 0.1);
          border-radius: 12px;
          display: flex;
          align-items: center;
          justify-content: center;
          border: 1px solid rgba(var(--theme-rgb), 0.2);
        }

        .modal-close {
          background: transparent;
          border: none;
          color: #666;
          cursor: pointer;
          padding: 4px;
          border-radius: 50%;
          transition: all 0.2s;
        }
        .modal-close:hover {
          background: rgba(255, 255, 255, 0.1);
          color: #fff;
        }

        .modal-body h3 {
          font-size: 1.25rem;
          font-weight: 700;
          color: #fff;
          margin: 0 0 12px 0;
        }

        .modal-body p {
          font-size: 0.9rem;
          color: #aaa;
          line-height: 1.6;
          margin-bottom: 20px;
        }

        .instruction-box {
          background: rgba(255, 255, 255, 0.03);
          border: 1px solid rgba(255, 255, 255, 0.05);
          border-radius: 12px;
          padding: 12px;
          margin-bottom: 24px;
        }

        .instruction-item {
          display: flex;
          gap: 10px;
          font-size: 0.8rem;
          color: var(--theme-primary);
          line-height: 1.4;
        }

        .modal-footer {
          display: flex;
          flex-direction: column;
          gap: 10px;
        }

        .grant-btn {
          background: var(--theme-primary);
          color: #000;
          border: none;
          padding: 12px;
          border-radius: 12px;
          font-weight: 700;
          cursor: pointer;
          transition: all 0.2s;
        }
        .grant-btn:hover {
          transform: translateY(-2px);
          filter: brightness(1.1);
        }

        .cancel-btn {
          background: transparent;
          color: #888;
          border: 1px solid rgba(255, 255, 255, 0.1);
          padding: 12px;
          border-radius: 12px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s;
        }
        .cancel-btn:hover {
          background: rgba(255, 255, 255, 0.05);
          color: #fff;
        }

        .spin {
          animation: spin 1s linear infinite;
        }
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
