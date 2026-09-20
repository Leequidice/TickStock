"use client";

import React, { useState, useEffect } from "react";
import { motion, useMotionValue, useTransform, PanInfo } from "framer-motion";
import {
  ExternalLink,
  TrendingUp,
  TrendingDown,
  Sparkles,
  Users,
  CheckCircle2,
  X,
  Zap,
  Newspaper,
  Briefcase,
  Rocket,
} from "lucide-react";
import { TokenizedStock } from "@/lib/stocks";
import { TradePosition } from "@/lib/trade-store";
import { StockChart } from "./StockChart";
import { formatCurrency, formatPercent, cn } from "@/lib/utils";
import { getExplorerUrl } from "@/lib/solana";

interface StockCardProps {
  stock: TokenizedStock;
  tradeAmount: number;
  onSwipeRight: (stock: TokenizedStock) => void;
  onSwipeLeft: (stock: TokenizedStock) => void;
  isActive: boolean;
  position?: TradePosition;
  onSellClick?: (stock: TokenizedStock, position: TradePosition) => void;
}

// Client-side cache to avoid refetching on card rerenders
const clientNewsCache = new Map<string, { headline: string; source?: string }>();

export const StockCard: React.FC<StockCardProps> = ({
  stock,
  tradeAmount,
  onSwipeRight,
  onSwipeLeft,
  isActive,
  position,
  onSellClick,
}) => {
  const [exitX, setExitX] = useState<number>(0);
  const [newsHeadline, setNewsHeadline] = useState<string>(
    clientNewsCache.get(stock.ticker)?.headline || "Loading latest market news..."
  );
  const [newsSource, setNewsSource] = useState<string | undefined>(
    clientNewsCache.get(stock.ticker)?.source
  );

  const x = useMotionValue(0);
  const y = useMotionValue(0);

  // Rotation and stamp opacity transforms based on drag distance
  const rotate = useTransform(x, [-200, 200], [-15, 15]);
  const buyStampOpacity = useTransform(x, [20, 100], [0, 1]);
  const buyStampScale = useTransform(x, [20, 100], [0.8, 1.05]);

  const skipStampOpacity = useTransform(x, [-20, -100], [0, 1]);
  const skipStampScale = useTransform(x, [-20, -100], [0.8, 1.05]);

  const isPositive = stock.change24h >= 0;

  // Fetch real live news headline
  useEffect(() => {
    let isMounted = true;
    const cached = clientNewsCache.get(stock.ticker);
    if (cached) {
      setNewsHeadline(cached.headline);
      setNewsSource(cached.source);
      return;
    }

    const fetchNews = async () => {
      try {
        const res = await fetch(
          `/api/news?ticker=${encodeURIComponent(stock.ticker)}&name=${encodeURIComponent(stock.name)}`
        );
        if (res.ok && isMounted) {
          const data = await res.json();
          if (data.news && data.news.length > 0 && data.news[0].headline) {
            const topHeadline = data.news[0].headline;
            const src = data.news[0].source;
            clientNewsCache.set(stock.ticker, { headline: topHeadline, source: src });
            setNewsHeadline(topHeadline);
            setNewsSource(src);
            return;
          }
        }
      } catch (err) {
        console.warn(`[StockCard] Could not fetch real news for ${stock.ticker}:`, err);
      }
      if (isMounted) {
        const fallback = "No recent news";
        clientNewsCache.set(stock.ticker, { headline: fallback });
        setNewsHeadline(fallback);
      }
    };

    fetchNews();
    return () => {
      isMounted = false;
    };
  }, [stock.ticker, stock.name]);

  const handleDragEnd = (
    event: MouseEvent | TouchEvent | PointerEvent,
    info: PanInfo
  ) => {
    const threshold = 90;
    const velocityThreshold = 400;

    if (info.offset.x > threshold || info.velocity.x > velocityThreshold) {
      // Swiped Right -> Buy
      setExitX(400);
      onSwipeRight(stock);
    } else if (info.offset.x < -threshold || info.velocity.x < -velocityThreshold) {
      // Swiped Left -> Skip
      setExitX(-400);
      onSwipeLeft(stock);
    }
  };

  if (!isActive) return null;

  return (
    <motion.div
      style={{ x, y, rotate }}
      drag="x"
      dragConstraints={{ left: 0, right: 0 }}
      dragElastic={0.7}
      onDragEnd={handleDragEnd}
      animate={{ x: exitX }}
      transition={{ type: "spring", stiffness: 300, damping: 20 }}
      className="w-full max-w-md h-[620px] sm:h-[660px] bg-surface-card border border-slate-800 rounded-3xl p-5 shadow-2xl relative overflow-hidden flex flex-col justify-between select-none touch-pan-y cursor-grab active:cursor-grabbing"
    >
      {/* Background ambient glow */}
      <div
        className={cn(
          "absolute -top-32 -right-32 w-64 h-64 rounded-full blur-3xl pointer-events-none opacity-20",
          isPositive ? "bg-solana-green" : "bg-loss"
        )}
      />

      {/* Dynamic Overlay Stamp: BUY */}
      <motion.div
        style={{ opacity: buyStampOpacity, scale: buyStampScale }}
        className="absolute top-12 left-6 z-40 border-4 border-solana-green bg-surface/90 text-solana-green font-extrabold text-2xl tracking-wider px-4 py-2 rounded-2xl rotate-[-12deg] pointer-events-none shadow-2xl flex items-center gap-2"
      >
        <Zap className="w-6 h-6 fill-solana-green" />
        <span>BUY ${tradeAmount}</span>
      </motion.div>

      {/* Dynamic Overlay Stamp: SKIP */}
      <motion.div
        style={{ opacity: skipStampOpacity, scale: skipStampScale }}
        className="absolute top-12 right-6 z-40 border-4 border-loss bg-surface/90 text-loss font-extrabold text-2xl tracking-wider px-4 py-2 rounded-2xl rotate-[12deg] pointer-events-none shadow-2xl flex items-center gap-2"
      >
        <X className="w-6 h-6 stroke-[3]" />
        <span>PASS</span>
      </motion.div>

      {/* Top Header: Stock Logo, Ticker, Name, Sector, Devnet Mint Explorer Link */}
      <div>
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="flex items-center gap-3">
            {/* Logo / Badge */}
            <div className="w-12 h-12 rounded-2xl bg-surface-elevated border border-slate-700/80 p-2 flex items-center justify-center shrink-0 shadow-lg">
              <span className="font-extrabold text-sm text-white font-mono tracking-tighter">
                ${stock.ticker}
              </span>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-black text-white tracking-tight">
                  {stock.ticker}
                </h2>
                {stock.isDbc || stock.ticker === "AERO" ? (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-solana-green/20 border border-solana-green/50 text-solana-green text-[10px] font-mono font-black">
                    <Rocket className="w-2.5 h-2.5" />
                    <span>New Listing (DBC)</span>
                  </span>
                ) : (
                  <a
                    href={getExplorerUrl(stock.mintAddress, "token")}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-solana-purple/15 hover:bg-solana-purple/30 border border-solana-purple/40 text-solana-purple text-[10px] font-mono font-bold transition-colors"
                    title="View SPL Mint on Solana Devnet Explorer"
                  >
                    <CheckCircle2 className="w-3 h-3 text-solana-green" />
                    <span>Devnet SPL</span>
                    <ExternalLink className="w-2.5 h-2.5" />
                  </a>
                )}
              </div>
              <p className="text-xs text-slate-400 font-medium truncate max-w-[180px]">
                {stock.name}
              </p>
            </div>
          </div>

          {/* Sector / DBC Pill */}
          <span className={cn(
            "px-2.5 py-1 rounded-full border text-[10px] font-semibold tracking-wide",
            stock.isDbc || stock.ticker === "AERO"
              ? "bg-solana-green/10 border-solana-green/40 text-solana-green font-mono font-bold"
              : "bg-surface-elevated border-slate-700/80 text-slate-300"
          )}>
            {stock.isDbc || stock.ticker === "AERO" ? "Meteora DBC" : stock.sector}
          </span>
        </div>

        {/* Live Price & 24h Performance Bar */}
        <div className="flex items-baseline justify-between py-2 border-y border-slate-800/80">
          <div>
            <div className="text-[10px] uppercase font-mono text-slate-500">
              Devnet Sim Price
            </div>
            <div className="text-3xl font-black text-white font-mono tracking-tight">
              {formatCurrency(stock.basePrice)}
            </div>
          </div>
          <div className="text-right">
            <div className="text-[10px] uppercase font-mono text-slate-500">
              24h Change
            </div>
            <div
              className={cn(
                "inline-flex items-center gap-1 text-base font-extrabold font-mono",
                isPositive ? "text-gain" : "text-loss"
              )}
            >
              {isPositive ? (
                <TrendingUp className="w-4 h-4 text-gain" />
              ) : (
                <TrendingDown className="w-4 h-4 text-loss" />
              )}
              <span>{formatPercent(stock.change24h)}</span>
            </div>
          </div>
        </div>

        {/* User Owned Holding Banner if holding > 0 */}
        {position && position.shares > 0 && (
          <div className="mt-2 flex items-center justify-between bg-solana-purple/15 border border-solana-purple/40 px-3 py-1.5 rounded-xl text-xs font-mono animate-in fade-in duration-200">
            <div className="flex items-center gap-1.5 text-solana-purple">
              <Briefcase className="w-3.5 h-3.5 shrink-0" />
              <span className="font-bold">
                Holding: {position.shares.toFixed(4)} shares ({formatCurrency(position.currentValue)})
              </span>
            </div>
            {onSellClick && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onSellClick(stock, position);
                }}
                className="px-2.5 py-0.5 rounded-lg bg-loss/20 hover:bg-loss/30 text-loss border border-loss/40 text-[10px] font-bold transition-colors cursor-pointer"
              >
                Sell
              </button>
            )}
          </div>
        )}
      </div>

      {/* Middle: Interactive Sparkline Chart */}
      <div className="my-1">
        <StockChart stock={stock} />
      </div>

      {/* Key Stats Strip */}
      <div className="grid grid-cols-3 gap-2 bg-surface-elevated/70 border border-slate-800/80 rounded-2xl p-2.5 text-center text-xs font-mono">
        <div>
          <div className="text-[10px] text-slate-500 uppercase">Mkt Cap</div>
          <div className="font-bold text-slate-200">{stock.marketCap}</div>
        </div>
        <div>
          <div className="text-[10px] text-slate-500 uppercase">24h Vol</div>
          <div className="font-bold text-slate-200">{stock.volume24h}</div>
        </div>
        <div>
          <div className="text-[10px] text-slate-500 uppercase">Underlying</div>
          <div className="font-bold text-solana-blue truncate px-1">
            {stock.underlyingAsset.split(":")[1] || stock.ticker}
          </div>
        </div>
      </div>

      {/* "Why It's Moving" Real News Insight Capsule */}
      <div className="bg-gradient-to-br from-surface-elevated/90 to-surface border border-slate-800 rounded-2xl p-3 relative overflow-hidden">
        <div className="flex items-center justify-between gap-1 text-[11px] font-bold text-solana-green mb-1.5">
          <div className="flex items-center gap-1.5">
            <Newspaper className="w-3.5 h-3.5 text-solana-green" />
            <span>Why It&apos;s Moving</span>
          </div>
          {newsSource && (
            <span className="text-[9px] font-mono text-slate-400 font-normal truncate max-w-[120px]">
              {newsSource}
            </span>
          )}
        </div>
        <p className="text-xs text-slate-200 font-medium leading-relaxed line-clamp-2">
          {newsHeadline}
        </p>

        {/* Catalyst Pills */}
        <div className="flex flex-wrap gap-1.5 mt-2">
          {stock.catalystPills.map((pill, idx) => (
            <span
              key={idx}
              className="text-[9px] font-mono font-medium px-2 py-0.5 rounded-md bg-surface-card border border-slate-700/60 text-slate-400"
            >
              #{pill}
            </span>
          ))}
        </div>
      </div>

      {/* Community Vibe & Sentiment Meter */}
      <div className="space-y-1">
        <div className="flex items-center justify-between text-[11px] font-medium text-slate-400">
          <div className="flex items-center gap-1.5">
            <Users className="w-3.5 h-3.5 text-solana-purple" />
            <span>Community Sentiment</span>
          </div>
          <span className="text-solana-green font-mono font-bold">
            {stock.buySentimentPct}% Buyers
          </span>
        </div>
        <div className="w-full h-1.5 bg-surface-elevated rounded-full overflow-hidden flex">
          <div
            className="h-full bg-gradient-to-r from-solana-purple to-solana-green rounded-full transition-all duration-500"
            style={{ width: `${stock.buySentimentPct}%` }}
          />
        </div>
      </div>

      {/* Bottom Action Controls */}
      <div className="grid grid-cols-2 gap-3 pt-2">
        <button
          onClick={(e) => {
            e.stopPropagation();
            setExitX(-400);
            onSwipeLeft(stock);
          }}
          className="w-full py-3 px-4 rounded-2xl bg-surface-elevated hover:bg-slate-800 border border-slate-700/80 text-slate-300 font-bold text-sm flex items-center justify-center gap-2 transition-all active:scale-95 shadow-md"
        >
          <X className="w-4 h-4 text-loss stroke-[2.5]" />
          <span>Skip (Left)</span>
        </button>

        <button
          onClick={(e) => {
            e.stopPropagation();
            setExitX(400);
            onSwipeRight(stock);
          }}
          className="w-full py-3 px-4 rounded-2xl bg-gradient-to-r from-solana-green to-emerald-400 hover:opacity-95 text-slate-950 font-black text-sm flex items-center justify-center gap-2 transition-all active:scale-95 shadow-lg shadow-solana-green/20"
        >
          <Zap className="w-4 h-4 fill-black" />
          <span>BUY ${tradeAmount}</span>
        </button>
      </div>
    </motion.div>
  );
};
