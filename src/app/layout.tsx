import type { Metadata } from "next";
import { SolanaWalletProvider } from "@/components/providers/SolanaWalletProvider";
import { AuthProvider } from "@/components/providers/AuthProvider";
import "./globals.css";

export const metadata: Metadata = {
  title: "TickStock — Stock Discovery Feed on Solana",
  description:
    "Swipe right to buy, swipe left to skip. High-speed micro-trading and stock discovery powered by Solana Devnet.",
  icons: {
    icon: "/favicon.ico",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body className="bg-background text-slate-100 min-h-screen antialiased flex flex-col items-center justify-center selection:bg-solana-green selection:text-black">
        <AuthProvider>
          <SolanaWalletProvider>{children}</SolanaWalletProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
