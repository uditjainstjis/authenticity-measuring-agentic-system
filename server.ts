import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import * as cheerio from "cheerio";
import cors from "cors";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(cors());
  app.use(express.json());

  // Real-time Scraper Endpoint for "Hardcore" Researchers
  app.post("/api/scrape", async (req, res) => {
    const { url } = req.body;
    if (!url) return res.status(400).json({ error: "URL is required" });

    try {
      console.log(`[SCRAPER] Ingesting: ${url}`);
      const response = await fetch(url, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
        }
      });
      
      const html = await response.text();
      const $ = cheerio.load(html);

      // Extract meaningful content
      const title = $("title").text() || $("h1").first().text();
      // Remove noise
      $("script, style, nav, footer, ads").remove();
      const content = $("body").text().replace(/\s+/g, " ").trim().substring(0, 5000);

      res.json({ title, content });
    } catch (error: any) {
      console.error(`[SCRAPER] Error: ${error.message}`);
      res.status(500).json({ error: "Failed to scrape content", details: error.message });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`[VERITAS_SERVER] Active at http://0.0.0.0:${PORT}`);
  });
}

startServer();
