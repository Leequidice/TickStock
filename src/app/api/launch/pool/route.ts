import { NextRequest, NextResponse } from "next/server";
import { fetchDbcPoolStatus, METEORA_DEVNET_LAUNCH_STOCK } from "@/lib/meteora-dbc";
import { getPersistedLaunchedPools } from "@/lib/dbc-storage";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const network = (searchParams.get("network") as "devnet" | "mainnet") || "devnet";
    const stockId = searchParams.get("stockId") || "dbc-aero";

    const allStocks = getPersistedLaunchedPools();
    const stock = allStocks.find((p) => p.id === stockId) || allStocks[0] || METEORA_DEVNET_LAUNCH_STOCK;
    const status = await fetchDbcPoolStatus(stock, network);

    return NextResponse.json({
      success: true,
      stock,
      allStocks,
      pool: status,
    });
  } catch (error: any) {
    console.error("DBC Pool status error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || "Failed to fetch Meteora DBC pool status",
      },
      { status: 500 }
    );
  }
}
