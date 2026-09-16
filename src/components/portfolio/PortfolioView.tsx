"use client";

import React, { useState } from "react";
import { useWallet, useConnection } from "@solana/wallet-adapter-react";
import { Keypair, PublicKey } from "@solana/web3.js";
import {
  TrendingUp,
  TrendingDown,
  Briefcase,
  ExternalLink,
  Trash2,
  Zap,
  Clock,
  CheckCircle2,
  XCircle,
  Coins,
  ArrowUpRight,
  DollarSign,
  ArrowDownLeft,
} from "lucide-react";
import { TokenizedStock } from "@/lib/stocks";
import {
  TradePosition,
  TradeTransaction,
  calculatePortfolioPositions,
  clearTradeHistory,
} from "@/lib/trade-store";
import { formatCurrency, formatPercent, cn } from "@/lib/utils";
import { getExplorerUrl } from "@/lib/solana";
import { executeAtomicSwipeSell } from "@/lib/trade-execution";
import { executeMainnetClientKeypairSell, executeMainnetJupiterSell } from "@/lib/jupiter";
import { SellModal } from "./SellModal";

interface PortfolioViewProps {
  network?: "devnet" | "mainnet";
  stocks: TokenizedStock[];
  transactions: TradeTransaction[];
  dusdBalance: number;
  activeWalletPubkey?: PublicKey;
  isCustodial?: boolean;
  custodialSecretKeyBase64?: string;
  mainnetClientKeypair?: Keypair | null;
  onTradeExecuted?: () => void;
  onPortfolioReset: () => void;
  onExploreFeed: () => void;
  onOpenTransfer: () => void;
}

