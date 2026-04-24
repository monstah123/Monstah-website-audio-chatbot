"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { auth } from "@/lib/firebase-client";
import { onAuthStateChanged, signOut, User } from "firebase/auth";
import KnowledgeManager from "@/components/KnowledgeManager";
import { LogOut, Copy, CheckCircle2, LayoutDashboard, Code } from "lucide-react";
import { motion } from "framer-motion";

export default function DashboardPage() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const router = useRouter();

  useEffect(() => {
    if (!auth) {
      console.warn("Firebase Auth not initialized. Missing API keys.");
      setLoading(false);
      return;
    }
    
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      if (currentUser) {
        setUser(currentUser);
      } else {
        router.push("/login");
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, [router]);

  if (loading) {
    return <div className="loading-screen">Loading...</div>;
  }

  const handleSignOut = () => {
    signOut(auth);
  };

  const widgetScript = `<script src="https://monstah-website-audio-chatbot.vercel.app/widget.js?uid=${user?.uid}"></script>`;

  const copyToClipboard = () => {
    navigator.clipboard.writeText(widgetScript);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="dashboard-container">
      <nav className="dash-nav glass">
        <div className="nav-brand">
          <LayoutDashboard size={20} />
          <span>Monstah AI Dashboard</span>
        </div>
        <div className="nav-user">
          <span className="user-email">{user?.email}</span>
          <button onClick={handleSignOut} className="btn-logout">
            <LogOut size={16} /> Sign Out
          </button>
        </div>
      </nav>

      <main className="dash-main">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="welcome-section"
        >
          <h1>Welcome to your AI Command Center</h1>
          <p>Train your AI and grab your custom installation snippet below.</p>
        </motion.div>

        <div className="dashboard-grid">
          {/* Left Column: Knowledge Manager */}
          <div className="grid-item">
            <KnowledgeManager />
          </div>

          {/* Right Column: Installation Snippet */}
          <div className="grid-item">
            <div className="snippet-card glass">
              <div className="snippet-header">
                <Code size={20} color="var(--primary)" />
                <h2>Your Custom Widget Script</h2>
              </div>
              <p>Copy and paste this script into the <code>&lt;head&gt;</code> or <code>&lt;footer&gt;</code> of your WordPress or Shopify site. This unique snippet ensures the chatbot only uses <strong>your</strong> uploaded knowledge.</p>
              
              <div className="code-block">
                <code>{widgetScript}</code>
                <button onClick={copyToClipboard} className="btn-copy" title="Copy to clipboard">
                  {copied ? <CheckCircle2 size={18} color="#44ff44" /> : <Copy size={18} />}
                </button>
              </div>
            </div>
          </div>
        </div>
      </main>

      <style jsx>{`
        .dashboard-container {
          min-height: 100vh;
          background: #000;
          color: white;
        }

        .loading-screen {
          height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 1.2rem;
          color: var(--primary);
        }

        .dash-nav {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 16px 32px;
          border-bottom: 1px solid var(--glass-border);
          position: sticky;
          top: 0;
          z-index: 100;
        }

        .nav-brand {
          display: flex;
          align-items: center;
          gap: 12px;
          font-weight: 700;
          font-size: 1.2rem;
          color: white;
        }

        .nav-user {
          display: flex;
          align-items: center;
          gap: 20px;
        }

        .user-email {
          color: var(--text-secondary);
          font-size: 0.9rem;
        }

        .btn-logout {
          display: flex;
          align-items: center;
          gap: 8px;
          background: rgba(255, 68, 68, 0.1);
          color: #ff4444;
          border: 1px solid rgba(255, 68, 68, 0.2);
          padding: 8px 16px;
          border-radius: 8px;
          cursor: pointer;
          font-weight: 600;
          transition: all 0.2s;
        }

        .btn-logout:hover {
          background: rgba(255, 68, 68, 0.2);
        }

        .dash-main {
          max-width: 1400px;
          margin: 0 auto;
          padding: 40px 32px;
        }

        .welcome-section {
          margin-bottom: 40px;
        }

        .welcome-section h1 {
          font-size: 2.5rem;
          font-weight: 800;
          margin-bottom: 8px;
        }

        .welcome-section p {
          color: var(--text-secondary);
          font-size: 1.1rem;
        }

        .dashboard-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 32px;
          align-items: start;
        }

        .snippet-card {
          padding: 32px;
          border-radius: 20px;
          margin-top: 60px; /* Align roughly with the Knowledge Manager title */
        }

        .snippet-header {
          display: flex;
          align-items: center;
          gap: 12px;
          margin-bottom: 16px;
        }

        .snippet-header h2 {
          font-size: 1.5rem;
          font-weight: 700;
          margin: 0;
        }

        .snippet-card p {
          color: var(--text-secondary);
          margin-bottom: 24px;
          line-height: 1.6;
        }

        .code-block {
          background: rgba(0, 0, 0, 0.8);
          border: 1px solid rgba(255, 255, 255, 0.1);
          padding: 16px;
          border-radius: 12px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 16px;
        }

        code {
          font-family: monospace;
          color: #44ff44;
          word-break: break-all;
          font-size: 0.9rem;
        }

        .btn-copy {
          background: rgba(255, 255, 255, 0.1);
          border: none;
          padding: 8px;
          border-radius: 8px;
          color: white;
          cursor: pointer;
          transition: background 0.2s;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .btn-copy:hover {
          background: rgba(255, 255, 255, 0.2);
        }

        @media (max-width: 1024px) {
          .dashboard-grid {
            grid-template-columns: 1fr;
          }
          
          .snippet-card {
            margin-top: 0;
          }
        }
      `}</style>
    </div>
  );
}
