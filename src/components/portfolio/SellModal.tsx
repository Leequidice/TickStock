"use client";

import React, { useState } from "react";
import { X, Loader2, ArrowUpRight, TrendingDown, DollarSign } from "lucide-react";
import { TokenizedStock } from "@/lib/stocks";
import { TradePosition } from "@/lib/trade-store";
import { formatCurrency, cn } from "@/lib/utils";

interface SellModalProps {
  isOpen: boolean;
  onClose: () => void;
  position: TradePosition | null;
  stock: TokenizedStock | null;
  network: "devnet" | "mainnet";
  onConfirmSell: (stock: TokenizedStock, sharesToSell: number, usdProceeds: number) => Promise<void>;
}

export const SellModal: React.FC<SellModalProps> = ({
  isOpen,
  onClose,
  position,
  stock,
  network,
  onConfirmSell,
}) => {
  const [sellPercentage, setSellPercentage] = useState<number>(100);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen || !position || !stock) return null;

  const currentPrice = stock.basePrice;
  const sharesToSell = sellPercentage === 100 ? position.shares : (position.shares * sellPercentage) / 100;
  const estimatedProceeds = Number((sharesToSell * currentPrice).toFixed(2));
  const currencySymbol = network === "mainnet" ? "USDC" : "dUSD";

  const handleSell = async () => {
    if (sharesToSell <= 0) return;
    setIsLoading(true);
    setError(null);
    try {
      await onConfirmSell(stock, sharesToSell, estimatedProceeds);
      setIsLoading(false);
      onClose();
    } catch (err: any) {
      setError(err.message || "Failed to execute sell order.");
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="bg-surface-card border border-slate-700/80 rounded-3xl max-w-md w-full p-6 shadow-2xl relative">
        <button
          onClick={onClose}
          disabled={isLoading}
          className="absolute top-5 right-5 text-slate-400 hover:text-white p-1 rounded-xl bg-surface-elevated hover:bg-slate-700 transition-colors"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Header */}
        <div className="flex items-center gap-3 mb-5">
          <div className="w-11 h-11 rounded-2xl bg-loss/20 border border-loss/40 flex items-center justify-center font-black text-loss text-sm font-mono shrink-0">
            ${stock.ticker}
          </div>
          <div>
            <h2 className="text-base font-black text-white">Sell ${stock.ticker}</h2>
            <p className="text-[11px] text-slate-400 font-mono">
              Live Market Price: {formatCurrency(currentPrice)}
            </p>
          </div>
        </div>

        {error && (
          <div className="p-3 mb-4 rounded-xl bg-loss/10 border border-loss/30 text-loss text-xs">
            {error}
          </div>
        )}

        {/* Current Position Summary */}
        <div className="bg-surface-elevated border border-slate-800 rounded-2xl p-4 mb-4 space-y-2">
          <div className="flex justify-between text-xs font-mono">
            <span className="text-slate-400">Total Owned:</span>
            <span className="font-bold text-white">{position.shares.toFixed(4)} shares</span>
          </div>
          <div className="flex justify-between text-xs font-mono">
            <span className="text-slate-400">Current Market Value:</span>
            <span className="font-bold text-white">{formatCurrency(position.currentValue)}</span>
          </div>
          <div className="flex justify-between text-xs font-mono pt-2 border-t border-slate-700/60">
            <span className="text-slate-400">Average Cost Basis:</span>
            <span className="text-slate-300">{formatCurrency(position.averageBuyPrice)}/share</span>
          </div>
        </div>

        {/* Percentage Selection */}
        <div className="mb-4">
          <label className="text-[11px] font-mono text-slate-400 mb-2 block">
            Select Amount to Sell:
          </label>
          <div className="grid grid-cols-4 gap-2 mb-3">
            {[25, 50, 75, 100].map((pct) => (
              <button
                key={pct}
                type="button"
                onClick={() => setSellPercentage(pct)}
                className={cn(
                  "py-2 rounded-xl text-xs font-mono font-bold transition-all border",
                  sellPercentage === pct
                    ? "bg-loss/20 border-loss text-loss shadow-sm"
                    : "bg-surface-elevated border-slate-700 text-slate-400 hover:text-white"
                )}
              >
                {pct === 100 ? "MAX" : `${pct}%`}
              </button>
            ))}
          </div>

          <div className="bg-background p-3 rounded-2xl border border-slate-800 flex items-center justify-between font-mono">
            <div>
              <div className="text-[10px] text-slate-500 uppercase">Selling Shares</div>
              <div className="text-base font-black text-white">{sharesToSell.toFixed(4)}</div>
            </div>
            <div className="text-right">
              <div className="text-[10px] text-slate-500 uppercase">Est. Proceeds</div>
              <div className="text-base font-black text-solana-green">
                +{formatCurrency(estimatedProceeds)} {currencySymbol}
              </div>
            </div>
          </div>
        </div>

        {/* Confirm Action Button */}
        <button
          type="button"
          disabled={isLoading || sharesToSell <= 0}
          onClick={handleSell}
          className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-loss to-red-600 hover:opacity-95 text-white font-black text-sm flex items-center justify-center gap-2 transition-all active:scale-98 shadow-lg shadow-loss/20 disabled:opacity-50"
        >
          {isLoading ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>Executing On-Chain Sell...</span>
            </>
          ) : (
            <>
              <TrendingDown className="w-4 h-4" />
              <span>Confirm Sell • Receive +${estimatedProceeds} {currencySymbol}</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
};
