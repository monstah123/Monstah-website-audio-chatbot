"use client";

import { useRef } from "react";
import { motion } from "framer-motion";
import { Mic, Zap, Shield, MessageSquare, Globe, Brain, Layers, ArrowRight, CheckCircle } from "lucide-react";
import VoiceChat from "@/components/VoiceChat";

export default function Home() {
  const demoRef = useRef<HTMLDivElement>(null);

  const scrollToDemo = () => {
    demoRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  return (
    <main className="main-container">

      {/* ===== HERO ===== */}
      <section className="hero">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: "easeOut" }}
          className="hero-content"
        >
          <div className="badge">
            <Zap size={14} /> <span>AI-Powered Voice Experience</span>
          </div>
          <h1>Give Your Website a <span className="gradient-text">Voice That Sells</span></h1>
          <p>
            The most advanced audio-enabled AI chatbot for WordPress &amp; Shopify. 
            Train on your products, documents, and web data in seconds. 
            Deploy with a single script tag.
          </p>

          <div className="cta-group">
            <button className="btn-primary" onClick={() => window.location.href = '/login'}>
              Start Free <ArrowRight size={16} />
            </button>
            <button className="btn-secondary" onClick={scrollToDemo}>
              See How It Works
            </button>
          </div>
        </motion.div>

        {/* Stats row */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4, duration: 0.7 }}
          className="stats-row"
        >
          {[
            { value: "< 1s", label: "Response Time" },
            { value: "100%", label: "Data Isolation" },
            { value: "∞", label: "Knowledge Docs" },
            { value: "$0", label: "Monthly Fee" },
          ].map((s) => (
            <div className="stat-item" key={s.label}>
              <span className="stat-value gradient-text">{s.value}</span>
              <span className="stat-label">{s.label}</span>
            </div>
          ))}
        </motion.div>

        {/* Feature cards */}
        <div className="features-grid">
          {[
            { icon: <Mic size={24} />, title: "Voice First", desc: "Low-latency STT + realistic TTS. Your customers talk, the AI listens and responds instantly." },
            { icon: <Brain size={24} />, title: "RAG Pipeline", desc: "Upload PDFs, CSVs, or paste a URL. The AI reads it all and answers with precision." },
            { icon: <Shield size={24} />, title: "Multi-Tenant Secure", desc: "Every user gets their own isolated knowledge vault. Zero data leakage across accounts." },
          ].map((f) => (
            <FeatureCard key={f.title} icon={f.icon} title={f.title} desc={f.desc} />
          ))}
        </div>
      </section>

      {/* ===== HOW IT WORKS ===== */}
      <section className="how-section" ref={demoRef}>
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7 }}
          viewport={{ once: true }}
        >
          <h2 className="section-title">Up and Running in <span className="gradient-text">3 Steps</span></h2>
          <p className="section-subtitle">No engineers required. Built for business owners.</p>
        </motion.div>

        <div className="steps-grid">
          {[
            { num: "01", icon: <Globe size={28} />, title: "Train Your AI", desc: "Paste your website URL or upload documents. The AI reads, learns, and memorizes your business." },
            { num: "02", icon: <Layers size={28} />, title: "Customize Your Agent", desc: "Name your AI, set its personality, choose a theme color, and write its opening message." },
            { num: "03", icon: <Zap size={28} />, title: "Embed on Your Site", desc: "Copy one script tag. Paste it into WordPress, Shopify, or any site. Done." },
          ].map((step, i) => (
            <motion.div
              key={step.num}
              className="step-card glass"
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.15, duration: 0.6 }}
              viewport={{ once: true }}
            >
              <div className="step-num">{step.num}</div>
              <div className="step-icon">{step.icon}</div>
              <h3>{step.title}</h3>
              <p>{step.desc}</p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* ===== WHAT YOU GET ===== */}
      <section className="perks-section">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7 }}
          viewport={{ once: true }}
        >
          <h2 className="section-title">Everything You Need. <span className="gradient-text">Nothing You Don&apos;t.</span></h2>
        </motion.div>

        <div className="perks-grid">
          {[
            "Multi-tenant dashboard with Google login",
            "Custom Agent Name & Brand Identity",
            "7 premium widget color themes",
            "Configurable idle mic timeout",
            "Page navigation integration",
            "White-label brand name (Pro unlock)",
            "AWS S3 document storage",
            "Firebase vector knowledge base",
            "DeepSeek AI — near-zero cost per query",
            "OpenAI TTS — premium AI voice",
            "Embeddable WordPress/Shopify widget",
            "Auto-update via GitHub + Vercel",
          ].map((perk) => (
            <div className="perk-item" key={perk}>
              <CheckCircle size={16} color="#44ff44" />
              <span>{perk}</span>
            </div>
          ))}
        </div>
      </section>

      {/* ===== FINAL CTA ===== */}
      <section className="final-cta">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          whileInView={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.7 }}
          viewport={{ once: true }}
          className="cta-card glass"
        >
          <div className="badge"><MessageSquare size={14} /><span>Ready to Launch?</span></div>
          <h2>Deploy Your AI Agent <span className="gradient-text">Today</span></h2>
          <p>No monthly subscription. No per-seat fees. Just your AI, your brand, your data.</p>
          <button className="btn-primary btn-large" onClick={() => window.location.href = '/login'}>
            Get Started Free <ArrowRight size={18} />
          </button>
        </motion.div>
      </section>

      {/* Floating Chatbot Widget */}
      <VoiceChat />

      <style jsx>{`
        .main-container {
          min-height: 100vh;
          padding: 80px 20px 120px;
          display: flex;
          flex-direction: column;
          align-items: center;
          background: radial-gradient(circle at top right, rgba(0, 242, 254, 0.05), transparent),
                      radial-gradient(circle at bottom left, rgba(255, 0, 128, 0.05), transparent);
        }

        /* ===== HERO ===== */
        .hero {
          max-width: 1200px;
          width: 100%;
          text-align: center;
          margin-bottom: 120px;
        }

        .hero-content {
          margin-bottom: 60px;
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
          margin-bottom: 28px;
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
          font-size: 1.2rem;
          color: var(--text-secondary);
          max-width: 620px;
          margin: 0 auto 40px;
          line-height: 1.7;
        }

        .cta-group {
          display: flex;
          gap: 16px;
          justify-content: center;
          flex-wrap: wrap;
        }

        .btn-primary {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          padding: 14px 32px;
          background: var(--primary);
          color: var(--bg-dark);
          border: none;
          border-radius: 12px;
          font-weight: 700;
          font-size: 1rem;
          cursor: pointer;
          transition: transform 0.2s, box-shadow 0.2s;
        }

        .btn-primary:hover {
          transform: translateY(-2px);
          box-shadow: var(--glow-shadow);
        }

        .btn-large {
          padding: 18px 48px;
          font-size: 1.1rem;
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

        /* ===== STATS ===== */
        .stats-row {
          display: flex;
          gap: 48px;
          justify-content: center;
          flex-wrap: wrap;
          margin-bottom: 64px;
          padding: 32px;
          background: rgba(255,255,255,0.03);
          border: 1px solid var(--glass-border);
          border-radius: 20px;
        }

        .stat-item {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 4px;
        }

        .stat-value {
          font-size: 2.5rem;
          font-weight: 800;
          letter-spacing: -0.02em;
        }

        .stat-label {
          font-size: 0.85rem;
          color: var(--text-secondary);
          text-transform: uppercase;
          letter-spacing: 0.08em;
          font-weight: 600;
        }

        /* ===== FEATURE CARDS ===== */
        .features-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
          gap: 24px;
          width: 100%;
        }

        /* ===== HOW IT WORKS ===== */
        .how-section {
          max-width: 1200px;
          width: 100%;
          text-align: center;
          margin-bottom: 120px;
        }

        .section-title {
          font-size: 3rem;
          font-weight: 800;
          margin-bottom: 12px;
          letter-spacing: -0.02em;
        }

        .section-subtitle {
          color: var(--text-secondary);
          font-size: 1.1rem;
          margin-bottom: 56px;
        }

        .steps-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
          gap: 24px;
        }

        .step-card {
          padding: 40px 32px;
          text-align: left;
          position: relative;
          transition: border-color 0.3s, transform 0.3s;
        }

        .step-card:hover {
          border-color: var(--primary);
          transform: translateY(-4px);
        }

        .step-num {
          font-size: 0.75rem;
          font-weight: 800;
          color: var(--primary);
          letter-spacing: 0.1em;
          text-transform: uppercase;
          margin-bottom: 16px;
        }

        .step-icon {
          color: var(--primary);
          margin-bottom: 20px;
        }

        .step-card h3 {
          font-size: 1.4rem;
          font-weight: 700;
          margin-bottom: 12px;
          color: white;
        }

        .step-card p {
          font-size: 0.95rem;
          color: var(--text-secondary);
          margin: 0;
          line-height: 1.6;
        }

        /* ===== PERKS ===== */
        .perks-section {
          max-width: 1200px;
          width: 100%;
          text-align: center;
          margin-bottom: 120px;
        }

        .perks-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
          gap: 16px;
          text-align: left;
          margin-top: 48px;
        }

        .perk-item {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 16px 20px;
          background: rgba(255,255,255,0.03);
          border: 1px solid var(--glass-border);
          border-radius: 12px;
          font-size: 0.95rem;
          color: white;
          transition: border-color 0.2s, background 0.2s;
        }

        .perk-item:hover {
          border-color: rgba(68,255,68,0.3);
          background: rgba(68,255,68,0.03);
        }

        /* ===== FINAL CTA ===== */
        .final-cta {
          max-width: 800px;
          width: 100%;
        }

        .cta-card {
          padding: 64px;
          text-align: center;
          border-radius: 28px;
        }

        .cta-card h2 {
          font-size: 3rem;
          font-weight: 800;
          margin-bottom: 16px;
          letter-spacing: -0.02em;
        }

        .cta-card p {
          font-size: 1.1rem;
          color: var(--text-secondary);
          margin-bottom: 40px;
        }

        @media (max-width: 768px) {
          h1 { font-size: 2.8rem; }
          .section-title { font-size: 2.2rem; }
          .cta-card { padding: 40px 24px; }
          .cta-card h2 { font-size: 2rem; }
          .stats-row { gap: 24px; padding: 20px; }
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
          transition: border-color 0.3s, transform 0.3s;
        }

        .feature-card:hover {
          border-color: var(--primary);
          transform: translateY(-4px);
        }

        .icon-wrapper {
          color: var(--primary);
          margin-bottom: 20px;
        }

        h3 {
          font-size: 1.4rem;
          font-weight: 700;
          margin-bottom: 12px;
          color: white;
        }

        p {
          font-size: 0.95rem;
          color: var(--text-secondary);
          margin: 0;
          line-height: 1.6;
        }
      `}</style>
    </div>
  );
}
