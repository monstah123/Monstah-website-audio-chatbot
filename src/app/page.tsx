"use client";

import { motion } from "framer-motion";
import { Mic, Zap, Shield, MessageSquare } from "lucide-react";
import VoiceChat from "@/components/VoiceChat";
import KnowledgeManager from "@/components/KnowledgeManager";

export default function Home() {
  return (
    <main className="main-container">
      <section className="hero">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          className="hero-content"
        >
          <div className="badge">
            <Zap size={14} /> <span>AI-Powered Voice Experience</span>
          </div>
          <h1>Elevate Your Brand with <span className="gradient-text">Monstah Voice AI</span></h1>
          <p>
            The most advanced audio-enabled chatbot for premium WordPress websites. 
            Train on your products, documents, and web data in seconds.
          </p>
          
          <div className="cta-group">
            <button className="btn-primary" onClick={() => window.location.href = '/login'}>Train Your AI</button>
            <button className="btn-secondary">View Demo</button>
          </div>
        </motion.div>

        <div className="features-grid">
          <FeatureCard 
            icon={<Mic size={24} />} 
            title="Voice First" 
            desc="Ultra-low latency speech-to-text and hyper-realistic voices." 
          />
          <FeatureCard 
            icon={<MessageSquare size={24} />} 
            title="Document RAG" 
            desc="Upload PDFs, CSVs, and more to train your custom AI." 
          />
          <FeatureCard 
            icon={<Shield size={24} />} 
            title="Secure Sync" 
            desc="Instant updates via GitHub with enterprise-grade security." 
          />
        </div>
      </section>

      {/* Floating Chatbot Widget */}
      <VoiceChat />

      <style jsx>{`
        .main-container {
          min-height: 100vh;
          padding: 80px 20px;
          display: flex;
          flex-direction: column;
          align-items: center;
          background: radial-gradient(circle at top right, rgba(0, 242, 254, 0.05), transparent),
                      radial-gradient(circle at bottom left, rgba(255, 0, 128, 0.05), transparent);
        }

        .hero {
          max-width: 1200px;
          width: 100%;
          text-align: center;
        }

        .hero-content {
          margin-bottom: 80px;
        }

        .badge {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          padding: 6px 16px;
          background: rgba(0, 242, 254, 0.1);
          border: 1px solid rgba(0, 242, 254, 0.2);
          border-radius: 100px;
          color: var(--primary);
          font-size: 0.9rem;
          font-weight: 600;
          margin-bottom: 24px;
        }

        h1 {
          font-size: 4.5rem;
          font-weight: 800;
          line-height: 1.1;
          margin-bottom: 24px;
          letter-spacing: -0.02em;
        }

        .gradient-text {
          background: linear-gradient(90deg, var(--primary), var(--secondary));
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
        }

        p {
          font-size: 1.25rem;
          color: var(--text-secondary);
          max-width: 600px;
          margin: 0 auto 40px;
          line-height: 1.6;
        }

        .cta-group {
          display: flex;
          gap: 16px;
          justify-content: center;
        }

        .btn-primary {
          padding: 14px 32px;
          background: var(--primary);
          color: var(--bg-dark);
          border: none;
          border-radius: 12px;
          font-weight: 600;
          font-size: 1rem;
          cursor: pointer;
          transition: transform 0.2s, box-shadow 0.2s;
        }

        .btn-primary:hover {
          transform: translateY(-2px);
          box-shadow: var(--glow-shadow);
        }

        .btn-secondary {
          padding: 14px 32px;
          background: rgba(255, 255, 255, 0.05);
          color: white;
          border: 1px solid var(--glass-border);
          border-radius: 12px;
          font-weight: 600;
          font-size: 1rem;
          cursor: pointer;
          transition: background 0.2s;
        }

        .btn-secondary:hover {
          background: rgba(255, 255, 255, 0.1);
        }

        .features-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
          gap: 24px;
          width: 100%;
        }

        @media (max-width: 768px) {
          h1 { font-size: 3rem; }
        }
      `}</style>
    </main>
  );
}

function FeatureCard({ icon, title, desc }: { icon: React.ReactNode, title: string, desc: string }) {
  return (
    <div className="feature-card glass">
      <div className="icon-wrapper">{icon}</div>
      <h3>{title}</h3>
      <p>{desc}</p>
      <style jsx>{`
        .feature-card {
          padding: 40px;
          text-align: left;
          transition: border-color 0.3s;
        }

        .feature-card:hover {
          border-color: var(--primary);
        }

        .icon-wrapper {
          color: var(--primary);
          margin-bottom: 20px;
        }

        h3 {
          font-size: 1.5rem;
          font-weight: 600;
          margin-bottom: 12px;
        }

        p {
          font-size: 1rem;
          color: var(--text-secondary);
          margin: 0;
          line-height: 1.5;
        }
      `}</style>
    </div>
  );
}