export const PortfolioView: React.FC<PortfolioViewProps> = ({
  network = "devnet",
  stocks,
  transactions,
  dusdBalance,
  activeWalletPubkey,
  isCustodial = false,
  custodialSecretKeyBase64,
  mainnetClientKeypair,
  onTradeExecuted,
  onPortfolioReset,
  onExploreFeed,
  onOpenTransfer,
}) => {
  const { connected, publicKey: externalPublicKey, signTransaction, sendTransaction } = useWallet();
  const { connection } = useConnection();

  const [selectedSellPosition, setSelectedSellPosition] = useState<TradePosition | null>(null);
  const [sellSuccessToast, setSellSuccessToast] = useState<{
    ticker: string;
    shares: number;
    proceeds: number;
    signature?: string;
    explorerUrl?: string;
  } | null>(null);

  const {
    positions,
    totalValue,
    totalCost,
    totalPnlUsd,
    totalPnlPercent,
    totalBuys,
    totalSkips,
  } = calculatePortfolioPositions(stocks, transactions);

  const netWorth = totalValue + dusdBalance;
  const isPositive = totalPnlUsd >= 0;

  const stockMap = new Map(stocks.map((s) => [s.id, s]));
  const isMainnetMode = network === "mainnet";
  const currencySymbol = isMainnetMode ? "USDC" : "dUSD";

  const handleClear = () => {
    if (confirm("Reset portfolio and trade history for this network?")) {
      clearTradeHistory(isMainnetMode ? "mainnet" : "devnet");
      onPortfolioReset();
    }
  };

  const handleConfirmSell = async (
    stock: TokenizedStock,
    sharesToSell: number,
    usdProceeds: number
  ) => {
    if (isMainnetMode) {
      // Mainnet Sell Flow
      const hasExternal = connected && !!externalPublicKey;
      const hasClientKeypair = !!mainnetClientKeypair;

      if (!hasExternal && !hasClientKeypair) {
        throw new Error("No active Mainnet wallet available for selling.");
      }

      let res;
      if (hasClientKeypair && mainnetClientKeypair) {
        res = await executeMainnetClientKeypairSell(
          mainnetClientKeypair,
          connection,
          stock,
          sharesToSell
        );
      } else {
        res = await executeMainnetJupiterSell(
          {
            publicKey: externalPublicKey!,
            signTransaction,
            sendTransaction,
          },
          connection,
          stock,
          sharesToSell
        );
      }

      if (!res.success) {
        throw new Error(res.error || "Mainnet sell transaction failed.");
      }

      setSellSuccessToast({
        ticker: stock.ticker,
        shares: sharesToSell,
        proceeds: usdProceeds,
        signature: res.signature,
        explorerUrl: res.explorerUrl,
      });

      if (onTradeExecuted) onTradeExecuted();
    } else {
      // Devnet Sell Flow (Atomic on-chain burn & mint)
      if (!activeWalletPubkey) {
        throw new Error("No active wallet public key.");
      }

      const res = await executeAtomicSwipeSell(
        stock,
        sharesToSell,
        activeWalletPubkey,
        isCustodial,
        custodialSecretKeyBase64
      );

      if (!res.success) {
        throw new Error(res.error || "Devnet atomic sell execution failed.");
      }

      setSellSuccessToast({
        ticker: stock.ticker,
        shares: sharesToSell,
        proceeds: usdProceeds,
        signature: res.signature,
        explorerUrl: res.explorerUrl,
      });

      if (onTradeExecuted) onTradeExecuted();
    }
  };

  return (
    <div className="w-full max-w-2xl mx-auto space-y-6 pb-20 sm:pb-8 relative">
      {/* Sell Success Banner */}
      {sellSuccessToast && (
        <div className="bg-surface-elevated border border-solana-green/40 p-4 rounded-2xl shadow-2xl flex items-center justify-between gap-3 animate-in fade-in slide-in-from-top-3 duration-300">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-solana-green/20 flex items-center justify-center shrink-0">
              <CheckCircle2 className="w-5 h-5 text-solana-green" />
            </div>
            <div>
              <div className="text-xs font-bold text-white">
                Sold {sellSuccessToast.shares.toFixed(4)} ${sellSuccessToast.ticker} for +${sellSuccessToast.proceeds.toFixed(2)} {currencySymbol}! 🎉
              </div>
              {sellSuccessToast.explorerUrl && (
                <a
                  href={sellSuccessToast.explorerUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[10px] text-solana-blue hover:underline inline-flex items-center gap-1 font-mono mt-0.5"
                >
                  <span>View on Explorer #{sellSuccessToast.signature?.slice(0, 8)}</span>
                  <ExternalLink className="w-2.5 h-2.5" />
                </a>
              )}
            </div>
          </div>
          <button
            onClick={() => setSellSuccessToast(null)}
            className="text-slate-400 hover:text-white p-1"
          >
            ×
          </button>
        </div>
      )}

      {/* Portfolio Overview Card */}
      <div className="bg-surface-card border border-slate-800 rounded-3xl p-6 shadow-2xl relative overflow-hidden">
        <div className="absolute -top-24 -right-24 w-48 h-48 bg-solana-purple/20 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -left-24 w-48 h-48 bg-solana-green/15 rounded-full blur-3xl pointer-events-none" />

        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-xl bg-surface-elevated border border-slate-700 flex items-center justify-center">
              <Briefcase className={cn("w-4 h-4", isMainnetMode ? "text-amber-400" : "text-solana-green")} />
            </div>
            <div>
              <h2 className="text-sm font-bold text-white">
                {isMainnetMode ? "Mainnet xStocks Portfolio" : "Solana Devnet Portfolio"}
              </h2>
              <p className="text-[10px] text-slate-400 font-mono">
                {isMainnetMode ? "Real Token-2022 Holdings" : "Atomic Devnet Holdings"}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {!isMainnetMode && (
              <button
                onClick={onOpenTransfer}
                className="flex items-center gap-1 px-2.5 py-1 rounded-xl bg-surface-elevated hover:bg-slate-700 border border-slate-700 text-xs font-semibold text-slate-200 transition-colors"
                title="Transfer all assets to external Phantom wallet"
              >
                <ArrowUpRight className="w-3.5 h-3.5 text-solana-blue" />
                <span>Migrate to Wallet</span>
              </button>
            )}

            {transactions.length > 0 && (
              <button
                onClick={handleClear}
                className="text-slate-500 hover:text-loss transition-colors p-2 rounded-xl hover:bg-loss/10"
                title="Reset Portfolio"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {/* Total Value & PnL */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 py-3 border-y border-slate-800/80">
          <div>
            <div className="text-[11px] font-mono text-slate-400 uppercase">
              Total Account Net Worth
            </div>
            <div className="text-3xl font-black text-white font-mono tracking-tight mt-0.5">
              {formatCurrency(netWorth)}
            </div>
            <div className="text-[11px] text-slate-400 font-mono mt-0.5 flex items-center gap-2">
              <span>Cash: <strong className={isMainnetMode ? "text-amber-400" : "text-solana-green"}>{formatCurrency(dusdBalance)}</strong> {currencySymbol}</span>
              <span>•</span>
              <span>Stocks: <strong>{formatCurrency(totalValue)}</strong></span>
            </div>
          </div>

          <div className="sm:text-right">
            <div className="text-[11px] font-mono text-slate-400 uppercase">
              Unrealized P&L
            </div>
            <div
              className={cn(
                "inline-flex items-center gap-1.5 text-2xl font-black font-mono mt-0.5",
                isPositive ? "text-gain" : "text-loss"
              )}
            >
              {isPositive ? (
                <TrendingUp className="w-5 h-5 text-gain" />
              ) : (
                <TrendingDown className="w-5 h-5 text-loss" />
              )}
              <span>{formatCurrency(totalPnlUsd)}</span>
              <span className="text-sm font-semibold">
                ({formatPercent(totalPnlPercent)})
              </span>
            </div>
            <div className="text-[11px] text-slate-500 font-mono mt-0.5">
              {totalBuys} Trades Recorded
            </div>
          </div>
        </div>
      </div>

      {/* Holdings List with Sell Buttons */}
      <div className="space-y-3">
        <div className="flex items-center justify-between px-1">
          <h3 className="text-sm font-bold text-white flex items-center gap-1.5">
            <span>Stock Holdings</span>
            <span className="text-xs text-slate-500 font-mono">
              ({positions.length})
            </span>
          </h3>
          <span className="text-[11px] font-mono text-slate-400">
            Current Value / Action
          </span>
        </div>

        {positions.length > 0 ? (
          <div className="space-y-2">
            {positions.map((pos) => {
              const stock = stockMap.get(pos.stockId);
              const posPositive = pos.pnlUsd >= 0;

              return (
                <div
                  key={pos.stockId}
                  className="bg-surface-card hover:bg-surface-elevated/80 border border-slate-800 rounded-2xl p-4 transition-all flex items-center justify-between gap-3 shadow-lg"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-surface-elevated border border-slate-700 p-1 flex items-center justify-center font-black text-xs text-white font-mono shrink-0">
                      ${pos.ticker}
                    </div>
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="font-extrabold text-white text-sm">
                          {pos.ticker}
                        </span>
                        {stock && (
                          <a
                            href={getExplorerUrl(stock.mintAddress, "token", isMainnetMode ? "mainnet" : "devnet")}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-slate-500 hover:text-solana-green transition-colors"
                            title="View on Solana Explorer"
                          >
                            <ExternalLink className="w-3 h-3" />
                          </a>
                        )}
                      </div>
                      <div className="text-xs text-slate-400 font-mono">
                        {pos.shares.toFixed(4)} shares @ {formatCurrency(pos.averageBuyPrice)}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <div className="font-mono font-bold text-white text-sm">
                        {formatCurrency(pos.currentValue)}
                      </div>
                      <div
                        className={cn(
                          "text-xs font-mono font-semibold",
                          posPositive ? "text-gain" : "text-loss"
                        )}
                      >
                        {formatPercent(pos.pnlPercent)} ({formatCurrency(pos.pnlUsd)})
                      </div>
                    </div>

                    {/* Sell Button */}
                    <button
                      type="button"
                      onClick={() => setSelectedSellPosition(pos)}
                      className="px-3 py-1.5 rounded-xl bg-loss/15 hover:bg-loss/25 text-loss hover:text-red-300 font-bold font-mono text-xs border border-loss/30 transition-colors shadow-sm"
                      title={`Sell $${pos.ticker}`}
                    >
                      Sell
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="bg-surface-card border border-slate-800 rounded-2xl p-8 text-center">
            <p className="text-sm text-slate-400 mb-3">
              No stock positions yet. Start swiping on the feed to swap your {currencySymbol}!
            </p>
            <button
              onClick={onExploreFeed}
              className="py-2.5 px-4 rounded-xl bg-solana-green/20 hover:bg-solana-green/30 border border-solana-green/40 text-solana-green font-bold text-xs transition-colors"
            >
              Start Swiping
            </button>
          </div>
        )}
      </div>

      {/* Swipe History Activity Log */}
      {transactions.length > 0 && (
        <div className="space-y-3 pt-2">
          <h3 className="text-sm font-bold text-white px-1 flex items-center gap-1.5">
            <Clock className="w-4 h-4 text-solana-purple" />
            <span>Recent Trade Activity</span>
          </h3>

          <div className="bg-surface-card border border-slate-800 rounded-2xl divide-y divide-slate-800/80 max-h-72 overflow-y-auto">
            {transactions.slice(0, 15).map((tx) => (
              <div
                key={tx.id}
                className="p-3.5 flex items-center justify-between text-xs"
              >
                <div className="flex items-center gap-2.5">
                  {tx.type === "BUY" ? (
                    <div className="w-7 h-7 rounded-lg bg-solana-green/20 flex items-center justify-center shrink-0">
                      <CheckCircle2 className="w-4 h-4 text-solana-green" />
                    </div>
                  ) : tx.type === "SELL" ? (
                    <div className="w-7 h-7 rounded-lg bg-loss/20 flex items-center justify-center shrink-0">
                      <TrendingDown className="w-4 h-4 text-loss" />
                    </div>
                  ) : (
                    <div className="w-7 h-7 rounded-lg bg-slate-800 flex items-center justify-center shrink-0">
                      <XCircle className="w-4 h-4 text-slate-400" />
                    </div>
                  )}
                  <div>
                    <div className="font-bold text-white flex items-center gap-1.5">
                      <span>
                        {tx.type === "BUY"
                          ? isMainnetMode
                            ? "Jupiter Buy"
                            : "Atomic Buy"
                          : tx.type === "SELL"
                          ? isMainnetMode
                            ? "Jupiter Sell"
                            : "Atomic Sell"
                          : "Skipped"}
                      </span>
                      <span className={tx.type === "SELL" ? "text-loss" : "text-solana-blue"}>
                        ${tx.ticker}
                      </span>
                    </div>
                    <div className="text-[10px] text-slate-500 font-mono">
                      {new Date(tx.timestamp).toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                        second: "2-digit",
                      })}
                    </div>
                  </div>
                </div>

                <div className="text-right font-mono">
                  {tx.type === "BUY" ? (
                    <>
                      <div className="font-bold text-white">
                        -${tx.usdAmount} {currencySymbol}
                      </div>
                      <div className="text-[10px] text-solana-green">
                        +{tx.shares.toFixed(4)} ${tx.ticker}
                      </div>
                    </>
                  ) : tx.type === "SELL" ? (
                    <>
                      <div className="font-bold text-solana-green">
                        +{formatCurrency(tx.usdAmount)} {currencySymbol}
                      </div>
                      <div className="text-[10px] text-loss">
                        -{tx.shares.toFixed(4)} ${tx.ticker}
                      </div>
                    </>
                  ) : (
                    <span className="text-slate-500 font-medium">Passed</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Sell Action Modal */}
      <SellModal
        isOpen={!!selectedSellPosition}
        onClose={() => setSelectedSellPosition(null)}
        position={selectedSellPosition}
        stock={selectedSellPosition ? stockMap.get(selectedSellPosition.stockId) || null : null}
        network={network}
        onConfirmSell={handleConfirmSell}
      />
    </div>
  );
};
