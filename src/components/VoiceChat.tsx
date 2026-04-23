"use client";

import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Mic, Send, X, Volume2, Loader2 } from "lucide-react";

export default function VoiceChat() {
  const [isOpen, setIsOpen] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [messages, setMessages] = useState<{ role: string; content: string }[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  
  const recognitionRef = useRef<any>(null);

  useEffect(() => {
    if (typeof window !== "undefined" && ("SpeechRecognition" in window || "webkitSpeechRecognition" in window)) {
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      recognitionRef.current = new SpeechRecognition();
      recognitionRef.current.continuous = false;
      recognitionRef.current.interimResults = false;

      recognitionRef.current.onresult = (event: any) => {
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
      const audio = new Audio(audioUrl);
      await audio.play();
    } catch (error) {
      console.error("Playback error:", error);
    }
  };

  return (
    <>
      {/* Floating Toggle Button */}
      <motion.button
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.9 }}
        onClick={() => setIsOpen(!isOpen)}
        className="floating-trigger"
      >
        {isOpen ? <X /> : <Mic />}
      </motion.button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            className="chat-window glass"
          >
            <div className="chat-header">
              <h3>Monstah Assistant</h3>
              <Volume2 size={18} className="text-secondary" />
            </div>

            <div className="chat-messages">
              {messages.length === 0 && (
                <div className="empty-state">
                  <p>How can I help you today?</p>
                </div>
              )}
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

      <style jsx>{`
        .floating-trigger {
          position: fixed;
          bottom: 30px;
          right: 30px;
          width: 64px;
          height: 64px;
          border-radius: 50%;
          background: var(--primary);
          color: var(--bg-dark);
          border: none;
          display: flex;
          align-items: center;
          justify-content: center;
          box-shadow: var(--glow-shadow);
          cursor: pointer;
          z-index: 1000;
        }

        .chat-window {
          position: fixed;
          bottom: 110px;
          right: 30px;
          width: 400px;
          height: 600px;
          display: flex;
          flex-direction: column;
          z-index: 1000;
          overflow: hidden;
        }

        .chat-header {
          padding: 20px;
          border-bottom: 1px solid var(--glass-border);
          display: flex;
          justify-content: space-between;
          align-items: center;
        }

        .chat-messages {
          flex: 1;
          padding: 20px;
          overflow-y: auto;
          display: flex;
          flex-direction: column;
          gap: 12px;
        }

        .message {
          padding: 12px 16px;
          border-radius: 16px;
          max-width: 85%;
          font-size: 0.95rem;
          line-height: 1.4;
        }

        .user {
          align-self: flex-end;
          background: var(--primary);
          color: var(--bg-dark);
        }

        .assistant {
          align-self: flex-start;
          background: rgba(255, 255, 255, 0.05);
          color: var(--text-primary);
          border: 1px solid var(--glass-border);
        }

        .chat-input-area {
          padding: 20px;
          display: flex;
          gap: 10px;
          background: rgba(0,0,0,0.2);
        }

        input {
          flex: 1;
          background: transparent;
          border: none;
          color: white;
          outline: none;
          font-size: 0.95rem;
        }

        .mic-btn, .send-btn {
          background: transparent;
          border: none;
          color: var(--text-secondary);
          cursor: pointer;
          transition: color 0.2s;
        }

        .mic-btn.active {
          color: var(--accent);
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
