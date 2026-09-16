import { TokenizedStock, VERIFIED_TOKENIZED_STOCKS } from "./stocks";

export interface ChartDataPoint {
  time: string;
  price: number;
  volume?: number;
}

export type Timeframe = "1D" | "1W" | "1M" | "1Y";

/**
 * Generates realistic price chart curve for a stock anchored to its base price and 24h change
 */
export function generateChartData(
  stock: TokenizedStock,
  timeframe: Timeframe = "1D"
): ChartDataPoint[] {
  const pointsCount = timeframe === "1D" ? 30 : timeframe === "1W" ? 28 : timeframe === "1M" ? 30 : 52;
  const currentPrice = stock.basePrice;
  const pctChange = stock.change24h / 100;
  
  // Starting price based on 24h change or timeframe
  const multiplier =
    timeframe === "1D"
      ? 1 / (1 + pctChange)
      : timeframe === "1W"
      ? 1 / (1 + pctChange * 2.2)
      : timeframe === "1M"
      ? 1 / (1 + pctChange * 4.5)
      : 1 / (1 + pctChange * 8);

  const startPrice = currentPrice * multiplier;
  const points: ChartDataPoint[] = [];

  let rollingPrice = startPrice;
  const priceStep = (currentPrice - startPrice) / (pointsCount - 1);
  const volatility = currentPrice * 0.012;

  // Pseudo-random deterministic seed based on ticker
  let seed = stock.ticker.split("").reduce((acc, c) => acc + c.charCodeAt(0), 0);
  const random = () => {
    seed = (seed * 9301 + 49297) % 233280;
    return seed / 233280;
  };

  for (let i = 0; i < pointsCount; i++) {
    const progress = i / (pointsCount - 1);
    const noise = (random() - 0.48) * volatility;
    
    // Wave motion for realistic financial chart look
    const wave = Math.sin(progress * Math.PI * 2.5) * (volatility * 0.8);
    
    if (i === pointsCount - 1) {
      rollingPrice = currentPrice;
    } else {
      rollingPrice = startPrice + priceStep * i + noise + wave;
    }

    let timeLabel = "";
    if (timeframe === "1D") {
      const hour = Math.floor(9.5 + (i / pointsCount) * 6.5);
      const min = Math.floor(((i / pointsCount) * 390) % 60);
      timeLabel = `${hour > 12 ? hour - 12 : hour}:${min < 10 ? "0" : ""}${min} ${hour >= 12 ? "PM" : "AM"}`;
    } else if (timeframe === "1W") {
      const days = ["Mon", "Tue", "Wed", "Thu", "Fri"];
      const dayIdx = Math.floor((i / pointsCount) * 5);
      timeLabel = days[Math.min(dayIdx, 4)];
    } else if (timeframe === "1M") {
      timeLabel = `Day ${Math.floor(progress * 30) + 1}`;
    } else {
      const months = ["Jan", "Mar", "May", "Jul", "Sep", "Nov"];
      const mIdx = Math.floor((i / pointsCount) * months.length);
      timeLabel = months[Math.min(mIdx, months.length - 1)];
    }

    points.push({
      time: timeLabel,
      price: Math.max(0.1, Number(rollingPrice.toFixed(2))),
    });
  }

  return points;
}

/**
 * Fetch live prices from DexScreener or Solana market endpoints with fallback
 */
export async function fetchLiveSolPrice(): Promise<number> {
  try {
    const res = await fetch(
      "https://api.dexscreener.com/latest/dex/tokens/So11111111111111111111111111111111111111112",
      { cache: "no-store" }
    );
    if (res.ok) {
      const data = await res.json();
      const pair = data.pairs?.[0];
      if (pair?.priceUsd) {
        return parseFloat(pair.priceUsd);
      }
    }
  } catch (e) {
    // Fallback SOL price
  }
  return 152.4;
}
