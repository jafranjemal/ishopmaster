// lib/redis.js
const { createClient } = require("redis");

let client = null;
if (process.env.REDIS_URL) {
  client = createClient({ url: process.env.REDIS_URL });
  client.on("error", (err) => console.error("Redis error", err));
  (async () => {
    try {
      await client.connect();
      console.log("Redis connected");
    } catch (err) {
      console.warn("Redis connection failed:", err.message);
      client = null;
    }
  })();
} else {
  // no redis configured: export null (caller handles)
  client = null;
}

module.exports = client;
