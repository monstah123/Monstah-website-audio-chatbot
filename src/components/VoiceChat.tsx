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

  const [messages, setMessages] = useState<{ role: string; content: string }[]>(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("monstah_chat_history");
      return saved ? JSON.parse(saved) : [initialGreeting];
    }
    return [initialGreeting];
  });

  // Save to localStorage whenever messages change
  useEffect(() => {
    localStorage.setItem("monstah_chat_history", JSON.stringify(messages));
    
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
    
    // Greet audibly when opened for the first time in a session
    if (isOpen && messages.length === 1 && messages[0].content === initialGreeting.content) {
      // Small delay to let animation finish
      setTimeout(() => {
        speak(initialGreeting.content);
      }, 500);
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
      try { recognitionRef.current?.start(); } catch {}
    }
  };

  // ---- Send Message ----
  const handleSend = async (text: string) => {
    if (!text.trim()) return;
    
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
        setMessages(prev => {
          const last = prev[prev.length - 1];
          return [...prev.slice(0, -1), { ...last, content: aiResponse }];
        });
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

      const response = await fetch("/api/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
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
          if (isListeningRef.current) {
            try {
              recognitionRef.current?.start();
            } catch (e) {
              console.error("Auto-restart error:", e);
            }
          }
          resetIdleTimer();
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
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="chat-window"
            style={{ 
              position: 'absolute',
              bottom: '0px',
              left: '0px',
              width: '100%',
              height: '100%',
              zIndex: 999999
            }}
          >
            <audio ref={audioRef} style={{ display: 'none' }} playsInline />
            
            <div className="chat-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Volume2 size={18} color="var(--primary)" />
                <h3 style={{ margin: 0 }}>Monstah Assistant</h3>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={() => setShowHistory(!showHistory)} className="history-btn" title="Convo History">
                  <History size={16} />
                </button>
                <button onClick={clearChat} className="clear-btn" title="Clear Conversation">
                  <RotateCcw size={16} />
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

      <motion.button
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.9 }}
        onClick={() => setIsOpen(!isOpen)}
        className="floating-trigger"
        style={{ 
          position: 'absolute',
          bottom: '20px',
          left: '20px',
          zIndex: 999999,
          pointerEvents: 'auto'
        }}
      >
        {isOpen ? <X /> : <Mic />}
      </motion.button>

      <style jsx>{`
        .floating-trigger {
          width: 60px;
          height: 60px;
          border-radius: 50%;
          background: var(--primary);
          color: var(--bg-dark);
          border: 4px solid rgba(255, 255, 255, 0.1);
          display: flex;
          align-items: center;
          justify-content: center;
          box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5), var(--glow-shadow);
          cursor: pointer;
        }

        .chat-window {
          display: grid;
          grid-template-rows: 60px 1fr 75px; /* RIGID GRID */
          width: 100%;
          height: 100%;
          background: #0d0d0f !important;
          border: 2px solid rgba(255, 255, 255, 0.15);
          border-radius: 28px;
          overflow: hidden;
          box-shadow: 0 20px 50px rgba(0,0,0,1);
          position: relative;
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
        input::placeholder { color: #888; }

        .mic-btn, .send-btn, .clear-btn, .history-btn {
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
