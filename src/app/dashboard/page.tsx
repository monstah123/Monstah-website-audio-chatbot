"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { auth } from "@/lib/firebase-client";
import { onAuthStateChanged, signOut, User } from "firebase/auth";
import { OWNER_UID } from "@/lib/owner";
import KnowledgeManager from "@/components/KnowledgeManager";
import AgentSettings from "@/components/AgentSettings";
import WooCommerceReports from "@/components/WooCommerceReports";
import {
  LogOut,
  Copy,
  CheckCircle2,
  LayoutDashboard,
  Code,
  Home,
  Activity,
  Users,
  MessageCircle,
  Navigation,
  ShoppingCart,
} from "lucide-react";
import { motion } from "framer-motion";

type AnalyticsMetrics = {
  pageViews: number;
  uniqueSessions: number;
  chatsOpened: number;
  userMessages: number;
  assistantResponses: number;
  navigations: number;
  conversions: number;
  woocommercePurchases: number;
};

type PurchaseRecord = {
  orderId: string;
  websiteOrigin: string;
  purchasedAt: string | null;
};

type SiteAnalytics = {
  tenantId: string;
  siteId: string;
  websiteOrigin: string;
  metrics: AnalyticsMetrics;
};

const emptyAnalytics: AnalyticsMetrics = {
  pageViews: 0,
  uniqueSessions: 0,
  chatsOpened: 0,
  userMessages: 0,
  assistantResponses: 0,
  navigations: 0,
  conversions: 0,
  woocommercePurchases: 0,
};

