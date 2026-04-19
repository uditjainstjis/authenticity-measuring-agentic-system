import { scrapeUrl } from "../src/lib/scraper.js";

export default async function handler(req: any, res: any) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { url } = req.body;
    const data = await scrapeUrl(url);
    return res.status(200).json(data);
  } catch (error: any) {
    console.error("Scraping error:", error);
    return res.status(500).json({ error: error.message });
  }
}
