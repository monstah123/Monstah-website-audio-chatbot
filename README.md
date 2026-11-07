This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

## Widget event analytics

Every signed-in client can access their own dashboard, knowledge base, and settings. The general analytics panel and cross-tenant analytics are visible only to the app owner account (`OWNER_UID` in `src/lib/owner.ts`). Clients can see only their own store's verified WooCommerce order report. The analytics API verifies the Firebase ID token and returns only the caller's own tenant data to clients; only the owner can request aggregated metrics across tenants. Website links and agent settings are stored only under each account; saving owner settings does not copy them into a client account. Widget loads, chat opens/closes, user-message counts, assistant replies, chatbot navigation, and explicitly signaled client-site conversions are stored in tenant-scoped Firestore records. Owner dashboard metrics refresh every 15 seconds. Message text is not included in analytics events.

### WooCommerce purchase attribution

When the chatbot sends a shopper to a page on the same website, the widget keeps that chatbot session as an attribution for seven days. If the widget is installed on the WooCommerce order confirmation page and the shopper reaches the standard `/order-received/{order-id}/` URL within that period, the dashboard records one WooCommerce purchase for that order. Repeated visits to the same order page do not increment the count again. The dashboard lists the latest 25 attributed order IDs, website origins, and confirmation times. No order amount, customer information, or message text is collected.

This browser-based integration counts an order reaching the WooCommerce confirmation page; it does not verify that payment settled, or account for later refunds. It requires the standard WooCommerce order-received URL and the widget script to run on that page.

### Verified WooCommerce order reporting

Each signed-in account can optionally connect its own WooCommerce store from the dashboard. Generate a webhook secret there, then in WordPress go to **WooCommerce → Settings → Advanced → Webhooks**, create an active webhook with the **Order updated** topic, and enter the displayed delivery URL and secret. No WordPress plugin or custom site code is required. The webhook endpoint verifies WooCommerce's HMAC-SHA256 signature before processing an order.

The report stores the order ID/number, order status, totals, currency, refund total, and timestamps; customer and payment details are not stored. Orders in WooCommerce's `processing` or `completed` states contribute to those status totals and net sales; refunds adjust net sales, and fully refunded orders are counted separately. Updates are idempotent and reports refresh every 15 seconds. The owner can see cross-tenant totals; each client can see only their own store's report.

The signed webhook confirms that the status came from the configured WooCommerce store; it does not independently confirm card settlement. In particular, a store may move a cash-on-delivery order to `processing` before collecting cash. These are not chatbot-attributed sales: a store can receive orders that did not come from the chatbot. The browser-based attribution report above remains separate and does not verify settlement or refunds. Webhook secrets are encrypted server-side using the Firebase service-account private key before being saved; keep the `woocommerceWebhookSecrets` Firestore collection inaccessible to client SDKs as well.

To record a client-site conversion such as a completed purchase or signup, dispatch this browser event after the conversion succeeds:

```js
window.dispatchEvent(
  new CustomEvent("monstah:conversion", {
    detail: { name: "purchase" },
  }),
);
```

The `name` is optional; when provided, it is limited to 80 characters. Chatbot navigation is tracked separately from these explicit site conversions.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
