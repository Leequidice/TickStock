"use client";

import React, { useState, useMemo } from "react";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
} from "recharts";
import { TokenizedStock } from "@/lib/stocks";
import { generateChartData, Timeframe } from "@/lib/market";
import { formatCurrency, formatPercent, cn } from "@/lib/utils";

interface StockChartProps {
  stock: TokenizedStock;
}

export const StockChart: React.FC<StockChartProps> = ({ stock }) => {
  const [timeframe, setTimeframe] = useState<Timeframe>("1D");

  const data = useMemo(
    () => generateChartData(stock, timeframe),
    [stock, timeframe]
  );

  const isPositive = stock.change24h >= 0;
  const strokeColor = isPositive ? "#00E599" : "#FF3B69";
  const gradientId = `stock-grad-${stock.id}-${timeframe}`;

  const minPrice = useMemo(
    () => Math.min(...data.map((d) => d.price)) * 0.995,
    [data]
  );
  const maxPrice = useMemo(
    () => Math.max(...data.map((d) => d.price)) * 1.005,
    [data]
  );

  return (
    <div className="w-full flex flex-col">
      {/* Timeframe Switcher */}
      <div className="flex items-center justify-between mb-2 px-1">
        <div className="flex items-center gap-1.5 bg-surface-elevated/80 p-0.5 rounded-lg border border-slate-800">
          {(["1D", "1W", "1M", "1Y"] as Timeframe[]).map((tf) => (
            <button
              key={tf}
              onClick={(e) => {
                e.stopPropagation();
                setTimeframe(tf);
              }}
              className={cn(
                "px-2 py-0.5 rounded text-[10px] font-mono font-semibold transition-all",
                timeframe === tf
                  ? "bg-slate-700 text-white shadow-sm"
                  : "text-slate-400 hover:text-slate-200"
              )}
            >
              {tf}
            </button>
          ))}
        </div>

        <div className="text-[11px] font-mono text-slate-400 flex items-center gap-1">
          <span>Range:</span>
          <span className="text-slate-200 font-semibold">
            {formatCurrency(minPrice)} - {formatCurrency(maxPrice)}
          </span>
        </div>
      </div>

      {/* Chart Canvas */}
      <div className="w-full h-44 relative">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart
            data={data}
            margin={{ top: 10, right: 0, left: 0, bottom: 0 }}
          >
            <defs>
              <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={strokeColor} stopOpacity={0.45} />
                <stop offset="70%" stopColor={strokeColor} stopOpacity={0.08} />
                <stop offset="100%" stopColor={strokeColor} stopOpacity={0.0} />
              </linearGradient>
            </defs>
            <XAxis dataKey="time" hide />
            <YAxis domain={[minPrice, maxPrice]} hide />
            <Tooltip
              content={({ active, payload }) => {
                if (active && payload && payload.length) {
                  const p = payload[0].value as number;
                  return (
                    <div className="bg-surface-elevated/95 border border-slate-700 p-2 rounded-xl shadow-xl backdrop-blur-md text-xs font-mono">
                      <div className="text-slate-400 text-[10px]">
                        {payload[0].payload.time}
                      </div>
                      <div className="text-white font-bold text-sm">
                        {formatCurrency(p)}
                      </div>
                    </div>
                  );
                }
                return null;
              }}
            />
            <Area
              type="monotone"
              dataKey="price"
              stroke={strokeColor}
              strokeWidth={2.5}
              fillOpacity={1}
              fill={`url(#${gradientId})`}
              isAnimationActive={true}
              animationDuration={600}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};
