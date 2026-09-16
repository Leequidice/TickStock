"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { useSession } from "next-auth/react";
import { Connection, Keypair, PublicKey } from "@solana/web3.js";
import bs58 from "bs58";
import {
  DEVNET_MOCK_STOCKS,
  MAINNET_XSTOCKS,
  DUSD_MINT_ADDRESS,
  MAINNET_USDC_MINT,
  getStocksForNetwork,
  getCurrencyForNetwork,
  TokenizedStock,
} from "@/lib/stocks";
import { HeaderBar } from "@/components/common/HeaderBar";
import { BottomNav } from "@/components/common/BottomNav";
import { FeedView } from "@/components/feed/FeedView";
import { PortfolioView } from "@/components/portfolio/PortfolioView";
import { LeaderboardView } from "@/components/social/LeaderboardView";
import { LaunchView } from "@/components/launch/LaunchView";
import { DemoGuideModal } from "@/components/common/DemoGuideModal";
import { DelegationModal } from "@/components/common/DelegationModal";
import { TransferModal } from "@/components/common/TransferModal";
import { MainnetRiskModal } from "@/components/common/MainnetRiskModal";
import { WalletBackupModal } from "@/components/common/WalletBackupModal";
import { DepositModal } from "@/components/common/DepositModal";
import { AuthModal } from "@/components/auth/AuthModal";
import {
  getPreferredTradeAmount,
  setPreferredTradeAmount,
  getTradeHistory,
  TradeTransaction,
  calculatePortfolioPositions,
  hasAcceptedMainnetRisk,
  setAcceptedMainnetRisk,
} from "@/lib/trade-store";
import { getSplTokenBalance, getSolanaConnection, DEVNET_RPC_ENDPOINT, MAINNET_RPC_ENDPOINT } from "@/lib/solana";
import {
  getOrCreateInAppWallet,
  hasClaimedInitialDusd,
  setClaimedInitialDusd,
  UserProfile,
  getActiveUserProfile,
  fetchOrCreateServerCustodialWallet,
} from "@/lib/custodial-wallet";
import {
  getUnlockedClientSession,
  hasBackedUpClientWallet,
  setBackedUpClientWallet,
  isClientWalletInitialized,
} from "@/lib/client-vault";
import { getDusdDelegationStatus } from "@/lib/delegation";
import { requestDusdFaucet } from "@/lib/trade-execution";
import { Sparkles, ShieldAlert, Zap, AlertTriangle, Coins, ArrowDownLeft, Key } from "lucide-react";