export default function DashboardPage() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(Boolean(auth));
  const [copied, setCopied] = useState(false);
  const [analytics, setAnalytics] = useState<AnalyticsMetrics>(emptyAnalytics);
  const [recentPurchases, setRecentPurchases] = useState<PurchaseRecord[]>([]);
  const [sites, setSites] = useState<SiteAnalytics[]>([]);
  const [analyticsError, setAnalyticsError] = useState<string | null>(null);
  const router = useRouter();

  useEffect(() => {
    if (!auth) {
      console.warn("Firebase Auth not initialized. Missing API keys.");
      return;
    }
    
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      if (currentUser) {
        setUser(currentUser);
      } else {
        router.replace("/login");
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, [router]);

  useEffect(() => {
    if (!user || user.uid !== OWNER_UID) return;

    let cancelled = false;
    let timeout: ReturnType<typeof setTimeout>;
    const refreshAnalytics = async () => {
      try {
        const token = await user.getIdToken();
        const response = await fetch("/api/analytics", {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!response.ok) {
          throw new Error(`Analytics request failed (${response.status})`);
        }

        const data = await response.json();
        if (!cancelled) {
          setAnalytics(data.metrics);
          setRecentPurchases(data.recentPurchases ?? []);
          setSites(data.sites ?? []);
          setAnalyticsError(null);
        }
      } catch (error) {
        console.error("Failed to refresh dashboard analytics:", error);
        if (!cancelled) {
          setAnalyticsError("Analytics are temporarily unavailable. Retrying shortly.");
        }
      } finally {
        if (!cancelled) {
          timeout = setTimeout(refreshAnalytics, 15000);
        }
      }
    };

    void refreshAnalytics();
    return () => {
      cancelled = true;
      clearTimeout(timeout);
    };
  }, [user]);

  if (loading) {
    return <div className="loading-screen">Loading...</div>;
  }

  const handleSignOut = () => {
    signOut(auth);
  };

  const widgetScript = `<script src="https://monstah-website-audio-chatbot.vercel.app/widget.js?uid=${user?.uid}&tenantId=${user?.uid}"></script>`;
  const isOwner = user?.uid === OWNER_UID;

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
            <button onClick={() => router.push('/')} className="btn-home">
              <Home size={16} /> Home
            </button>
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

        {isOwner && (
        <section className="analytics-card glass" aria-labelledby="analytics-title">
          <div className="analytics-heading">
            <div>
              <h2 id="analytics-title"><Activity size={20} /> {isOwner ? "Owner analytics" : "Website analytics"}</h2>
              <p>{isOwner ? "All tracked client websites" : "Your tracked websites"} · today (UTC) · refreshes every 15 seconds</p>
            </div>
            <div className="tenant-id">
              <span>{isOwner ? "Owner account" : "Tenant tracking ID"}</span>
              <code>{user?.uid}</code>
            </div>
          </div>
          {isOwner && (
            <div className="coverage-summary">
              Reporting on <strong>{sites.length}</strong> website{sites.length === 1 ? "" : "s"} across{" "}
              <strong>{new Set(sites.map((site) => site.tenantId)).size}</strong> tenant account{new Set(sites.map((site) => site.tenantId)).size === 1 ? "" : "s"}.
            </div>
          )}
          {analyticsError && <p className="analytics-error" role="alert">{analyticsError}</p>}
          <div className="metrics-grid">
            <div className="metric-item"><Users size={18} /><span>Widget loads</span><strong>{analytics.pageViews}</strong></div>
            <div className="metric-item"><Users size={18} /><span>Unique sessions</span><strong>{analytics.uniqueSessions}</strong></div>
            <div className="metric-item"><MessageCircle size={18} /><span>Chats opened</span><strong>{analytics.chatsOpened}</strong></div>
            <div className="metric-item"><Activity size={18} /><span>User messages</span><strong>{analytics.userMessages}</strong></div>
            <div className="metric-item"><Navigation size={18} /><span>Chat navigations</span><strong>{analytics.navigations}</strong></div>
            <div className="metric-item"><ShoppingCart size={18} /><span>WooCommerce purchases</span><strong>{analytics.woocommercePurchases}</strong></div>
          </div>
          <p className="analytics-privacy">Chat message text is not logged. WooCommerce purchases count order confirmation pages after chatbot referrals; payment settlement and refunds are not verified.</p>
          <div className="purchases-section">
            <h3>{isOwner ? "Website metrics by tenant" : "Your website metrics"}</h3>
            {sites.length === 0 ? (
              <p className="purchases-empty">No tracked website activity yet.</p>
            ) : (
              <div className="purchases-table-wrap">
                <table className="purchases-table">
                  <thead>
                    <tr>
                      <th>Website</th>
                      {isOwner && <th>Tenant tracking ID</th>}
                      <th>Widget loads</th>
                      <th>Chats</th>
                      <th>Navigations</th>
                      <th>Purchases</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sites.map((site) => (
                      <tr key={`${site.tenantId}-${site.siteId}`}>
                        <td>{site.websiteOrigin || "Unknown site"}</td>
                        {isOwner && <td><code>{site.tenantId}</code></td>}
                        <td>{site.metrics.pageViews}</td>
                        <td>{site.metrics.chatsOpened}</td>
                        <td>{site.metrics.navigations}</td>
                        <td>{site.metrics.woocommercePurchases}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
          <div className="purchases-section">
            <h3>{isOwner ? "Recent chatbot-attributed orders across all websites" : "Your recent chatbot-attributed orders"}</h3>
            {recentPurchases.length === 0 ? (
              <p className="purchases-empty">No attributed WooCommerce orders yet.</p>
            ) : (
              <div className="purchases-table-wrap">
                <table className="purchases-table">
                  <thead>
                    <tr>
                      <th>Order</th>
                      <th>Website</th>
                      <th>Confirmation time</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recentPurchases.map((purchase) => (
                      <tr key={`${purchase.websiteOrigin}-${purchase.orderId}`}>
                        <td>#{purchase.orderId}</td>
                        <td>{purchase.websiteOrigin || "Unknown site"}</td>
                        <td>
                          {purchase.purchasedAt
                            ? new Date(purchase.purchasedAt).toLocaleString()
                            : "Time unavailable"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </section>
        )}

        <div className="dashboard-grid">
          {/* Left Column: Knowledge Manager */}
          <div className="grid-item">
            <KnowledgeManager />
          </div>

          {/* Right Column: Installation Snippet & Settings */}
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

            {/* AI Agent Settings Panel */}
            <AgentSettings />
          </div>
        </div>
        {user && <WooCommerceReports isOwner={isOwner} />}
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

        .btn-home {
          display: flex;
          align-items: center;
          gap: 8px;
          background: rgba(255, 255, 255, 0.06);
          color: white;
          border: 1px solid var(--glass-border);
          padding: 8px 16px;
          border-radius: 8px;
          cursor: pointer;
          font-weight: 600;
          transition: all 0.2s;
        }

        .btn-home:hover {
          background: rgba(255, 255, 255, 0.12);
          border-color: var(--primary);
          color: var(--primary);
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

        .analytics-card {
          padding: 24px;
          margin-bottom: 32px;
          border-radius: 20px;
        }

        .analytics-heading {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 20px;
          margin-bottom: 20px;
        }

        .analytics-heading h2 {
          display: flex;
          align-items: center;
          gap: 10px;
          margin: 0 0 6px;
          font-size: 1.25rem;
        }

        .analytics-heading p,
        .analytics-privacy {
          margin: 0;
          color: var(--text-secondary);
          font-size: 0.85rem;
        }

        .tenant-id {
          display: flex;
          flex-direction: column;
          align-items: flex-end;
          gap: 4px;
          color: var(--text-secondary);
          font-size: 0.75rem;
        }

        .tenant-id code {
          color: var(--primary);
          font-size: 0.8rem;
        }

        .metrics-grid {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 12px;
          margin-bottom: 16px;
        }

        .metric-item {
          display: grid;
          grid-template-columns: 22px 1fr auto;
          align-items: center;
          gap: 8px;
          padding: 14px;
          background: rgba(255, 255, 255, 0.04);
          border: 1px solid var(--glass-border);
          border-radius: 12px;
          color: var(--text-secondary);
          font-size: 0.85rem;
        }

        .metric-item svg {
          color: var(--primary);
        }

        .metric-item strong {
          color: white;
          font-size: 1.1rem;
        }

        .analytics-error {
          margin: 0 0 14px;
          color: #ff7777;
        }

        .coverage-summary {
          margin: 0 0 16px;
          color: var(--text-secondary);
          font-size: 0.9rem;
        }

        .coverage-summary strong {
          color: white;
        }

        .purchases-section {
          margin-top: 24px;
          padding-top: 20px;
          border-top: 1px solid var(--glass-border);
        }

        .purchases-section h3 {
          margin: 0 0 12px;
          font-size: 1rem;
        }

        .purchases-empty {
          margin: 0;
          color: var(--text-secondary);
          font-size: 0.9rem;
        }

        .purchases-table-wrap {
          overflow-x: auto;
        }

        .purchases-table {
          width: 100%;
          border-collapse: collapse;
          text-align: left;
          font-size: 0.85rem;
        }

        .purchases-table th,
        .purchases-table td {
          padding: 11px 10px;
          border-bottom: 1px solid var(--glass-border);
          white-space: nowrap;
        }

        .purchases-table th {
          color: var(--text-secondary);
          font-weight: 600;
        }

        .purchases-table td:first-child {
          color: var(--primary);
          font-weight: 700;
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

        @media (max-width: 700px) {
          .analytics-heading {
            flex-direction: column;
          }

          .tenant-id {
            align-items: flex-start;
          }

          .metrics-grid {
            grid-template-columns: 1fr 1fr;
          }
        }
      `}</style>
    </div>
  );
}
