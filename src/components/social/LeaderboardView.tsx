"use client";

import React from "react";
import {
  Trophy,
  Flame,
  TrendingUp,
  ExternalLink,
  Users,
  Award,
  Sparkles,
} from "lucide-react";
import { TokenizedStock, VERIFIED_TOKENIZED_STOCKS } from "@/lib/stocks";
import { formatCurrency, formatPercent, cn } from "@/lib/utils";
import { getExplorerUrl } from "@/lib/solana";

interface LeaderboardViewProps {
  stocks: TokenizedStock[];
  onSelectStock: (stock: TokenizedStock) => void;
}

export const LeaderboardView: React.FC<LeaderboardViewProps> = ({
  stocks,
  onSelectStock,
}) => {
  // Sort by highest community buy sentiment
  const sortedBySentiment = [...stocks].sort(
    (a, b) => b.buySentimentPct - a.buySentimentPct
  );

  return (
    <div className="w-full max-w-2xl mx-auto space-y-6 pb-20 sm:pb-8">
      {/* Leaderboard Header */}
      <div className="bg-surface-card border border-slate-800 rounded-3xl p-6 shadow-2xl relative overflow-hidden">
        <div className="absolute -top-24 -right-24 w-48 h-48 bg-amber-500/15 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -left-24 w-48 h-48 bg-solana-purple/15 rounded-full blur-3xl pointer-events-none" />

        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-amber-500 to-yellow-300 p-0.5 flex items-center justify-center">
            <div className="w-full h-full bg-background rounded-[14px] flex items-center justify-center">
              <Trophy className="w-5 h-5 text-amber-400" />
            </div>
          </div>
          <div>
            <h2 className="text-base font-bold text-white flex items-center gap-1.5">
              <span>Community Sentiment Rankings</span>
              <Flame className="w-4 h-4 text-amber-400 fill-amber-400" />
            </h2>
            <p className="text-xs text-slate-400">
              Ranked by % of TickStock swipers choosing to BUY vs SKIP
            </p>
          </div>
        </div>
      </div>

      {/* Rankings List */}
      <div className="space-y-2.5">
        {sortedBySentiment.map((stock, idx) => {
          const isTop3 = idx < 3;
          const isPositive = stock.change24h >= 0;

          return (
            <div
              key={stock.id}
              className={cn(
                "bg-surface-card hover:bg-surface-elevated border rounded-2xl p-4 transition-all flex items-center justify-between gap-3 shadow-lg",
                idx === 0
                  ? "border-amber-500/40 bg-gradient-to-r from-amber-500/5 to-transparent"
                  : idx === 1
                  ? "border-slate-400/30"
                  : idx === 2
                  ? "border-amber-700/30"
                  : "border-slate-800/90"
              )}
            >
              <div className="flex items-center gap-3.5">
                {/* Rank Number */}
                <div
                  className={cn(
                    "w-7 h-7 rounded-xl font-mono font-extrabold text-xs flex items-center justify-center shrink-0",
                    idx === 0
                      ? "bg-amber-400 text-black shadow-md shadow-amber-400/20"
                      : idx === 1
                      ? "bg-slate-300 text-black"
                      : idx === 2
                      ? "bg-amber-700 text-white"
                      : "bg-surface-elevated text-slate-400 border border-slate-700"
                  )}
                >
                  {idx + 1}
                </div>

                {/* Stock Details */}
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-extrabold text-white text-base">
                      ${stock.ticker}
                    </span>
                    <span className="text-[10px] text-slate-400 px-2 py-0.5 rounded bg-surface-elevated border border-slate-700 font-medium">
                      {stock.sector}
                    </span>
                    <a
                      href={getExplorerUrl(stock.mintAddress, "token")}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-slate-500 hover:text-solana-green transition-colors"
                      title="View Solscan"
                    >
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                  <p className="text-xs text-slate-400 font-medium truncate max-w-[200px] sm:max-w-xs">
                    {stock.name}
                  </p>
                </div>
              </div>

              {/* Sentiment & Price */}
              <div className="text-right">
                <div className="flex items-center justify-end gap-1 font-mono font-black text-sm text-solana-green">
                  <Flame className="w-3.5 h-3.5 text-solana-green fill-solana-green" />
                  <span>{stock.buySentimentPct}% BUY</span>
                </div>
                <div className="text-xs font-mono text-slate-300 flex items-center justify-end gap-1.5 mt-0.5">
                  <span>{formatCurrency(stock.basePrice)}</span>
                  <span
                    className={cn(
                      "font-semibold text-[11px]",
                      isPositive ? "text-gain" : "text-loss"
                    )}
                  >
                    {formatPercent(stock.change24h)}
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
