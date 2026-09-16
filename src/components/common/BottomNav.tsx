"use client";

import React from "react";
import { Flame, Briefcase, Trophy } from "lucide-react";
import { cn } from "@/lib/utils";

interface BottomNavProps {
  activeTab: "feed" | "portfolio" | "leaderboard";
  onTabChange: (tab: "feed" | "portfolio" | "leaderboard") => void;
  portfolioItemsCount: number;
}

export const BottomNav: React.FC<BottomNavProps> = ({
  activeTab,
  onTabChange,
  portfolioItemsCount,
}) => {
  return (
    <div className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-surface/95 border-t border-slate-800/80 backdrop-blur-lg px-6 py-2 pb-5 flex items-center justify-around">
      {/* Feed Button */}
      <button
        onClick={() => onTabChange("feed")}
        className={cn(
          "flex flex-col items-center gap-1 transition-all",
          activeTab === "feed" ? "text-solana-green scale-105" : "text-slate-400 hover:text-slate-200"
        )}
      >
        <Flame className="w-5 h-5" />
        <span className="text-[10px] font-semibold">Feed</span>
      </button>

      {/* Portfolio Button */}
      <button
        onClick={() => onTabChange("portfolio")}
        className={cn(
          "flex flex-col items-center gap-1 relative transition-all",
          activeTab === "portfolio" ? "text-solana-green scale-105" : "text-slate-400 hover:text-slate-200"
        )}
      >
        <div className="relative">
          <Briefcase className="w-5 h-5" />
          {portfolioItemsCount > 0 && (
            <span className="absolute -top-1.5 -right-2 w-4 h-4 rounded-full bg-solana-purple text-[9px] font-bold font-mono text-white flex items-center justify-center">
              {portfolioItemsCount}
            </span>
          )}
        </div>
        <span className="text-[10px] font-semibold">Portfolio</span>
      </button>

      {/* Leaderboard Button */}
      <button
        onClick={() => onTabChange("leaderboard")}
        className={cn(
          "flex flex-col items-center gap-1 transition-all",
          activeTab === "leaderboard" ? "text-solana-green scale-105" : "text-slate-400 hover:text-slate-200"
        )}
      >
        <Trophy className="w-5 h-5" />
        <span className="text-[10px] font-semibold">Rankings</span>
      </button>
    </div>
  );
};
