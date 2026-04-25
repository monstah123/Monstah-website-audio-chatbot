"use client";

import { useState, useRef } from "react";
import { Upload, Link as LinkIcon, FileText, Loader2, CheckCircle2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { auth } from "@/lib/firebase-client";

export default function KnowledgeManager() {
  const [activeTab, setActiveTab] = useState<"file" | "url" | "text">("file");
  const [inputValue, setInputValue] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [status, setStatus] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (activeTab === "file" && !file) return;
    if (activeTab !== "file" && !inputValue.trim()) return;

    setIsUploading(true);
    setStatus(null);

    const formData = new FormData();
    formData.append("type", activeTab);

    // Pass the logged-in user's ID to isolate their knowledge base
    if (auth.currentUser) {
      formData.append("userId", auth.currentUser.uid);
    } else {
      setStatus({ type: "error", message: "You must be logged in to train the AI." });
      setIsUploading(false);
      return;
    }

    if (activeTab === "file" && file) {
      formData.append("file", file);
    } else if (activeTab === "url") {
      formData.append("url", inputValue);
    } else {
      formData.append("text", inputValue);
    }

    try {
      const response = await fetch("/api/ingest", {
        method: "POST",
        body: formData,
      });

      const data = await response.json();

      if (!response.ok) throw new Error(data.error || "Failed to upload");

      setStatus({ type: "success", message: data.message });
      setInputValue("");
      setFile(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
    } catch (error: any) {
      setStatus({ type: "error", message: error.message });
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="knowledge-manager">
      <div className="km-header">
        <h2>Clone Your Knowledge Base</h2>
        <p>Upload documents, paste links, or type raw text to instantly expand the chatbot's knowledge base.</p>
      </div>

      <div className="tabs">
        <button 
          className={activeTab === "file" ? "active" : ""} 
          onClick={() => { setActiveTab("file"); setStatus(null); }}
        >
          <Upload size={18} /> File Upload
        </button>
        <button 
          className={activeTab === "url" ? "active" : ""} 
          onClick={() => { setActiveTab("url"); setStatus(null); }}
        >
          <LinkIcon size={18} /> Website Link
        </button>
        <button 
          className={activeTab === "text" ? "active" : ""} 
          onClick={() => { setActiveTab("text"); setStatus(null); }}
        >
          <FileText size={18} /> Raw Text
        </button>
      </div>

      <form onSubmit={handleSubmit} className="upload-area">
        <AnimatePresence mode="wait">
          {activeTab === "file" && (
            <motion.div 
              key="file"
              initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}
              className="file-drop-zone"
              onClick={() => fileInputRef.current?.click()}
            >
              <input 
                type="file" 
                ref={fileInputRef} 
                style={{ display: "none" }} 
                accept=".txt,.csv,.pdf" 
                onChange={(e) => setFile(e.target.files?.[0] || null)}
              />
              <Upload size={40} className="upload-icon" />
              <h3>{file ? file.name : "Click to select a file"}</h3>
              <p>Supports .PDF, .TXT, and .CSV</p>
            </motion.div>
          )}

          {activeTab === "url" && (
            <motion.div key="url" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
              <input 
                type="url" 
                className="text-input" 
                placeholder="https://monstahgymwear.com/about" 
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                required
              />
            </motion.div>
          )}

          {activeTab === "text" && (
            <motion.div key="text" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
              <textarea 
                className="text-input textarea" 
                placeholder="Paste any text, FAQs, or product details here..." 
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                rows={6}
                required
              />
            </motion.div>
          )}
        </AnimatePresence>

        {status && (
          <div className={`status-message ${status.type}`}>
            {status.type === "success" ? <CheckCircle2 size={18} /> : null}
            {status.message}
          </div>
        )}

        <button type="submit" className="btn-submit" disabled={isUploading || (activeTab === 'file' && !file)}>
          {isUploading ? <Loader2 size={18} className="spin" /> : "Train AI"}
        </button>
      </form>

      <style jsx>{`
        .knowledge-manager {
          width: 100%;
          max-width: 800px;
          background: rgba(10, 10, 10, 0.8);
          border: 1px solid var(--glass-border);
          border-radius: 20px;
          padding: 40px;
          backdrop-filter: blur(20px);
          margin-top: 60px;
          box-shadow: 0 20px 40px rgba(0,0,0,0.4);
        }

        .km-header {
          text-align: center;
          margin-bottom: 30px;
        }

        .km-header h2 {
          font-size: 2rem;
          font-weight: 700;
          margin-bottom: 10px;
          background: linear-gradient(90deg, #44ff44, #00f2fe);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
        }

        .km-header p {
          color: var(--text-secondary);
        }

        .tabs {
          display: flex;
          gap: 10px;
          margin-bottom: 30px;
          background: rgba(255, 255, 255, 0.05);
          padding: 6px;
          border-radius: 12px;
        }

        .tabs button {
          flex: 1;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          padding: 12px;
          background: transparent;
          border: none;
          color: var(--text-secondary);
          font-weight: 600;
          border-radius: 8px;
          cursor: pointer;
          transition: all 0.2s;
        }

        .tabs button:hover {
          color: white;
        }

        .tabs button.active {
          background: rgba(255, 255, 255, 0.1);
          color: white;
          box-shadow: 0 4px 12px rgba(0,0,0,0.2);
        }

        .upload-area {
          display: flex;
          flex-direction: column;
          gap: 20px;
        }

        .file-drop-zone {
          border: 2px dashed rgba(255, 255, 255, 0.2);
          border-radius: 16px;
          padding: 60px 20px;
          text-align: center;
          cursor: pointer;
          transition: all 0.3s;
          background: rgba(255, 255, 255, 0.02);
        }

        .file-drop-zone:hover {
          border-color: #44ff44;
          background: rgba(68, 255, 68, 0.05);
        }

        .upload-icon {
          color: #44ff44;
          margin-bottom: 16px;
        }

        .text-input {
          width: 100%;
          padding: 16px;
          background: rgba(0, 0, 0, 0.5);
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 12px;
          color: white;
          font-size: 1rem;
          outline: none;
          transition: border-color 0.2s;
        }

        .text-input:focus {
          border-color: #44ff44;
        }

        .textarea {
          resize: vertical;
          min-height: 150px;
        }

        .btn-submit {
          width: 100%;
          padding: 16px;
          background: #44ff44;
          color: #000;
          border: none;
          border-radius: 12px;
          font-size: 1.1rem;
          font-weight: 700;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: all 0.2s;
        }

        .btn-submit:hover:not(:disabled) {
          transform: translateY(-2px);
          box-shadow: 0 0 20px rgba(68, 255, 68, 0.4);
        }

        .btn-submit:disabled {
          background: rgba(255, 255, 255, 0.1);
          color: rgba(255, 255, 255, 0.5);
          cursor: not-allowed;
        }

        .spin {
          animation: spin 1s linear infinite;
        }

        .status-message {
          padding: 12px 16px;
          border-radius: 8px;
          font-size: 0.95rem;
          display: flex;
          align-items: center;
          gap: 8px;
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

        @keyframes spin {
          100% { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
