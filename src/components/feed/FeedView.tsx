"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import { useWallet, useConnection } from "@solana/wallet-adapter-react";
import {
  Zap,
  CheckCircle2,
  ExternalLink,
  AlertCircle,
  Loader2,
  ArrowDownLeft,
} from "lucide-react";
import { TokenizedStock } from "@/lib/stocks";
import { StockCard } from "./StockCard";
import {
  saveTradeTransaction,
  TradeTransaction,
  TradePosition,
} from "@/lib/trade-store";
import {
  executeAtomicSwipeBuy,
  executeAtomicSwipeSell,
  ExecutionResult,
} from "@/lib/trade-execution";
import {
  executeMainnetJupiterSwap,
  executeMainnetClientKeypairSwap,
  executeMainnetClientKeypairSell,
  executeMainnetJupiterSell,
} from "@/lib/jupiter";
import { formatCurrency, cn } from "@/lib/utils";
import { Keypair, PublicKey } from "@solana/web3.js";
import { SellModal } from "../portfolio/SellModal";
import { Briefcase, X } from "lucide-react";

interface FeedViewProps {
  network: "devnet" | "mainnet";
  stocks: TokenizedStock[];
  tradeAmount: number;
  onChangeTradeAmount?: (val: number) => void;
  cashBalance: number;
  solBalance?: number;
  activeWalletPubkey: PublicKey;
  isCustodial: boolean;
  custodialSecretKeyBase64?: string;
  mainnetClientKeypair?: Keypair | null;
  positions?: TradePosition[];
  onTradeExecuted: () => void;
  onRequestDusdFaucet: () => void;
  onOpenRiskModal?: () => void;
  onOpenDepositModal?: () => void;
  onOpenAuthModal?: () => void;
  onNavigatePortfolio?: () => void;
  hasAcceptedRisk?: boolean;
}

