import axios from "axios";
import * as cheerio from "cheerio";
import { db } from "../lib/firebase-admin";
import OpenAI from "openai";
import * as dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

async function scrapeBasic(url: string) {
  console.log(`🌐 Scrape Mode: Basic (No Firecrawl Key Found)`);
  const { data } = await axios.get(url);
  const $ = cheerio.load(data);
  
  // Clean up the HTML
  $("script, style, nav, footer, header").remove();
  
  const title = $("title").text() || url;
  const content = $("body").text().replace(/\s+/g, " ").trim();
  
  return { title, content };
}

async function scrapeFirecrawl(url: string) {
  console.log(`🔥 Scrape Mode: Firecrawl (Deep Crawl)`);
  const apiKey = process.env.FIRECRAWL_API_KEY;
  
  const response = await axios.post(
    "https://api.firecrawl.dev/v0/scrape",
    { url, formats: ["markdown"] },
    { headers: { Authorization: `Bearer ${apiKey}` } }
  );
  
  return {
    title: response.data.data.metadata?.title || url,
    content: response.data.data.markdown,
  };
}

async function processUrl(url: string) {
  if (!url) {
    console.error("❌ Please provide a URL.");
    return;
  }

  console.log(`🔍 Starting ingestion for: ${url}`);

  try {
    const { title, content } = process.env.FIRECRAWL_API_KEY && process.env.FIRECRAWL_API_KEY !== "your_firecrawl_api_key_here"
      ? await scrapeFirecrawl(url)
      : await scrapeBasic(url);

    if (!content || content.length < 50) {
      throw new Error("Could not extract meaningful content from the page.");
    }

    console.log(`🧠 Generating embeddings for "${title}"...`);
    const embeddingResponse = await openai.embeddings.create({
      model: "text-embedding-3-small",
      input: content.substring(0, 8000), // OpenAI limit
    });

    const embedding = embeddingResponse.data[0].embedding;

    console.log("💾 Saving to Firestore Knowledge Base...");
    await db.collection("knowledge").add({
      title,
      content,
      url,
      embedding,
      type: "website",
      createdAt: new Date(),
    });

    console.log(`✅ Successfully ingested: ${title}`);
  } catch (error) {
    console.error("❌ Ingestion Failed:", (error as Error).message);
  }
}

// Get URL from command line
const targetUrl = process.argv[2];
processUrl(targetUrl);
