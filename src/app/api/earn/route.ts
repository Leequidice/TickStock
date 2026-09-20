import { NextRequest, NextResponse } from "next/server";
import { fetchLiveRaydiumStockPools } from "@/lib/raydium-earn";

export const dynamic = "force-dynamic";

/**
 * GET /api/earn - Returns live pool yield metrics and APRs from Raydium API for xStocks.
 */
export async function GET(req: NextRequest) {
  try {
    const pools = await fetchLiveRaydiumStockPools();
    return NextResponse.json({
      success: true,
      source: "Raydium v3 Public API",
      timestamp: Date.now(),
      pools,
    });
  } catch (error: any) {
    console.error("Error in /api/earn:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to fetch Raydium stock pools" },
      { status: 500 }
    );
  }
}
