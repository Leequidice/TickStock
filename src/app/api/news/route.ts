import { NextRequest, NextResponse } from "next/server";

interface NewsItem {
  headline: string;
  source?: string;
  url?: string;
  timestamp: number;
}

// In-memory cache for news headlines: ticker -> { items, cachedAt }
const newsCache = new Map<string, { items: NewsItem[]; cachedAt: number }>();
const CACHE_TTL_MS = 15 * 60 * 1000; // 15 minutes cache

/**
 * Strips XML tags and HTML entities
 */
function cleanXmlText(text: string): string {
  return text
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/<[^>]*>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .trim();
}

/**
 * Fetches real news from Google News Financial RSS or Finnhub
 */
async function fetchNewsForTicker(ticker: string, companyName: string): Promise<NewsItem[]> {
  const normalizedTicker = ticker.toUpperCase().replace(/X$/, ""); // e.g. NVDAx -> NVDA
  const cached = newsCache.get(normalizedTicker);

  if (cached && Date.now() - cached.cachedAt < CACHE_TTL_MS) {
    return cached.items;
  }

  // 1. Try Finnhub if API key is present
  const finnhubKey = process.env.FINNHUB_API_KEY;
  if (finnhubKey) {
    try {
      const today = new Date().toISOString().split("T")[0];
      const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];
      const res = await fetch(
        `https://finnhub.io/api/v1/company-news?symbol=${normalizedTicker}&from=${weekAgo}&to=${today}&token=${finnhubKey}`,
        { next: { revalidate: 900 } }
      );
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data) && data.length > 0) {
          const items: NewsItem[] = data.slice(0, 5).map((d: any) => ({
            headline: d.headline,
            source: d.source,
            url: d.url,
            timestamp: d.datetime ? d.datetime * 1000 : Date.now(),
          }));
          newsCache.set(normalizedTicker, { items, cachedAt: Date.now() });
          return items;
        }
      }
    } catch (e) {
      console.warn(`[News API] Finnhub fetch error for ${normalizedTicker}:`, e);
    }
  }

  // 2. Fetch live financial news from Google News RSS (Zero API key required, 100% free & live)
  try {
    const query = encodeURIComponent(`${normalizedTicker} stock ${companyName}`);
    const rssUrl = `https://news.google.com/rss/search?q=${query}&hl=en-US&gl=US&ceid=US:en`;
    
    const response = await fetch(rssUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      },
      next: { revalidate: 900 },
    });

    if (response.ok) {
      const xml = await response.text();
      const items: NewsItem[] = [];
      const itemRegex = /<item>[\s\S]*?<title>(.*?)<\/title>[\s\S]*?<link>(.*?)<\/link>[\s\S]*?<pubDate>(.*?)<\/pubDate>[\s\S]*?<\/item>/g;
      
      let match;
      while ((match = itemRegex.exec(xml)) !== null && items.length < 5) {
        const rawTitle = cleanXmlText(match[1]);
        const url = match[2].trim();
        const pubDateStr = match[3].trim();
        
        // Split out source if present (e.g. "Headline text - Bloomberg")
        const sourceMatch = rawTitle.match(/^(.*?)\s*-\s*([^-]+)$/);
        const headline = sourceMatch ? sourceMatch[1].trim() : rawTitle;
        const source = sourceMatch ? sourceMatch[2].trim() : "Financial News";
        
        items.push({
          headline,
          source,
          url,
          timestamp: Date.parse(pubDateStr) || Date.now(),
        });
      }

      if (items.length > 0) {
        newsCache.set(normalizedTicker, { items, cachedAt: Date.now() });
        return items;
      }
    }
  } catch (err) {
    console.warn(`[News API] RSS fetch error for ${normalizedTicker}:`, err);
  }

  // Fallback: cache empty list to avoid repeating failed requests instantly
  const fallback = [{
    headline: "No recent news",
    timestamp: Date.now(),
  }];
  newsCache.set(normalizedTicker, { items: fallback, cachedAt: Date.now() });
  return fallback;
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const ticker = searchParams.get("ticker");
  const name = searchParams.get("name") || "";

  if (!ticker) {
    return NextResponse.json({ error: "Ticker symbol is required" }, { status: 400 });
  }

  try {
    const news = await fetchNewsForTicker(ticker, name);
    return NextResponse.json({
      success: true,
      ticker: ticker.toUpperCase(),
      news,
    });
  } catch (error: any) {
    return NextResponse.json({
      success: false,
      error: error.message || "Failed to fetch news",
      news: [{ headline: "No recent news", timestamp: Date.now() }],
    }, { status: 500 });
  }
}
