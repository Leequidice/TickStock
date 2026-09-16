const fs = require("fs");
const { Connection, Keypair } = require("@solana/web3.js");
const conn = new Connection("https://api.mainnet-beta.solana.com", "confirmed");

async function run() {
  const env = fs.readFileSync(".env.local", "utf8");
  for (const line of env.split("\n")) {
    if (line.includes("_SECRET=")) {
      const parts = line.split("=");
      const keyName = parts[0].trim();
      let val = parts.slice(1).join("=").trim();
      if (val.startsWith('"') && val.endsWith('"')) val = val.slice(1, -1);
      try {
        const kp = Keypair.fromSecretKey(Buffer.from(val, "base64"));
        const bal = await conn.getBalance(kp.publicKey);
        console.log(keyName, kp.publicKey.toBase58(), bal / 1e9, "SOL");
      } catch (e) {}
    }
  }
}
run();
