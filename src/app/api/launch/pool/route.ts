import { NextRequest, NextResponse } from "next/server";
import { fetchDbcPoolStatus, METEORA_DEVNET_LAUNCH_STOCK } from "@/lib/meteora-dbc";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const network = (searchParams.get("network") as "devnet" | "mainnet") || "devnet";

    const status = await fetchDbcPoolStatus(network);

    return NextResponse.json({
      success: true,
      stock: METEORA_DEVNET_LAUNCH_STOCK,
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
