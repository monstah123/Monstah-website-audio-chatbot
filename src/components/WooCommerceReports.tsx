"use client";

import { useCallback, useEffect, useState } from "react";
import { auth } from "@/lib/firebase-client";
import { CheckCircle2, Copy, RefreshCw, ShoppingBag } from "lucide-react";

type Order = {
  orderId: string;
  status: string;
  orderCategory: "processingCompleted" | "other" | "refunded";
  total: string;
  currency: string;
  refundedTotal: string;
  createdAt: string | null;
  updatedAt: string | null;
  tenantId?: string;
};

type Stats = {
  processingCompletedOrders: number;
  otherStatusOrders: number;
  refundedOrders: number;
  netSalesByCurrency: Record<string, number>;
};

type Report = {
  stats: Stats;
  tenants?: Array<{ tenantId: string; stats: Stats }>;
  orders: Order[];
};

const emptyStats: Stats = {
  processingCompletedOrders: 0,
  otherStatusOrders: 0,
  refundedOrders: 0,
  netSalesByCurrency: {},
};

function formatAmount(amount: string | number, currency: string) {
  return `${currency} ${Number(amount).toFixed(2)}`;
}

function formatPaymentStatus(order: Order) {
  const status = order.status.replace(/-/g, " ");
  const label = status.charAt(0).toUpperCase() + status.slice(1);
  return Number(order.refundedTotal) > 0 && order.orderCategory !== "refunded"
    ? `${label} (partially refunded)`
    : label;
}