export const FeedView: React.FC<FeedViewProps> = ({
  network,
  stocks,
  tradeAmount,
  onChangeTradeAmount,
  cashBalance,
  solBalance = 0,
  activeWalletPubkey,
  isCustodial,
  custodialSecretKeyBase64,
  mainnetClientKeypair,
  positions = [],
  onTradeExecuted,
  onRequestDusdFaucet,
  onOpenRiskModal,
  onOpenDepositModal,
  onOpenAuthModal,
  onNavigatePortfolio,
  hasAcceptedRisk = true,
}) => {
  const { connected, publicKey: externalPublicKey, signTransaction, sendTransaction } = useWallet();
  const { connection } = useConnection();

  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedSellPosition, setSelectedSellPosition] = useState<TradePosition | null>(null);
  const [showAmountPicker, setShowAmountPicker] = useState(false);
  const [feedCustomAmount, setFeedCustomAmount] = useState("");
  const [lastNotification, setLastNotification] = useState<{
    type: "BUY" | "SKIP" | "SELL" | "ERROR";
    stock?: TokenizedStock;
    shares?: number;
    amount?: number;
    signature?: string;
    onChain?: boolean;
    explorerUrl?: string;
    errorMessage?: string;
    showDeposit?: boolean;
    showLogin?: boolean;
  } | null>(null);

  const stockMap = useMemo(() => new Map(stocks.map((s) => [s.id, s])), [stocks]);
  const positionMap = useMemo(() => new Map(positions.map((p) => [p.stockId, p])), [positions]);

  // Seamless endless feed: wrap around stock list indefinitely
  const activeStockIndex = stocks.length > 0 ? currentIndex % stocks.length : 0;
  const currentStock = stocks[activeStockIndex];

  const isMainnet = network === "mainnet";
  const currencySymbol = isMainnet ? "USDC" : "dUSD";

  const handleConfirmSell = async (
    stock: TokenizedStock,
    sharesToSell: number,
    usdProceeds: number
  ) => {
    if (isMainnet) {
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

      setLastNotification({
        type: "SELL",
        stock,
        shares: sharesToSell,
        amount: usdProceeds,
        signature: res.signature,
        onChain: true,
        explorerUrl: res.explorerUrl,
      });

      onTradeExecuted();
    } else {
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

      setLastNotification({
        type: "SELL",
        stock,
        shares: sharesToSell,
        amount: usdProceeds,
        signature: res.signature,
        onChain: true,
        explorerUrl: res.explorerUrl,
      });

      onTradeExecuted();
    }
  };

  const handleBuy = useCallback(
    async (stock: TokenizedStock) => {
      // Immediately advance card for seamless flow
      setCurrentIndex((prev) => prev + 1);

      // Mainnet Flow
      if (isMainnet) {
        const hasExternal = connected && !!externalPublicKey;
        const hasClientKeypair = !!mainnetClientKeypair;

        // Mainnet Guard 1: Must have either connected wallet or client self-custodial keypair
        if (!hasExternal && !hasClientKeypair) {
          setLastNotification({
            type: "ERROR",
            errorMessage: "Connect wallet or sign in to enable self-custodial Mainnet trading.",
            showLogin: true,
          });
          return;
        }

        // Mainnet Guard 2: Require risk acknowledgement
        if (!hasAcceptedRisk && onOpenRiskModal) {
          onOpenRiskModal();
          return;
        }

        // Mainnet Guard 3: Require sufficient real USDC
        if (cashBalance < tradeAmount) {
          setLastNotification({
            type: "ERROR",
            errorMessage: `Insufficient USDC (${cashBalance.toFixed(2)} available). Please add USDC to trade.`,
            showDeposit: true,
          });
          return;
        }

        // Mainnet Guard 4: Require minimum SOL for Solana network gas and token account rent
        if (solBalance < 0.002) {
          setLastNotification({
            type: "ERROR",
            errorMessage: `Insufficient SOL (${solBalance.toFixed(3)} SOL available). Solana requires ~0.003 SOL (~$0.40) for transaction fees and token account rent.`,
            showDeposit: true,
          });
          return;
        }

        try {
          let swapResult;

          if (hasClientKeypair && mainnetClientKeypair) {
            // IN-BROWSER SIGNING: Browser-held keypair signs transaction completely client-side
            swapResult = await executeMainnetClientKeypairSwap(
              mainnetClientKeypair,
              connection,
              stock,
              tradeAmount
            );
          } else {
            // External Connected Wallet (Phantom/Solflare)
            swapResult = await executeMainnetJupiterSwap(
              {
                publicKey: externalPublicKey!,
                signTransaction,
                sendTransaction,
              },
              connection,
              stock,
              tradeAmount
            );
          }

          if (!swapResult.success) {
            setLastNotification({
              type: "ERROR",
              errorMessage: swapResult.error || "Mainnet swap transaction failed.",
            });
            return;
          }

          setLastNotification({
            type: "BUY",
            stock,
            shares: swapResult.shares,
            amount: tradeAmount,
            signature: swapResult.signature,
            onChain: true,
            explorerUrl: swapResult.explorerUrl,
          });

          onTradeExecuted();
        } catch (err: any) {
          setLastNotification({
            type: "ERROR",
            errorMessage: err.message || "Mainnet swap execution error.",
          });
        }
        return;
      }

      // Devnet Flow
      if (cashBalance < tradeAmount) {
        setLastNotification({
          type: "ERROR",
          errorMessage: `Insufficient dUSD cash (${formatCurrency(cashBalance)}). Claim +$1K dUSD.`,
        });
        return;
      }

      try {
        // DBC Fair Launch Flow
        if (stock.isDbc || stock.ticker === "AERO" || stock.id.startsWith("dbc-")) {
          const dbcRes = await fetch("/api/launch/swap", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              userPublicKey: activeWalletPubkey.toBase58(),
              usdAmount: tradeAmount,
              network,
              stockId: stock.id,
            }),
          });
          const dbcData = await dbcRes.json();
          if (!dbcRes.ok || !dbcData.success) {
            setLastNotification({
              type: "ERROR",
              errorMessage: dbcData.error || "Meteora DBC trade execution failed.",
            });
            return;
          }
          setLastNotification({
            type: "BUY",
            stock,
            shares: dbcData.shares,
            amount: tradeAmount,
            signature: dbcData.signature,
            onChain: true,
            explorerUrl: dbcData.explorerUrl,
          });
          onTradeExecuted();
          return;
        }

        const result: ExecutionResult = await executeAtomicSwipeBuy(
          stock,
          tradeAmount,
          activeWalletPubkey,
          isCustodial,
          custodialSecretKeyBase64
        );

        if (!result.success) {
          setLastNotification({
            type: "ERROR",
            errorMessage: result.error || "Trade transaction failed.",
          });
          return;
        }

        setLastNotification({
          type: "BUY",
          stock,
          shares: result.shares,
          amount: tradeAmount,
          signature: result.signature,
          onChain: result.onChain,
          explorerUrl: result.explorerUrl,
        });

        onTradeExecuted();
      } catch (err: any) {
        setLastNotification({
          type: "ERROR",
          errorMessage: err.message || "Trade execution failed.",
        });
      }
    },
    [
      isMainnet,
      connected,
      externalPublicKey,
      mainnetClientKeypair,
      hasAcceptedRisk,
      onOpenRiskModal,
      cashBalance,
      tradeAmount,
      signTransaction,
      sendTransaction,
      connection,
      activeWalletPubkey,
      isCustodial,
      custodialSecretKeyBase64,
      onTradeExecuted,
    ]
  );

  const handleSkip = useCallback(
    (stock: TokenizedStock) => {
      const tx: TradeTransaction = {
        id: `tx_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        stockId: stock.id,
        ticker: stock.ticker,
        type: "SKIP",
        usdAmount: 0,
        shares: 0,
        price: stock.basePrice,
        timestamp: Date.now(),
        isSimulated: true,
      };

      saveTradeTransaction(tx, network);

      setLastNotification({
        type: "SKIP",
        stock,
      });

      onTradeExecuted();

      setTimeout(() => {
        setCurrentIndex((prev) => prev + 1);
      }, 180);
    },
    [network, onTradeExecuted]
  );

  // Keyboard controls
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!currentStock) return;
      if (e.key === "ArrowRight" || e.key === "d" || e.key === "D") {
        handleBuy(currentStock);
      } else if (e.key === "ArrowLeft" || e.key === "a" || e.key === "A") {
        handleSkip(currentStock);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [currentStock, handleBuy, handleSkip]);

  // Reset index if stocks change
  useEffect(() => {
    setCurrentIndex(0);
    setLastNotification(null);
  }, [network]);

  // Auto-dismiss notification after 4 seconds
  useEffect(() => {
    if (lastNotification) {
      const timer = setTimeout(() => {
        setLastNotification(null);
      }, 4000);
      return () => clearTimeout(timer);
    }
  }, [lastNotification]);

  return (
    <div className="w-full flex flex-col items-center justify-center relative min-h-[660px]">
      {/* Top-Right Notification Balloon */}
      {lastNotification && (
        <div className="fixed top-4 right-4 sm:top-5 sm:right-5 z-50 max-w-[340px] w-full animate-in fade-in slide-in-from-top-3 duration-200 pointer-events-auto">
          {lastNotification.type === "BUY" && lastNotification.stock ? (
            <div className="bg-surface-elevated/95 border border-solana-green/50 p-3 rounded-2xl shadow-2xl backdrop-blur-md flex items-center justify-between gap-2.5">
              <div className="flex items-center gap-2 min-w-0">
                <div className="w-6 h-6 rounded-lg bg-solana-green/20 flex items-center justify-center shrink-0">
                  <CheckCircle2 className="w-3.5 h-3.5 text-solana-green" />
                </div>
                <div className="min-w-0">
                  <div className="text-xs font-bold text-white truncate">
                    Bought ${lastNotification.stock.ticker} (${lastNotification.amount})
                  </div>
                  <div className="text-[10px] text-solana-green font-mono">
                    +{lastNotification.shares} shares
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-1.5 shrink-0">
                {onNavigatePortfolio && (
                  <button
                    onClick={onNavigatePortfolio}
                    className="px-2 py-1 rounded-xl bg-solana-purple/20 hover:bg-solana-purple/30 text-solana-purple border border-solana-purple/40 text-[10px] font-bold flex items-center gap-1 transition-colors cursor-pointer"
                    title="View Holdings in Portfolio"
                  >
                    <Briefcase className="w-3 h-3" />
                    <span>Holdings</span>
                  </button>
                )}
                <button
                  onClick={() => setLastNotification(null)}
                  className="text-slate-400 hover:text-white p-0.5"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ) : lastNotification.type === "SELL" && lastNotification.stock ? (
            <div className="bg-surface-elevated/95 border border-solana-green/50 p-3 rounded-2xl shadow-2xl backdrop-blur-md flex items-center justify-between gap-2.5">
              <div className="flex items-center gap-2 min-w-0">
                <div className="w-6 h-6 rounded-lg bg-solana-green/20 flex items-center justify-center shrink-0">
                  <CheckCircle2 className="w-3.5 h-3.5 text-solana-green" />
                </div>
                <div className="min-w-0">
                  <div className="text-xs font-bold text-white truncate">
                    Sold ${lastNotification.stock.ticker}
                  </div>
                  <div className="text-[10px] text-solana-green font-mono">
                    +{formatCurrency(lastNotification.amount || 0)} {currencySymbol}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-1.5 shrink-0">
                {onNavigatePortfolio && (
                  <button
                    onClick={onNavigatePortfolio}
                    className="px-2 py-1 rounded-xl bg-solana-purple/20 hover:bg-solana-purple/30 text-solana-purple border border-solana-purple/40 text-[10px] font-bold flex items-center gap-1 transition-colors cursor-pointer"
                  >
                    <Briefcase className="w-3 h-3" />
                    <span>Holdings</span>
                  </button>
                )}
                <button
                  onClick={() => setLastNotification(null)}
                  className="text-slate-400 hover:text-white p-0.5"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ) : lastNotification.type === "ERROR" ? (
            <div className="bg-surface-elevated/95 border border-amber-500/50 p-3 rounded-2xl shadow-2xl backdrop-blur-md flex items-center justify-between gap-2 text-xs text-amber-400">
              <div className="flex items-center gap-2 flex-1 min-w-0">
                <AlertCircle className="w-4 h-4 shrink-0 text-amber-400" />
                <span className="text-[11px] leading-tight text-amber-200 truncate">
                  {lastNotification.errorMessage}
                </span>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                {lastNotification.showDeposit && onOpenDepositModal && (
                  <button
                    onClick={onOpenDepositModal}
                    className="px-2 py-1 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-[10px] font-bold flex items-center gap-1 shadow-sm transition-colors"
                  >
                    <ArrowDownLeft className="w-3 h-3" />
                    <span>+Funds</span>
                  </button>
                )}
                {lastNotification.showLogin && onOpenAuthModal && (
                  <button
                    onClick={onOpenAuthModal}
                    className="px-2 py-1 rounded-xl bg-solana-purple hover:bg-purple-500 text-white text-[10px] font-bold shadow-sm transition-colors"
                  >
                    Sign In
                  </button>
                )}
                {!isMainnet && !lastNotification.showDeposit && !lastNotification.showLogin && (
                  <button
                    onClick={onRequestDusdFaucet}
                    className="px-2 py-1 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-[10px] font-bold text-amber-300"
                  >
                    +dUSD
                  </button>
                )}
                <button
                  onClick={() => setLastNotification(null)}
                  className="text-slate-400 hover:text-white p-0.5 ml-1"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ) : (
            <div className="bg-surface-elevated/95 border border-slate-700 p-2.5 rounded-2xl shadow-xl backdrop-blur-md text-center text-xs font-medium text-slate-400 flex items-center justify-between">
              <span>Skipped ${lastNotification.stock?.ticker}</span>
              <button
                onClick={() => setLastNotification(null)}
                className="text-slate-400 hover:text-white p-0.5 ml-2"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          )}
        </div>
      )}

      {/* Endless Main Stock Card */}
      {currentStock && (
        <div className="w-full flex flex-col items-center">
          <StockCard
            key={`${currentStock.id}_${currentIndex}`}
            stock={currentStock}
            tradeAmount={tradeAmount}
            onSwipeRight={handleBuy}
            onSwipeLeft={handleSkip}
            isActive={true}
            position={positionMap.get(currentStock.id)}
            onSellClick={(stock, pos) => setSelectedSellPosition(pos)}
          />
          {/* Trade Amount Control Beneath Card */}
          <div className="mt-3 flex flex-col items-center gap-2">
            <div className="flex items-center gap-2 text-xs font-mono">
              <span className="text-slate-400">
                Swipe right to buy: <strong className={isMainnet ? "text-amber-400" : "text-solana-green"}>${tradeAmount}</strong> {currencySymbol}
              </span>
              {onChangeTradeAmount && (
                <button
                  type="button"
                  onClick={() => setShowAmountPicker(!showAmountPicker)}
                  className="px-2 py-0.5 rounded-lg bg-surface-elevated hover:bg-slate-700 border border-slate-700 text-[11px] text-slate-300 hover:text-white transition-colors"
                >
                  {showAmountPicker ? "Close" : "Change $"}
                </button>
              )}
            </div>

            {/* Expandable Quick/Custom Amount Picker */}
            {showAmountPicker && onChangeTradeAmount && (
              <div className="bg-surface-card border border-slate-700 rounded-2xl p-3 shadow-2xl animate-in fade-in zoom-in-95 duration-150 flex flex-col gap-2 max-w-xs w-full">
                <div className="flex items-center justify-between gap-1">
                  {[10, 25, 50, 100].map((amt) => (
                    <button
                      key={amt}
                      type="button"
                      onClick={() => {
                        onChangeTradeAmount(amt);
                        setShowAmountPicker(false);
                      }}
                      className={cn(
                        "flex-1 py-1 rounded-xl text-xs font-mono font-bold border transition-all",
                        tradeAmount === amt
                          ? isMainnet
                            ? "bg-amber-500/20 border-amber-500 text-amber-400"
                            : "bg-solana-green/20 border-solana-green text-solana-green"
                          : "bg-surface-elevated border-slate-700 text-slate-300 hover:border-slate-500"
                      )}
                    >
                      ${amt}
                    </button>
                  ))}
                </div>

                {/* Custom Amount Field */}
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    const val = parseFloat(feedCustomAmount);
                    if (!isNaN(val) && val > 0) {
                      onChangeTradeAmount(Number(val.toFixed(2)));
                      setFeedCustomAmount("");
                      setShowAmountPicker(false);
                    }
                  }}
                  className="flex items-center gap-1.5 pt-1.5 border-t border-slate-800"
                >
                  <div className="relative flex-1">
                    <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 font-mono text-xs">$</span>
                    <input
                      type="number"
                      step="any"
                      min="0.01"
                      placeholder="Custom (e.g. 500)"
                      value={feedCustomAmount}
                      onChange={(e) => setFeedCustomAmount(e.target.value)}
                      className="w-full pl-6 pr-2 py-1 rounded-xl bg-background border border-slate-700 text-xs font-mono text-white focus:outline-none focus:border-solana-green"
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={!feedCustomAmount || parseFloat(feedCustomAmount) <= 0}
                    className={cn(
                      "px-3 py-1 rounded-xl text-xs font-bold font-mono transition-colors disabled:opacity-40",
                      isMainnet
                        ? "bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/40 text-amber-300"
                        : "bg-solana-green/20 hover:bg-solana-green/30 border border-solana-green/40 text-solana-green"
                    )}
                  >
                    Set
                  </button>
                </form>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Direct Sell Action Modal */}
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
