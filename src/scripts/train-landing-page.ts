import { db } from "../lib/firebase-admin";
import { OpenAI } from "openai";
import * as dotenv from "dotenv";

dotenv.config();

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

async function trainLandingPage() {
  console.log("🚀 Training landing page chatbot...");

  const content = `
Monstah AI Voice Chatbot
The most advanced audio-enabled AI chatbot for WordPress & Shopify.

Core Identity:
You are Monstah AI, a high-performance, low-latency voice agent. You help business owners turn their static websites into interactive, talking experiences. Your mission is to demonstrate the power of RAG-based voice AI.

Features:
- Voice First: Low-latency STT + realistic TTS (Onyx voice). Your customers talk, the AI listens and responds instantly.
- RAG Pipeline: Upload PDFs, CSVs, or paste a URL. The AI reads it all and answers with precision using our advanced vector knowledge base.
- Multi-Tenant Secure: Every user gets their own isolated knowledge vault. Zero data leakage across accounts.
- Response Time: Near-instant (< 1s) response times for a fluid conversation.
- Smart Navigation: I can help you find pages on the site. Just ask me to "take me to the dashboard" or "show me the docs".
- Design: 7 premium neon themes (Green, Red, Blue, Pink, Gold, White, Purple) to match your brand.
- Integration: Deploy with a single script tag on WordPress, Shopify, or any custom site.

How it works:
1. Train Your AI: Paste your website URL or upload documents.
2. Customize Your Agent: Name your AI, set personality, theme color, and first message.
3. Embed on Your Site: Copy one script tag and paste it.

Pricing:
No monthly subscription. No per-seat fees. Just your AI, your brand, your data.
Monstah AI is built for efficiency. By utilizing DeepSeek AI for intelligence, we provide near-zero cost per query. You own your data and your agent. I will set up subscription later.

Technical Stack:
- Frontend: Next.js + TailwindCSS + Framer Motion
- Intelligence: DeepSeek AI (LLM) + OpenAI (Embeddings & TTS)
- Storage: AWS S3 (Documents) + Firebase Firestore (Vector Base)
- Deployment: Vercel + GitHub Auto-update

FAQ:
Q: How do I get started?
A: Simply sign in with Google, upload your knowledge, and copy your unique script tag.

Q: Can I white-label it?
A: Yes, Pro users can unlock full brand customization and remove the "Powered by Monstah" tag.

Q: Does it work on mobile?
A: Yes, the widget is fully responsive and optimized for mobile voice interaction.
`;


  try {
    const embeddingResponse = await openai.embeddings.create({
      model: "text-embedding-3-small",
      input: content,
    });

    const vector = embeddingResponse.data[0].embedding;

    // Use a specific user ID for the landing page chatbot
    const userId = "monstah-landing-page";

    // Delete existing knowledge for this user
    const snapshot = await db.collection("knowledge").where("userId", "==", userId).get();
    const batch = db.batch();
    snapshot.docs.forEach((doc) => {
      batch.delete(doc.ref);
    });
    await batch.commit();

    // Save to Firestore
    await db.collection("knowledge").add({
      userId,
      type: "text",
      source: "Landing Page Content",
      title: "Landing Page Knowledge",
      content: content,
      vector,
      createdAt: new Date().toISOString(),
    });

    // Also create/update the user settings for the landing page chatbot
    await db.collection("users").doc(userId).set({
      agentName: "Monstah AI",
      brandName: "Monstah AI",
      firstMessage: "Welcome to Monstah AI! I'm the voice agent for this site. You can ask me about our features, how to embed the widget, or how our RAG pipeline works. Try speaking to me!",
      themeColor: "green",
      idleTimeout: 15,
      systemPrompt: "You are Monstah AI, the official voice agent for the Monstah AI website. Answer questions about the product features, pricing, and how it works based on the context provided.",
    }, { merge: true });

    console.log("✅ Successfully trained landing page chatbot!");
  } catch (error) {
    console.error("❌ Training Error:", error);
  }
}

trainLandingPage();
