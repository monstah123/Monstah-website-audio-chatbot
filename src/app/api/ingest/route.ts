import { NextResponse } from "next/server";
import { OpenAI } from "openai";
import { db } from "@/lib/firebase-admin";
import * as cheerio from "cheerio";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const type = formData.get("type") as string;
    let content = "";
    let source = "";

    if (type === "url") {
      const url = formData.get("url") as string;
      source = url;
      const response = await fetch(url);
      const html = await response.text();
      const $ = cheerio.load(html);
      $("script, style, noscript, nav, footer").remove();
      content = $("body").text().replace(/\s+/g, " ").trim();
      
    } else if (type === "text") {
      content = formData.get("text") as string;
      source = "Manual Text Entry";
      
    } else if (type === "file") {
      const file = formData.get("file") as File;
      source = file.name;
      const buffer = Buffer.from(await file.arrayBuffer());
      
      if (file.type === "application/pdf" || file.name.endsWith(".pdf")) {
        const pdfParse = require("pdf-parse");
        const pdfData = await pdfParse(buffer);
        content = pdfData.text;
      } else {
        content = buffer.toString("utf-8");
      }
    }

    if (!content || content.length < 10) {
      return NextResponse.json({ error: "Content too short or empty" }, { status: 400 });
    }

    // Chunk the content to avoid hitting embedding token limits
    const chunkSize = 2000;
    let chunksProcessed = 0;
    
    for (let i = 0; i < content.length; i += chunkSize) {
      const chunk = content.slice(i, i + chunkSize);
      
      const embeddingResponse = await openai.embeddings.create({
        model: "text-embedding-3-small",
        input: chunk,
      });
      const vector = embeddingResponse.data[0].embedding;

      await db.collection("knowledge").add({
        source,
        content: chunk,
        vector,
        createdAt: new Date().toISOString(),
      });
      
      chunksProcessed++;
    }

    return NextResponse.json({ 
      success: true, 
      message: `Successfully learned ${chunksProcessed} chunks from ${source}` 
    });
    
  } catch (error: any) {
    console.error("Ingest API Error:", error);
    return NextResponse.json({ error: error.message || "Failed to ingest data" }, { status: 500 });
  }
}