export default function WooCommerceReports({ isOwner }: { isOwner: boolean }) {
  const [configured, setConfigured] = useState(false);
  const [webhookUrl, setWebhookUrl] = useState("");
  const [secret, setSecret] = useState("");
  const [report, setReport] = useState<Report>({
    stats: emptyStats,
    orders: [],
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const user = auth.currentUser;
    if (!user) return;

    try {
      const token = await user.getIdToken();
      const headers = { Authorization: `Bearer ${token}` };
      const [setupResponse, ordersResponse] = await Promise.all([
        fetch("/api/woocommerce/setup", { headers }),
        fetch("/api/woocommerce/orders", { headers }),
      ]);
      if (!setupResponse.ok || !ordersResponse.ok) {
        throw new Error("Unable to load WooCommerce reports.");
      }

      const setup = await setupResponse.json();
      const data = await ordersResponse.json();
      setConfigured(Boolean(setup.configured));
      setWebhookUrl(setup.webhookUrl);
      setReport({
        stats: data.stats ?? emptyStats,
        tenants: data.tenants,
        orders: data.orders ?? [],
      });
      setError(null);
    } catch (loadError) {
      console.error("Failed to load WooCommerce reports:", loadError);
      setError("WooCommerce reports are temporarily unavailable.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const initialRefresh = setTimeout(() => void refresh(), 0);
    const interval = setInterval(() => void refresh(), 15000);
    return () => {
      clearTimeout(initialRefresh);
      clearInterval(interval);
    };
  }, [refresh]);

  const createWebhookSecret = async () => {
    if (configured && !window.confirm("Rotating the secret invalidates the current WooCommerce webhook until you update it. Continue?")) {
      return;
    }
    const user = auth.currentUser;
    if (!user) {
      setError("Sign in again before configuring WooCommerce.");
      return;
    }

    setSaving(true);
    try {
      const token = await user.getIdToken();
      const response = await fetch("/api/woocommerce/setup", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Unable to configure the webhook.");
      setConfigured(true);
      setWebhookUrl(data.webhookUrl);
      setSecret(data.webhookSecret);
      setError(null);
    } catch (setupError) {
      console.error("Failed to configure WooCommerce webhook:", setupError);
      setError("Unable to configure the WooCommerce webhook. Try again.");
    } finally {
      setSaving(false);
    }
  };

  const copySecret = async () => {
    try {
      await navigator.clipboard.writeText(secret);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (copyError) {
      console.error("Unable to copy WooCommerce webhook secret:", copyError);
      setError("Copy failed. Select and copy the secret manually.");
    }
  };

  return (
    <section className="woocommerce-card glass" aria-labelledby="woocommerce-title">
      <div className="woocommerce-heading">
        <div>
          <h2 id="woocommerce-title"><ShoppingBag size={20} /> WooCommerce order report</h2>
          <p>
            Signed server webhooks authenticate WooCommerce order statuses, not payment settlement or chatbot attribution.
          </p>
        </div>
        <button className="refresh-button" type="button" onClick={() => void refresh()} aria-label="Refresh WooCommerce report">
          <RefreshCw size={16} />
        </button>
      </div>

      {error && <p className="woocommerce-error" role="alert">{error}</p>}

      <div className="woocommerce-setup">
        <h3>Connect a WooCommerce store (no plugin required)</h3>
        <ol>
          <li>Generate a webhook secret below and copy the URL and secret.</li>
          <li>In WordPress, open <strong>WooCommerce → Settings → Advanced → Webhooks</strong> and add a webhook.</li>
          <li>Create two active webhooks using the same URL and secret: one with the <strong>Order created</strong> topic and one with <strong>Order updated</strong>.</li>
        </ol>
        <button className="setup-button" type="button" onClick={() => void createWebhookSecret()} disabled={saving}>
          {saving ? "Generating..." : configured ? "Rotate webhook secret" : "Generate webhook secret"}
        </button>
        {configured && (
          <div className="webhook-details">
            <label>
              Delivery URL
              <code>{webhookUrl}</code>
            </label>
            {secret ? (
              <label>
                Webhook secret (shown once)
                <span className="secret-row">
                  <code>{secret}</code>
                  <button type="button" onClick={() => void copySecret()} aria-label="Copy webhook secret">
                    {copied ? <CheckCircle2 size={16} /> : <Copy size={16} />}
                  </button>
                </span>
              </label>
            ) : (
              <p className="secret-note">The secret is saved on the server and cannot be viewed again. Rotate it to generate a new one.</p>
            )}
          </div>
        )}
      </div>

      <div className="woocommerce-metrics">
        <div><span>Processing/completed orders</span><strong>{report.stats.processingCompletedOrders}</strong></div>
        <div><span>Other order statuses</span><strong>{report.stats.otherStatusOrders}</strong></div>
        <div><span>Refunded orders</span><strong>{report.stats.refundedOrders}</strong></div>
        <div>
          <span>Net sales</span>
          <strong>
            {Object.entries(report.stats.netSalesByCurrency).length
              ? Object.entries(report.stats.netSalesByCurrency)
                .map(([currency, amount]) => formatAmount(amount, currency))
                .join(" · ")
              : "—"}
          </strong>
        </div>
      </div>

      {isOwner && report.tenants && (
        <div className="tenant-report">
          <h3>Verified totals by tenant</h3>
          {report.tenants.length ? report.tenants.map((tenant) => (
            <div className="tenant-row" key={tenant.tenantId}>
              <code>{tenant.tenantId}</code>
              <span>{tenant.stats.processingCompletedOrders} processing/completed · {tenant.stats.refundedOrders} refunded</span>
              <span>{Object.entries(tenant.stats.netSalesByCurrency)
                .map(([currency, amount]) => formatAmount(amount, currency))
                .join(" · ") || "—"}</span>
            </div>
          )) : <p className="empty-orders">No tenant stores have reported orders.</p>}
        </div>
      )}

      <div className="orders-section">
        <h3>{isOwner ? "Latest orders across stores" : "Latest orders for your store"}</h3>
        {loading ? <p className="empty-orders">Loading orders...</p> : report.orders.length === 0 ? (
          <p className="empty-orders">No orders received yet. Orders appear after the webhook is active.</p>
        ) : (
          <div className="orders-table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Order</th>
                  {isOwner && <th>Tenant</th>}
                  <th>WooCommerce status</th>
                  <th>Total</th>
                  <th>Refunded</th>
                  <th>Updated</th>
                </tr>
              </thead>
              <tbody>
                {report.orders.map((order) => (
                  <tr key={`${order.tenantId ?? "self"}-${order.orderId}`}>
                    <td>#{order.orderId}</td>
                    {isOwner && <td><code>{order.tenantId}</code></td>}
                    <td>{formatPaymentStatus(order)}</td>
                    <td>{formatAmount(order.total, order.currency)}</td>
                    <td>{formatAmount(order.refundedTotal, order.currency)}</td>
                    <td>{order.updatedAt ? new Date(order.updatedAt).toLocaleString() : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <style jsx>{`
        .woocommerce-card {
          padding: 24px;
          margin-top: 32px;
          border-radius: 20px;
        }
        .woocommerce-heading {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          gap: 16px;
        }
        .woocommerce-heading h2 {
          display: flex;
          align-items: center;
          gap: 10px;
          margin: 0 0 6px;
          font-size: 1.25rem;
        }
        .woocommerce-heading p,
        .secret-note,
        .empty-orders {
          color: var(--text-secondary);
          font-size: 0.88rem;
        }
        .woocommerce-heading p { margin: 0; }
        .refresh-button,
        .setup-button,
        .secret-row button {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          border: 1px solid var(--glass-border);
          border-radius: 8px;
          background: rgba(255, 255, 255, 0.07);
          color: white;
          padding: 9px 12px;
          cursor: pointer;
        }
        .setup-button { margin-top: 8px; }
        button:disabled { opacity: 0.6; cursor: wait; }
        .woocommerce-setup {
          margin-top: 20px;
          padding: 18px;
          border: 1px solid var(--glass-border);
          border-radius: 12px;
          background: rgba(255, 255, 255, 0.025);
        }
        .woocommerce-setup h3,
        .tenant-report h3,
        .orders-section h3 {
          margin: 0 0 12px;
          font-size: 1rem;
        }
        .woocommerce-setup ol {
          margin: 0;
          padding-left: 22px;
          color: var(--text-secondary);
          font-size: 0.88rem;
          line-height: 1.8;
        }
        .webhook-details {
          display: grid;
          gap: 12px;
          margin-top: 16px;
        }
        .webhook-details label {
          display: grid;
          gap: 6px;
          color: var(--text-secondary);
          font-size: 0.8rem;
        }
        .webhook-details code,
        .tenant-row code,
        .orders-table-wrap code {
          color: var(--primary);
          overflow-wrap: anywhere;
        }
        .webhook-details label > code,
        .secret-row {
          padding: 10px;
          border: 1px solid var(--glass-border);
          border-radius: 8px;
          background: rgba(0, 0, 0, 0.35);
        }
        .secret-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 10px;
        }
        .secret-row button { flex: 0 0 auto; padding: 6px; }
        .secret-note { margin: 0; }
        .woocommerce-error { color: #ff7777; }
        .woocommerce-metrics {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 12px;
          margin-top: 18px;
        }
        .woocommerce-metrics > div {
          display: grid;
          gap: 7px;
          padding: 14px;
          border: 1px solid var(--glass-border);
          border-radius: 10px;
          color: var(--text-secondary);
          font-size: 0.83rem;
        }
        .woocommerce-metrics strong { color: white; font-size: 1.05rem; overflow-wrap: anywhere; }
        .tenant-report,
        .orders-section {
          margin-top: 24px;
          padding-top: 20px;
          border-top: 1px solid var(--glass-border);
        }
        .tenant-row {
          display: grid;
          grid-template-columns: minmax(160px, 1fr) 1fr 1fr;
          gap: 12px;
          padding: 10px 0;
          border-bottom: 1px solid var(--glass-border);
          font-size: 0.84rem;
        }
        .orders-table-wrap { overflow-x: auto; }
        table { width: 100%; border-collapse: collapse; text-align: left; font-size: 0.82rem; }
        th, td { padding: 10px; border-bottom: 1px solid var(--glass-border); white-space: nowrap; }
        th { color: var(--text-secondary); font-weight: 600; }
        td:first-child { color: var(--primary); font-weight: 700; }
        @media (max-width: 760px) {
          .woocommerce-metrics { grid-template-columns: repeat(2, minmax(0, 1fr)); }
          .tenant-row { grid-template-columns: 1fr; gap: 5px; }
        }
      `}</style>
    </section>
  );
}
