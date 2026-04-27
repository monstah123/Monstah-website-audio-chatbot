import { db } from "./src/lib/firebase-admin";

async function run() {
  const usersSnapshot = await db.collection("users").get();
  usersSnapshot.forEach(doc => {
    const data = doc.data();
    if (data.navigationLinks) {
      console.log("User:", doc.id);
      if (Array.isArray(data.navigationLinks)) {
        data.navigationLinks.forEach(l => {
          if (l.name.toLowerCase().includes("knee") || l.url.toLowerCase().includes("knee")) {
            console.log("  Link:", l);
          }
        });
      } else {
        Object.entries(data.navigationLinks).forEach(([name, url]) => {
          if (name.toLowerCase().includes("knee") || (url as string).toLowerCase().includes("knee")) {
            console.log("  Link:", name, "=>", url);
          }
        });
      }
    }
  });
}
run();
