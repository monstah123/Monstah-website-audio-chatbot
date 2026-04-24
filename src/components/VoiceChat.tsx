"use client";

import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Mic, Send, X, Volume2, Loader2, RotateCcw } from "lucide-react";

export default function VoiceChat() {
  const [isOpen, setIsOpen] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const initialGreeting = { role: "assistant", content: "Hi, I'm Peterson. How can I help you today?" };
  const [messages, setMessages] = useState<{ role: string; content: string }[]>([initialGreeting]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  
  const recognitionRef = useRef<any>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const idleTimerRef = useRef<NodeJS.Timeout | null>(null);

  const startIdleTimer = () => {
    if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
    idleTimerRef.current = setTimeout(() => {
      if (isListening) {
        recognitionRef.current?.stop();
        setIsListening(false);
      }
    }, 15000); // 15 seconds
  };

  const resetIdleTimer = () => {
    if (isListening) startIdleTimer();
  };

  useEffect(() => {
    if (isListening) {
      startIdleTimer();
    } else {
      if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
    }
    return () => {
      if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
    };
  }, [isListening]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const clearChat = () => {
    setMessages([initialGreeting]);
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
  };

  // Notify parent window of size changes
  useEffect(() => {
    if (window.parent) {
      window.parent.postMessage({ type: 'toggle-chat', isOpen }, "*");
    }
  }, [isOpen]);

  useEffect(() => {
    if (typeof window !== "undefined" && ("SpeechRecognition" in window || "webkitSpeechRecognition" in window)) {
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      recognitionRef.current = new SpeechRecognition();
      recognitionRef.current.continuous = false;
      recognitionRef.current.interimResults = false;

      recognitionRef.current.onresult = (event: any) => {
        resetIdleTimer(); // Reset timer on speech
        const transcript = event.results[0][0].transcript;
        setInput(transcript);
        handleSend(transcript);
      };

      recognitionRef.current.onend = () => {
        setIsListening(false);
      };
    }
  }, []);

  const toggleListening = () => {
    if (isListening) {
      recognitionRef.current?.stop();
    } else {
      setIsListening(true);
      recognitionRef.current?.start();
    }
  };

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

      // Generate and play audio response using OpenAI TTS
      await speak(aiResponse);

    } catch (error) {
      console.error("Chat Error:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const speak = async (text: string) => {
    try {
      const response = await fetch("/api/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });

      if (!response.ok) throw new Error("TTS failed");

      const audioBlob = await response.blob();
      const audioUrl = URL.createObjectURL(audioBlob);
      
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }

      const audio = new Audio(audioUrl);
      audioRef.current = audio;
      
      // Auto-listening after AI finishes speaking
      audio.onended = () => {
        setIsListening(true);
        try {
          recognitionRef.current?.start();
        } catch (e) {
          console.error("Recognition start error:", e);
        }
        URL.revokeObjectURL(audioUrl);
      };

      await audio.play();
    } catch (error) {
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
              bottom: '90px',
              left: '20px',
              zIndex: 999999
            }}
          >
            <div className="chat-header">
              <div className="flex items-center gap-2">
                <Volume2 size={18} className="text-secondary" />
                <h3>Monstah Assistant</h3>
              </div>
              <button onClick={clearChat} className="clear-btn" title="Clear Conversation">
                <RotateCcw size={16} />
              </button>
            </div>

            <div className="chat-messages">
              {messages.map((m, i) => (
                <div key={i} className={`message ${m.role}`}>
                  {m.content}
                </div>
              ))}
              {isLoading && (
                <div className="message assistant loading">
                  <Loader2 className="animate-spin" size={16} />
                </div>
              )}
              <div ref={messagesEndRef} />
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

      {/* Floating Toggle Button */}
      <motion.button
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.9 }}
        onClick={() => setIsOpen(!isOpen)}
        className="floating-trigger"
        style={{ 
          position: 'absolute',
          bottom: '20px',
          left: '20px',
          zIndex: 999999
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
          width: 380px;
          height: 550px;
          display: flex;
          flex-direction: column;
          overflow: hidden;
          background: #0d0d0f !important; /* Total Solid Black */
          border: 2px solid rgba(255, 255, 255, 0.15);
          border-radius: 28px;
          box-shadow: 0 30px 60px rgba(0, 0, 0, 0.9);
          margin-bottom: 20px;
        }

        .chat-header {
          padding: 18px 25px;
          background: #161618; /* Solid Header */
          border-bottom: 1px solid rgba(255, 255, 255, 0.1);
          display: flex;
          justify-content: space-between;
          align-items: center;
        }

        .clear-btn {
          background: #252529;
          border: 1px solid rgba(255, 255, 255, 0.2);
          color: var(--primary);
          cursor: pointer;
          padding: 8px;
          border-radius: 12px;
          transition: all 0.2s;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .clear-btn:hover {
          background: var(--primary);
          color: #000;
        }

        .chat-messages {
          flex: 1;
          padding: 20px 25px; /* Extra padding to stop cutoff */
          overflow-y: auto;
          display: flex;
          flex-direction: column;
          gap: 15px;
          background: #0d0d0f; /* Solid Background */
        }

        .message {
          padding: 12px 18px; /* Roomy padding */
          border-radius: 20px;
          max-width: 90%;
          font-size: 1rem;
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
          background: #1c1c1f; /* Solid Grey */
          color: #fff;
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-bottom-left-radius: 4px;
        }

        .chat-messages::-webkit-scrollbar {
          width: 8px;
        }

        .chat-messages::-webkit-scrollbar-thumb {
          background: #333;
          border-radius: 10px;
        }

        .chat-input-area {
          padding: 15px;
          display: flex;
          gap: 8px;
          background: rgba(255, 255, 255, 0.03);
          border-top: 1px solid rgba(255, 255, 255, 0.1);
        }

        input {
          flex: 1;
          background: rgba(255, 255, 255, 0.05);
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 12px;
          padding: 8px 15px;
          color: white;
          outline: none;
          font-size: 0.9rem;
        }

        .mic-btn, .send-btn {
          background: rgba(255, 255, 255, 0.05);
          border-radius: 12px;
          width: 40px;
          height: 40px;
          display: flex;
          align-items: center;
          justify-content: center;
          color: var(--primary);
          cursor: pointer;
          transition: all 0.2s;
        }

        .mic-btn.active {
          background: var(--accent);
          color: white;
          animation: pulse-glow 1.5s infinite;
        }

        .mic-btn:hover, .send-btn:hover {
          color: var(--primary);
        }

        .animate-spin {
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
