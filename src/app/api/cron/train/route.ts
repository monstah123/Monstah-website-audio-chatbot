import { NextResponse } from "next/server";
import { db } from "@/lib/firebase-admin";

export async function GET(req: Request) {
  // 1. Verify Cron Secret (Security)
  const { searchParams } = new URL(req.url);
  const authHeader = req.headers.get('authorization');
  
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}` && searchParams.get('key') !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const now = new Date();
    const isWeekly = now.getDay() === 0; // Sunday

    // 2. Find users who need refreshing
    const usersToRefresh = await db.collection("users")
      .where("trainingSchedule", "in", isWeekly ? ["daily", "weekly"] : ["daily"])
      .get();

    if (usersToRefresh.empty) {
      return NextResponse.json({ message: "No users to refresh today." });
    }

    const results = [];

    for (const doc of usersToRefresh.docs) {
      const userData = doc.data();
      const userId = doc.id;
      const url = userData.lastTrainedUrl; // We'll need to store this

      if (url) {
        // Trigger the internal ingest logic (or call the endpoint internally)
        // For now, we'll just log it. In a real app, you'd call your ingest function.
        results.push({ userId, url, status: "triggered" });
      }
    }

    return NextResponse.json({ 
      message: `Triggered refresh for ${results.length} users.`,
      results 
    });

  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
