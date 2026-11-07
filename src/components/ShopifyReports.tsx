"use client";

import { useCallback, useEffect, useState } from "react";
import { auth } from "@/lib/firebase-client";
import { RefreshCw, Store } from "lucide-react";

type ShopifyOrder = {
  orderId: string;
  orderNumber: string;
  status: string;
  orderCategory: string;
  total: string;
  refundedTotal: string;
  currency: string;
  createdAt: string | null;
  updatedAt: string | null;
  tenantId?: string;
};

type ShopifyStats = {
  paidOrders: number;
  otherStatusOrders: number;
  refundedOrders: number;
  netSalesByCurrency: Record<string, number>;
};

type ShopifyReportData = {
  appReady: boolean;
  connected: boolean;
  shop: string | null;
  webhookStatus: string | null;
  stats: ShopifyStats;
  tenants?: Array<{
    tenantId: string;
    connected: boolean;
    shop: string | null;
    webhookStatus: string | null;
    stats: ShopifyStats;
  }>;
  orders: ShopifyOrder[];
};

const emptyStats: ShopifyStats = {
  paidOrders: 0,
  otherStatusOrders: 0,
  refundedOrders: 0,
  netSalesByCurrency: {},
};

const emptyReport: ShopifyReportData = {
  appReady: false,
  connected: false,
  shop: null,
  webhookStatus: null,
  stats: emptyStats,
  orders: [],
};

function amount(value: string | number, currency: string) {
  return `${currency} ${Number(value).toFixed(2)}`;
}

