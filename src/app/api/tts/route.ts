import { OpenAI } from "openai";
import { NextResponse } from "next/server";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(req: Request) {
  try {
    const { text, voice = "alloy" } = await req.json();

    if (!text) {
      return NextResponse.json({ error: "Text is required" }, { status: 400 });
    }

    // Generate speech using OpenAI's TTS model
    const mp3 = await openai.audio.speech.create({
      model: "tts-1",
      voice: voice, // alloy, echo, fable, onyx, nova, shimmer
      input: text,
    });

    // Get the audio data as an array buffer
    const buffer = Buffer.from(await mp3.arrayBuffer());

    return new NextResponse(buffer, {
      headers: {
        "Content-Type": "audio/mpeg",
      },
    });
  } catch (error) {
    console.error("TTS API Error:", error);
    return NextResponse.json({ error: "Failed to generate speech" }, { status: 500 });
  }
}
