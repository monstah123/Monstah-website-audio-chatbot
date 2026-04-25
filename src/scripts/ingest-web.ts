import FirecrawlApp from '@mendable/firecrawl-js';
import { db } from "../lib/firebase-admin";
import { OpenAI } from "openai";
import * as dotenv from "dotenv";

dotenv.config();

const app = new FirecrawlApp({
  apiKey: process.env.FIRECRAWL_API_KEY || ''
});

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

async function ingestWebsite(url: string, userId: string) {
  console.log(`🚀 Starting crawl and training for: ${url} (User: ${userId})`);
  
  try {
    const crawlResponse = await app.crawlUrl(url, {
      limit: 50, // Stay within free tier limits
      scrapeOptions: {
        formats: ['markdown'],
      }
    });

    if (!crawlResponse.success) {
      throw new Error(`Failed to crawl: ${crawlResponse.error}`);
    }

    console.log(`✅ Crawl completed. Found ${crawlResponse.data.length} pages.`);
    
    for (const page of crawlResponse.data) {
      console.log(`🧠 Processing: ${page.metadata?.title || page.url}`);
      
      const content = page.markdown || "";
      if (content.length < 100) continue; // Skip empty pages

      // Generate embedding for search
      const embeddingResponse = await openai.embeddings.create({
        model: "text-embedding-3-small",
        input: content.substring(0, 8000),
      });

      const vector = embeddingResponse.data[0].embedding;

      // Save to Firestore
      await db.collection("knowledge").add({
        userId,
        source: page.url,
        type: "web_page",
        title: page.metadata?.title || "Untitled",
        content: content.substring(0, 5000), // Snippet for context
        vector,
        createdAt: new Date().toISOString(),
      });
      
      console.log(`   - Saved to Firestore Knowledge Base.`);
    }

    console.log(`\n🎉 Training complete! Your AI now knows about ${url}`);

  } catch (error) {
    console.error("❌ Ingestion Error:", error);
  }
}

const targetUrl = process.argv[2];
const targetUserId = process.argv[3];
if (targetUrl && targetUserId) {
  ingestWebsite(targetUrl, targetUserId);
} else {
  console.log("Please provide a URL and a User ID to crawl: npx ts-node src/scripts/ingest-web.ts https://yoursite.com <userId>");
}