export default function ShopifyReports({ isOwner }: { isOwner: boolean }) {
  const [report, setReport] = useState(emptyReport);
  const [shopDomain, setShopDomain] = useState("");
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const user = auth.currentUser;
    if (!user) return;
    try {
      const token = await user.getIdToken();
      const response = await fetch("/api/shopify/report", {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Unable to load Shopify report.");
      setReport({ ...emptyReport, ...data });
      setError(null);
    } catch (loadError) {
      console.error("Failed to load Shopify report:", loadError);
      setError("Shopify report is temporarily unavailable.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const initialRefresh = setTimeout(() => void refresh(), 0);
    const interval = setInterval(() => void refresh(), 15000);
    const result = new URLSearchParams(window.location.search).get("shopify");
    const message = result === "connected"
      ? "Shopify store connected. Order webhooks are active."
      : result === "webhook_error"
        ? "Store connected, but webhook setup needs attention. Use Retry webhook setup below."
        : result && result !== "error"
          ? `Shopify connection needs attention (${result.replace(/_/g, " ")}).`
          : null;
    const noticeTimeout = message ? setTimeout(() => setNotice(message), 0) : undefined;
    return () => {
      clearTimeout(initialRefresh);
      clearInterval(interval);
      if (noticeTimeout) clearTimeout(noticeTimeout);
    };
  }, [refresh]);

  const connectStore = async () => {
    const user = auth.currentUser;
    if (!user) {
      setError("Sign in again before connecting Shopify.");
      return;
    }
    setWorking(true);
    setError(null);
    try {
      const token = await user.getIdToken();
      const response = await fetch("/api/shopify/connect", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ shop: shopDomain }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Unable to start Shopify connection.");
      window.location.assign(data.authorizationUrl);
    } catch (connectError) {
      console.error("Shopify connection could not be started:", connectError);
      setError(connectError instanceof Error ? connectError.message : "Unable to connect Shopify.");
      setWorking(false);
    }
  };

  const retryWebhooks = async () => {
    const user = auth.currentUser;
    if (!user) return;
    setWorking(true);
    try {
      const token = await user.getIdToken();
      const response = await fetch("/api/shopify/report", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ action: "retry-webhooks" }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Could not set up Shopify webhooks.");
      setNotice("Shopify order webhooks are active.");
      await refresh();
    } catch (setupError) {
      console.error("Shopify webhook setup retry failed:", setupError);
      setError(setupError instanceof Error ? setupError.message : "Could not set up Shopify webhooks.");
    } finally {
      setWorking(false);
    }
  };

  return (
    <section className="shopify-card glass" aria-labelledby="shopify-title">
      <div className="heading">
        <div>
          <h2 id="shopify-title"><Store size={20} /> Shopify order report</h2>
          <p>Order status and totals from each connected Shopify store. Orders are not attributed to the chatbot.</p>
        </div>
        <button type="button" className="refresh" onClick={() => void refresh()} aria-label="Refresh Shopify report">
          <RefreshCw size={16} />
        </button>
      </div>

      {notice && <p className="notice" role="status">{notice}</p>}
      {error && <p className="error" role="alert">{error}</p>}

      {!report.appReady ? (
        <div className="setup">
          <strong>Shopify connection is ready to enable.</strong>
          <p>
            No Shopify store is needed for development. To let clients connect, the app owner must register the Shopify app
            and add <code>SHOPIFY_API_KEY</code>, <code>SHOPIFY_API_SECRET</code>, and <code>SHOPIFY_APP_URL</code> to Vercel.
          </p>
        </div>
      ) : !report.connected ? (
        <div className="setup">
          <label htmlFor="shopify-domain">Client store domain</label>
          <div className="connect-row">
            <input
              id="shopify-domain"
              value={shopDomain}
              onChange={(event) => setShopDomain(event.target.value)}
              placeholder="store-name.myshopify.com"
              autoComplete="url"
            />
            <button type="button" onClick={() => void connectStore()} disabled={working || !shopDomain.trim()}>
              {working ? "Connecting..." : "Connect Shopify"}
            </button>
          </div>
          <p>Each client authorizes access to their own store. The app registers order webhooks after approval. Reporting starts when connected; historical orders aren’t imported.</p>
        </div>
      ) : (
        <div className="connection">
          <div><span>Connected store</span><strong>{report.shop}</strong></div>
          <div><span>Webhook status</span><strong>{report.webhookStatus ?? "Setting up"}</strong></div>
          {report.webhookStatus !== "active" && (
            <button type="button" onClick={() => void retryWebhooks()} disabled={working}>
              {working ? "Setting up..." : "Retry webhook setup"}
            </button>
          )}
        </div>
      )}

      {report.connected && (
        <>
          <div className="metrics">
            <div><span>Paid / partially refunded</span><strong>{report.stats.paidOrders}</strong></div>
            <div><span>Other statuses</span><strong>{report.stats.otherStatusOrders}</strong></div>
            <div><span>Refunded orders</span><strong>{report.stats.refundedOrders}</strong></div>
            <div><span>Net sales</span><strong>
              {Object.entries(report.stats.netSalesByCurrency).map(([currency, value]) => amount(value, currency)).join(" · ") || "—"}
            </strong></div>
          </div>

          {isOwner && report.tenants && (
            <div className="tenant-list">
              <h3>Connected Shopify stores by tenant</h3>
              {report.tenants.filter((tenant) => tenant.connected).map((tenant) => (
                <div className="tenant" key={tenant.tenantId}>
                  <code>{tenant.tenantId}</code>
                  <span>{tenant.shop}</span>
                  <span>{tenant.stats.paidOrders} paid · {tenant.stats.refundedOrders} refunded</span>
                </div>
              ))}
            </div>
          )}

          <div className="orders">
            <h3>{isOwner ? "Latest orders across connected Shopify stores" : "Latest orders for your Shopify store"}</h3>
            {loading ? <p className="muted">Loading orders...</p> : report.orders.length === 0 ? (
              <p className="muted">No Shopify orders received yet.</p>
            ) : (
              <div className="table-wrap">
                <table>
                  <thead><tr>
                    <th>Order</th>
                    {isOwner && <th>Tenant</th>}
                    <th>Status</th><th>Total</th><th>Refunded</th><th>Updated</th>
                  </tr></thead>
                  <tbody>{report.orders.map((order) => (
                    <tr key={`${order.tenantId ?? "self"}-${order.orderId}`}>
                      <td>#{order.orderNumber}</td>
                      {isOwner && <td><code>{order.tenantId}</code></td>}
                      <td>{order.status.replace(/_/g, " ")}</td>
                      <td>{amount(order.total, order.currency)}</td>
                      <td>{amount(order.refundedTotal, order.currency)}</td>
                      <td>{order.updatedAt ? new Date(order.updatedAt).toLocaleString() : "—"}</td>
                    </tr>
                  ))}</tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}

      <style jsx>{`
        .shopify-card { padding: 24px; margin-top: 24px; border-radius: 20px; }
        .heading { display: flex; justify-content: space-between; gap: 16px; }
        .heading h2 { display: flex; align-items: center; gap: 10px; margin: 0 0 6px; font-size: 1.25rem; }
        .heading p, .setup p, .muted { color: var(--text-secondary); font-size: .88rem; }
        .heading p { margin: 0; }
        .refresh, .connect-row button, .connection button {
          border: 1px solid var(--glass-border); border-radius: 8px; padding: 9px 12px;
          background: rgba(255,255,255,.07); color: white; cursor: pointer;
        }
        .setup { margin-top: 20px; padding: 18px; border: 1px solid var(--glass-border); border-radius: 12px; }
        .setup p { margin-bottom: 0; line-height: 1.6; }
        .setup code, .tenant code, td code { color: var(--primary); overflow-wrap: anywhere; }
        .setup label { display: block; margin-bottom: 8px; font-size: .88rem; }
        .connect-row { display: flex; gap: 10px; }
        .connect-row input {
          flex: 1; min-width: 0; border: 1px solid var(--glass-border); border-radius: 8px;
          background: rgba(0,0,0,.35); color: white; padding: 10px;
        }
        .connect-row button:disabled, button:disabled { opacity: .6; cursor: wait; }
        .connection { display: flex; flex-wrap: wrap; align-items: center; gap: 20px; margin-top: 18px; }
        .connection div { display: grid; gap: 4px; }
        .connection span { color: var(--text-secondary); font-size: .8rem; }
        .connection strong { font-size: .9rem; }
        .metrics { display: grid; grid-template-columns: repeat(4,minmax(0,1fr)); gap: 12px; margin-top: 18px; }
        .metrics div { display: grid; gap: 7px; padding: 14px; border: 1px solid var(--glass-border); border-radius: 10px; color: var(--text-secondary); font-size: .82rem; }
        .metrics strong { color: white; font-size: 1rem; overflow-wrap: anywhere; }
        .orders, .tenant-list { margin-top: 22px; padding-top: 18px; border-top: 1px solid var(--glass-border); }
        .orders h3, .tenant-list h3 { margin: 0 0 12px; font-size: 1rem; }
        .tenant { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 10px; padding: 10px 0; border-bottom: 1px solid var(--glass-border); font-size: .84rem; }
        .table-wrap { overflow-x: auto; }
        table { width: 100%; border-collapse: collapse; text-align: left; font-size: .82rem; }
        th, td { padding: 10px; border-bottom: 1px solid var(--glass-border); white-space: nowrap; }
        th { color: var(--text-secondary); font-weight: 600; }
        td:first-child { color: var(--primary); font-weight: 700; }
        .error { color: #ff7777; }
        .notice { color: #77dd99; }
        @media (max-width: 760px) {
          .metrics { grid-template-columns: repeat(2,minmax(0,1fr)); }
          .connect-row, .tenant { display: grid; grid-template-columns: 1fr; }
        }
      `}</style>
    </section>
  );
}