export default function Home() {
  const { connected, publicKey: externalPublicKey } = useWallet();
  const { data: session, status: sessionStatus } = useSession();

  // Network State
  const [network, setNetwork] = useState<"devnet" | "mainnet">("devnet");
  const [isRiskModalOpen, setIsRiskModalOpen] = useState<boolean>(false);
  const [hasRiskAccepted, setHasRiskAccepted] = useState<boolean>(false);

  // Mainnet Client Keypair (Self-Custodial Browser Vault)
  const [mainnetKeypair, setMainnetKeypair] = useState<Keypair | null>(null);
  const [backupPrivateKeyBase58, setBackupPrivateKeyBase58] = useState<string>("");
  const [isBackupModalOpen, setIsBackupModalOpen] = useState<boolean>(false);
  const [isDepositModalOpen, setIsDepositModalOpen] = useState<boolean>(false);

  const [activeTab, setActiveTab] = useState<"feed" | "portfolio" | "leaderboard" | "launch">("feed");
  const [tradeAmount, setTradeAmountState] = useState<number>(25);
  const [transactions, setTransactions] = useState<TradeTransaction[]>([]);
  const [cashBalance, setCashBalance] = useState<number>(0);
  const [delegatedAllowance, setDelegatedAllowance] = useState<number>(0);

  // In-app Devnet Keypair
  const [devnetKeypair, setDevnetKeypair] = useState<Keypair | null>(null);
  const [devnetSecretBase64, setDevnetSecretBase64] = useState<string>("");
  const [activeProfile, setActiveProfile] = useState<UserProfile | null>(null);

  // Modals
  const [isGuideOpen, setIsGuideOpen] = useState<boolean>(false);
  const [isDelegationOpen, setIsDelegationOpen] = useState<boolean>(false);
  const [isTransferOpen, setIsTransferOpen] = useState<boolean>(false);
  const [isAuthOpen, setIsAuthOpen] = useState<boolean>(false);

  const isMainnet = network === "mainnet";
  const currentStocks = useMemo(() => getStocksForNetwork(network), [network]);

  const activeConnection = useMemo(() => {
    return getSolanaConnection(network);
  }, [network]);

  // Active public key determination
  const isExternal = connected && !!externalPublicKey;
  const activePublicKey: PublicKey = isMainnet
    ? isExternal
      ? externalPublicKey!
      : mainnetKeypair
      ? mainnetKeypair.publicKey
      : activeProfile?.publicKey
      ? new PublicKey(activeProfile.publicKey)
      : new PublicKey("11111111111111111111111111111111")
    : isExternal
    ? externalPublicKey!
    : devnetKeypair
    ? devnetKeypair.publicKey
    : new PublicKey("11111111111111111111111111111111");

  // 1. Initialize on mount
  useEffect(() => {
    setTradeAmountState(getPreferredTradeAmount());
    setTransactions(getTradeHistory(network));
    setHasRiskAccepted(hasAcceptedMainnetRisk());

    const { keypair, isNew, profile } = getOrCreateInAppWallet();
    setDevnetKeypair(keypair);
    setDevnetSecretBase64(Buffer.from(keypair.secretKey).toString("base64"));
    setActiveProfile(profile);

    // Auto-onboard custodial wallet on Devnet silently
    if (network === "devnet" && (isNew || !hasClaimedInitialDusd(keypair.publicKey.toBase58()))) {
      requestDusdFaucet(keypair.publicKey).then((res) => {
        if (res.success) {
          setClaimedInitialDusd(keypair.publicKey.toBase58());
          setCashBalance(1000);
        }
      });
    }
  }, [network]);

  // 2. Load Mainnet self-custodial wallet from volatile session if already unlocked
  useEffect(() => {
    if (isMainnet && activeProfile && activeProfile.provider !== "guest") {
      const unlocked = getUnlockedClientSession(activeProfile.id);
      if (unlocked) {
        setMainnetKeypair(unlocked);
        const b58 = bs58.encode(unlocked.secretKey);
        setBackupPrivateKeyBase58(b58);
      }
    }
  }, [isMainnet, activeProfile]);

  // 3. Synchronize real NextAuth Google session if active
  useEffect(() => {
    if (sessionStatus === "authenticated" && session?.user?.email) {
      const email = session.user.email;
      const name = session.user.name || "Google User";
      const userId = "google_" + email.toLowerCase().replace(/[^a-z0-9]/g, "_");

      if (network === "devnet") {
        fetchOrCreateServerCustodialWallet({
          userId,
          name,
          provider: "google",
          email,
        }).then(({ profile, keypair }) => {
          setActiveProfile(profile);
          setDevnetKeypair(keypair);
          setDevnetSecretBase64(Buffer.from(keypair.secretKey).toString("base64"));
        }).catch((err) => console.warn("Google devnet sync notice:", err));
      } else {
        // Mainnet: check if client wallet is already unlocked
        const unlocked = getUnlockedClientSession(userId);
        if (unlocked) {
          setMainnetKeypair(unlocked);
          const b58 = bs58.encode(unlocked.secretKey);
          setBackupPrivateKeyBase58(b58);
          setActiveProfile({
            id: userId,
            name,
            provider: "google",
            email,
            publicKey: unlocked.publicKey.toBase58(),
          });
        }
      }
    }
  }, [session, sessionStatus, network]);

  // 4. Fetch balances for the active network
  const refreshWalletState = useCallback(async () => {
    if (!activePublicKey || activePublicKey.toBase58() === "11111111111111111111111111111111") {
      setCashBalance(0);
      return;
    }

    try {
      if (isMainnet) {
        // Mainnet: Query real USDC balance on active public address
        const usdcBal = await getSplTokenBalance(
          activeConnection,
          activePublicKey,
          new PublicKey(MAINNET_USDC_MINT),
          6
        );
        setCashBalance(usdcBal);
        setDelegatedAllowance(0);
      } else {
        // Devnet: Query dUSD balance
        const dUsdBal = await getSplTokenBalance(
          activeConnection,
          activePublicKey,
          new PublicKey(DUSD_MINT_ADDRESS),
          6
        );
        setCashBalance(dUsdBal);

        if (isExternal) {
          const del = await getDusdDelegationStatus(activeConnection, activePublicKey);
          setDelegatedAllowance(del.delegatedAmount);
        } else {
          setDelegatedAllowance(500);
        }
      }
    } catch (e) {
      console.warn("Wallet state refresh notice:", e);
    }
  }, [activeConnection, activePublicKey, isExternal, isMainnet]);

  useEffect(() => {
    refreshWalletState();
  }, [refreshWalletState]);

  // Handle Network Switching
  const handleToggleNetwork = (targetNet: "devnet" | "mainnet") => {
    if (targetNet === "mainnet" && !hasRiskAccepted) {
      setIsRiskModalOpen(true);
      return;
    }
    setNetwork(targetNet);
    setTransactions(getTradeHistory(targetNet));
  };

  const handleConfirmMainnetRisk = () => {
    setAcceptedMainnetRisk(true);
    setHasRiskAccepted(true);
    setIsRiskModalOpen(false);
    setNetwork("mainnet");
    setTransactions(getTradeHistory("mainnet"));
  };

  // Mainnet Client Wallet Ready Callback
  const handleMainnetClientWalletReady = (keypair: Keypair, isNew: boolean) => {
    setMainnetKeypair(keypair);
    const b58 = bs58.encode(keypair.secretKey);
    setBackupPrivateKeyBase58(b58);
    if (isNew || (activeProfile && !hasBackedUpClientWallet(activeProfile.id))) {
      setIsBackupModalOpen(true);
    }
  };

  const handleBackupConfirmed = () => {
    if (activeProfile) {
      setBackedUpClientWallet(activeProfile.id);
    }
    setIsBackupModalOpen(false);
  };

  // Handle Profile Switch / Login
  const handleProfileChanged = (newProfile: UserProfile | null) => {
    setActiveProfile(newProfile);

    if (network === "devnet") {
      const { keypair, isNew } = getOrCreateInAppWallet();
      setDevnetKeypair(keypair);
      setDevnetSecretBase64(Buffer.from(keypair.secretKey).toString("base64"));

      if (isNew || !hasClaimedInitialDusd(keypair.publicKey.toBase58())) {
        requestDusdFaucet(keypair.publicKey).then((res) => {
          if (res.success) {
            setClaimedInitialDusd(keypair.publicKey.toBase58());
            setCashBalance(1000);
          }
        });
      }
    }
    refreshWalletState();
  };

  const handleChangeTradeAmount = (val: number) => {
    setTradeAmountState(val);
    setPreferredTradeAmount(val);
  };

  const handleRefreshTransactions = () => {
    setTransactions(getTradeHistory(network));
    refreshWalletState();
  };

  const handleClaimDusd = async () => {
    if (!devnetKeypair) return;
    const res = await requestDusdFaucet(devnetKeypair.publicKey);
    if (res.success) {
      refreshWalletState();
    }
  };

  const { positions } = useMemo(() => {
    return calculatePortfolioPositions(currentStocks, transactions);
  }, [currentStocks, transactions]);

  return (
    <div className="min-h-screen w-full bg-background text-slate-100 flex flex-col items-center">
      {/* Top Header */}
      <HeaderBar
        network={network}
        onToggleNetwork={handleToggleNetwork}
        tradeAmount={tradeAmount}
        onChangeTradeAmount={handleChangeTradeAmount}
        activeTab={activeTab}
        onTabChange={setActiveTab}
        cashBalance={cashBalance}
        delegatedAllowance={delegatedAllowance}
        portfolioItemsCount={positions.length}
        onOpenGuide={() => setIsGuideOpen(true)}
        onOpenDelegation={() => setIsDelegationOpen(true)}
        onOpenTransfer={() => setIsTransferOpen(true)}
        onRequestDusdFaucet={handleClaimDusd}
        isCustodial={!isExternal && !isMainnet}
        activeProfile={activeProfile}
        onOpenAuth={() => setIsAuthOpen(true)}
      />

      {/* Main Container */}
      <main className="w-full max-w-lg px-4 pt-4 pb-24 sm:pb-12 flex flex-col items-center flex-1">
        {/* Helper Banner: Mode-Aware */}
        {isMainnet ? (
          <div className="w-full mb-3 px-3.5 py-2.5 rounded-2xl bg-amber-950/40 border border-amber-500/30 text-amber-200 shadow-sm">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
                <span className="text-xs text-amber-200 font-medium">
                  You&apos;re trading with real money. Only you can access your funds.
                </span>
                <div className="group relative cursor-pointer inline-flex items-center">
                  <div className="w-4 h-4 rounded-full bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 flex items-center justify-center text-[10px] font-bold border border-amber-500/40 transition-colors">
                    i
                  </div>
                  <div className="absolute left-1/2 -translate-x-1/2 bottom-full mb-2 hidden group-hover:block w-64 p-2.5 bg-surface-card border border-slate-700 rounded-xl shadow-2xl text-[10px] text-slate-300 font-normal leading-relaxed z-50 pointer-events-none">
                    <div className="font-bold text-white mb-1">🔒 Technical Architecture</div>
                    Client-side encrypted vault. Transactions are signed directly in your browser memory via Jupiter with zero server knowledge.
                  </div>
                </div>
              </div>
              <button
                onClick={() => {
                  if (activePublicKey.toBase58() !== "11111111111111111111111111111111") {
                    setIsDepositModalOpen(true);
                  } else {
                    setIsAuthOpen(true);
                  }
                }}
                className="px-2.5 py-1 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 font-bold text-[11px] shrink-0 flex items-center gap-1.5 border border-amber-500/40 transition-colors shadow-sm"
                title="Add USDC & SOL to your TickStock wallet"
              >
                <ArrowDownLeft className="w-3.5 h-3.5" />
                <span>+ Add Money</span>
              </button>
            </div>
          </div>
        ) : (
          <div className="w-full mb-3 flex items-center justify-between gap-2 px-3 py-1.5 rounded-2xl bg-surface-card border border-slate-800 text-[11px] text-slate-400">
            <div className="flex items-center gap-1.5">
              <Zap className="w-3.5 h-3.5 text-solana-green shrink-0 fill-solana-green" />
              <span>
                {isExternal
                  ? "Sign-once session trading active • Gas sponsored"
                  : activeProfile && activeProfile.provider !== "guest"
                  ? `Logged in as ${activeProfile.name} • Gas 100% sponsored`
                  : "Instant 1-swipe trading active • Gas 100% sponsored"}
              </span>
            </div>
            <span className="font-mono text-slate-300 font-bold">
              ${tradeAmount}/swipe
            </span>
          </div>
        )}

        {/* Tab Views */}
        {activeTab === "feed" && (
          <FeedView
            network={network}
            stocks={currentStocks}
            tradeAmount={tradeAmount}
            onChangeTradeAmount={handleChangeTradeAmount}
            cashBalance={cashBalance}
            activeWalletPubkey={activePublicKey}
            isCustodial={!isExternal && !isMainnet}
            custodialSecretKeyBase64={devnetSecretBase64}
            mainnetClientKeypair={mainnetKeypair}
            positions={positions}
            onTradeExecuted={handleRefreshTransactions}
            onRequestDusdFaucet={handleClaimDusd}
            onOpenRiskModal={() => setIsRiskModalOpen(true)}
            onOpenDepositModal={() => setIsDepositModalOpen(true)}
            onOpenAuthModal={() => setIsAuthOpen(true)}
            onNavigatePortfolio={() => setActiveTab("portfolio")}
            hasAcceptedRisk={hasRiskAccepted}
          />
        )}

        {activeTab === "portfolio" && (
          <PortfolioView
            network={network}
            stocks={currentStocks}
            transactions={transactions}
            dusdBalance={cashBalance}
            activeWalletPubkey={activePublicKey}
            isCustodial={!isExternal && !isMainnet}
            custodialSecretKeyBase64={devnetSecretBase64}
            mainnetClientKeypair={mainnetKeypair}
            onTradeExecuted={handleRefreshTransactions}
            onPortfolioReset={handleRefreshTransactions}
            onExploreFeed={() => setActiveTab("feed")}
            onOpenTransfer={() => setIsTransferOpen(true)}
          />
        )}

        {activeTab === "launch" && (
          <LaunchView
            network={network}
            tradeAmount={tradeAmount}
            cashBalance={cashBalance}
            activeWalletPubkey={activePublicKey}
            onTradeExecuted={handleRefreshTransactions}
            onOpenDepositModal={() => setIsDepositModalOpen(true)}
            onOpenAuthModal={() => setIsAuthOpen(true)}
          />
        )}

        {activeTab === "leaderboard" && (
          <LeaderboardView
            stocks={currentStocks}
            onSelectStock={() => setActiveTab("feed")}
          />
        )}
      </main>

      {/* Mobile Bottom Navigation Bar */}
      <BottomNav
        activeTab={activeTab}
        onTabChange={setActiveTab}
        portfolioItemsCount={positions.length}
      />

      {/* Mainnet Risk Warning Modal */}
      <MainnetRiskModal
        isOpen={isRiskModalOpen}
        onClose={() => setIsRiskModalOpen(false)}
        onConfirm={handleConfirmMainnetRisk}
      />

      {/* Mandatory One-Time Wallet Backup Modal for Mainnet Self-Custodial Users */}
      <WalletBackupModal
        isOpen={isBackupModalOpen}
        onClose={() => setIsBackupModalOpen(false)}
        privateKeyBase58={backupPrivateKeyBase58}
        publicKey={activeProfile?.publicKey || mainnetKeypair?.publicKey.toBase58() || ""}
        onConfirmedBackup={handleBackupConfirmed}
      />

      {/* Deposit Modal */}
      <DepositModal
        isOpen={isDepositModalOpen}
        onClose={() => setIsDepositModalOpen(false)}
        publicKey={activePublicKey.toBase58()}
      />

      {/* User Auth & Profile Modal */}
      <AuthModal
        isOpen={isAuthOpen}
        onClose={() => setIsAuthOpen(false)}
        network={network}
        activeProfile={activeProfile}
        onProfileChanged={handleProfileChanged}
        onMainnetClientWalletReady={handleMainnetClientWalletReady}
        onOpenBackupModal={() => setIsBackupModalOpen(true)}
      />

      {/* Guide Modal */}
      <DemoGuideModal
        isOpen={isGuideOpen}
        onClose={() => setIsGuideOpen(false)}
      />

      {/* Token Delegation Modal for External Wallet Session */}
      <DelegationModal
        isOpen={isDelegationOpen}
        onClose={() => setIsDelegationOpen(false)}
        onSuccess={refreshWalletState}
        currentAllowance={delegatedAllowance}
      />

      {/* In-App to External Phantom Migration Modal */}
      <TransferModal
        isOpen={isTransferOpen}
        onClose={() => setIsTransferOpen(false)}
        inAppSecretKeyBase64={devnetSecretBase64}
        totalPortfolioValue={positions.reduce((acc, p) => acc + p.currentValue, 0)}
        dusdBalance={cashBalance}
        onTransferSuccess={handleRefreshTransactions}
      />
    </div>
  );
}
