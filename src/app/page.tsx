"use client";

import { useRef } from "react";
import { motion } from "framer-motion";
import { Mic, Zap, Shield, MessageSquare, Globe, Brain, Layers, ArrowRight, CheckCircle } from "lucide-react";
import VoiceChat from "@/components/VoiceChat";

// Singleton AudioContext — browsers limit simultaneous contexts
let _hoverCtx: AudioContext | null = null;
function playHoverSound() {
  if (typeof window === "undefined") return;
  try {
    if (!_hoverCtx) {
      _hoverCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    const ctx = _hoverCtx;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = "sine";
    // Descending pitch: 1100 Hz → 680 Hz over 55 ms — subtle digital "swish"
    osc.frequency.setValueAtTime(1100, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(680, ctx.currentTime + 0.055);
    gain.gain.setValueAtTime(0.05, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.055);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.055);
  } catch { /* silently ignore if audio not available */ }
}

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
            The most advanced audio-enabled AI chatbot for any website — WordPress, Shopify, or custom.
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

        {/* Stats row — inline styles guarantee horizontal layout */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4, duration: 0.7 }}
          style={{
            display: 'flex',
            flexDirection: 'row',
            flexWrap: 'nowrap',
            width: '100%',
            marginBottom: '64px',
            background: 'rgba(255,255,255,0.03)',
            border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: '20px',
            overflow: 'hidden',
          }}
        >
          {[
            { value: "< 1s", label: "Response Time" },
            { value: "100%", label: "Data Isolation" },
            { value: "∞", label: "Knowledge Docs" },
          ].map((s, i, arr) => (
            <div
              key={s.label}
              style={{
                flex: 1,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '28px 12px',
                borderRight: i < arr.length - 1 ? '1px solid rgba(255,255,255,0.08)' : 'none',
              }}
            >
              <span className="stat-value gradient-text">{s.value}</span>
              <span className="stat-label">{s.label}</span>
            </div>
          ))}
        </motion.div>

        {/* Feature cards */}
        <div className="features-grid">
          {[
            { icon: <Mic size={24} />, title: "Voice First", desc: "Low-latency STT + realistic TTS. Works on desktop, mobile Safari, and Facebook Messenger. Your customers talk, the AI responds instantly." },
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
              whileHover={{ y: -10, scale: 1.02 }}
              transition={{ delay: i * 0.15, duration: 0.6 }}
              viewport={{ once: true }}
              onMouseEnter={playHoverSound}
            >
              {/* Big ghost number watermark */}
              <span className="step-watermark">{step.num}</span>

              {/* Glowing icon pill */}
              <div className="step-icon-wrap">{step.icon}</div>

              <div className="step-num">{step.num}</div>
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
            "Customizable Voice Clarity Controls",
            "Intelligent Speech Debouncer Engine",
            "Page navigation URL integration",
            "White-label brand name (Pro unlock)",
            "DeepSeek AI — near-zero cost per query",
            "OpenAI TTS — premium AI voice",
            "Embed on Any Site — WordPress, Shopify & more",
            "Fully managed cloud hosting included",
            "Mobile & iOS Safari voice support",
            "Facebook Messenger compatible",
          ].map((perk) => (
            <div className="perk-item" key={perk} onMouseEnter={playHoverSound}>
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
      <VoiceChat uid="monstah-landing-page" />

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
          flex-direction: row;
          flex-wrap: nowrap;
          gap: 0;
          justify-content: center;
          align-items: stretch;
          margin-bottom: 64px;
          background: rgba(255,255,255,0.03);
          border: 1px solid var(--glass-border);
          border-radius: 20px;
          overflow: hidden;
        }

        .stat-item {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 4px;
          flex: 1;
          padding: 28px 16px;
          border-right: 1px solid var(--glass-border);
        }

        .stat-item:last-child {
          border-right: none;
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
          overflow: hidden;
          transition: border-color 0.35s, box-shadow 0.35s, background 0.35s;
          cursor: default;
        }

        .step-card:hover {
          border-color: rgba(0, 242, 254, 0.6) !important;
          box-shadow: 0 0 40px rgba(0, 242, 254, 0.12), 0 24px 48px rgba(0,0,0,0.5) !important;
          background: linear-gradient(135deg, rgba(0, 242, 254, 0.04), rgba(0, 0, 0, 0)) !important;
        }

        /* Ghost watermark — large translucent step number */
        .step-watermark {
          position: absolute;
          bottom: -12px;
          right: 20px;
          font-size: 7.5rem;
          font-weight: 900;
          line-height: 1;
          letter-spacing: -0.05em;
          color: rgba(0, 242, 254, 0.05);
          pointer-events: none;
          user-select: none;
          transition: color 0.35s;
        }

        .step-card:hover .step-watermark {
          color: rgba(0, 242, 254, 0.10);
        }

        /* Glowing icon container */
        .step-icon-wrap {
          width: 58px;
          height: 58px;
          background: linear-gradient(135deg, rgba(0,242,254,0.12), rgba(0,242,254,0.04));
          border: 1px solid rgba(0,242,254,0.2);
          border-radius: 16px;
          display: flex;
          align-items: center;
          justify-content: center;
          color: var(--primary);
          margin-bottom: 24px;
          transition: background 0.35s, box-shadow 0.35s, border-color 0.35s;
        }

        .step-card:hover .step-icon-wrap {
          background: linear-gradient(135deg, rgba(0,242,254,0.22), rgba(0,242,254,0.08));
          box-shadow: 0 0 24px rgba(0, 242, 254, 0.35);
          border-color: rgba(0,242,254,0.55);
        }

        .step-num {
          display: inline-flex;
          align-items: center;
          padding: 3px 10px;
          background: rgba(0,242,254,0.07);
          border: 1px solid rgba(0,242,254,0.18);
          border-radius: 100px;
          font-size: 0.68rem;
          font-weight: 800;
          color: var(--primary);
          letter-spacing: 0.12em;
          text-transform: uppercase;
          margin-bottom: 16px;
        }

        .step-card h3 {
          font-size: 1.45rem;
          font-weight: 800;
          margin-bottom: 12px;
          color: white;
          letter-spacing: -0.01em;
        }

        .step-card p {
          font-size: 0.95rem;
          color: var(--text-secondary);
          margin: 0;
          line-height: 1.65;
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
          .main-container {
            padding: 60px 16px 100px;
          }

          h1 {
            font-size: 2.4rem;
            letter-spacing: -0.01em;
          }

          p {
            font-size: 1rem;
            margin-bottom: 28px;
          }

          .hero {
            margin-bottom: 80px;
          }

          .hero-content {
            margin-bottom: 36px;
          }

          .cta-group {
            flex-direction: column;
            align-items: center;
          }

          .btn-primary, .btn-secondary {
            width: 100%;
            max-width: 320px;
            justify-content: center;
          }

          .stat-value {
            font-size: 1.8rem !important;
          }

          .stat-label {
            font-size: 0.7rem !important;
          }

          .features-grid {
            grid-template-columns: 1fr;
          }

          .how-section, .perks-section, .final-cta {
            margin-bottom: 80px;
          }

          .section-title {
            font-size: 2rem;
          }

          .section-subtitle {
            font-size: 0.95rem;
            margin-bottom: 36px;
          }

          .steps-grid {
            grid-template-columns: 1fr;
          }

          .step-card {
            padding: 28px 24px;
          }

          .perks-grid {
            grid-template-columns: 1fr;
          }

          .cta-card {
            padding: 40px 24px;
          }

          .cta-card h2 {
            font-size: 2rem;
          }

          .btn-large {
            width: 100%;
            max-width: 320px;
            justify-content: center;
          }
        }
      `}</style>
    </main>
  );
}

function FeatureCard({ icon, title, desc }: { icon: React.ReactNode, title: string, desc: string }) {
  return (
    <div className="feature-card glass" onMouseEnter={playHoverSound}>
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
