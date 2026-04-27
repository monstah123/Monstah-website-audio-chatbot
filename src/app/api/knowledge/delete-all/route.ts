import { NextResponse } from "next/server";
import { db } from "@/lib/firebase-admin";

export async function POST(req: Request) {
  try {
    const { userId } = await req.json();

    if (!userId) {
      return NextResponse.json({ error: "Missing User ID" }, { status: 401 });
    }

    const knowledgeSnapshot = await db.collection("knowledge")
      .where("userId", "==", userId)
      .get();

    let count = 0;
    let batches = [];
    let currentBatch = db.batch();
    let currentCount = 0;

    knowledgeSnapshot.docs.forEach((doc) => {
      currentBatch.delete(doc.ref);
      currentCount++;
      count++;
      
      if (currentCount >= 50) {
        batches.push(currentBatch);
        currentBatch = db.batch();
        currentCount = 0;
      }
    });

    if (currentCount > 0) {
      batches.push(currentBatch);
    }

    for (const b of batches) {
      await b.commit();
    }

    // Also clear the navigationLinks in settings to be a full hard reset
    await db.collection("users").doc(userId).set({
      navigationLinks: []
    }, { merge: true });

    return NextResponse.json({ success: true, message: `Successfully deleted ${count} knowledge chunks.` });
  } catch (error: any) {
    console.error("Delete All Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
