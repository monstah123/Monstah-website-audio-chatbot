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

async function ingestWebsite(url: string) {
  console.log(`🚀 Starting crawl and training for: ${url}`);
  
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
      console.log(`🧠 Processing: ${page.metadata.title || page.url}`);
      
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
        type: "web_page",
        url: page.url,
        title: page.metadata.title || "Untitled",
        content: content.substring(0, 5000), // Snippet for context
        embedding: vector,
        updatedAt: new Date(),
      });
      
      console.log(`   - Saved to Firestore Knowledge Base.`);
    }

    console.log(`\n🎉 Training complete! Your AI now knows about ${url}`);

  } catch (error) {
    console.error("❌ Ingestion Error:", error);
  }
}

const targetUrl = process.argv[2];
if (targetUrl) {
  ingestWebsite(targetUrl);
} else {
  console.log("Please provide a URL to crawl: npx ts-node src/scripts/ingest-web.ts https://yoursite.com");
}
