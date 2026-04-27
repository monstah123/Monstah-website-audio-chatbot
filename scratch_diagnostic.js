
const fetch = require("node-fetch");

async function diagnostic() {
  const userId = "zYXZQWVdWKPnHiE566SJxWaTqip1"; // Peterson's UID
  const url = `http://localhost:3000/api/settings?userId=${userId}`;
  
  try {
    const res = await fetch(url);
    const data = await res.json();
    console.log("API Settings Data:");
    console.log(JSON.stringify(data, null, 2));
  } catch (err) {
    console.error("Diagnostic failed:", err.message);
  }
}

diagnostic();
