import Arweave from "arweave";
import { JWKInterface } from "arweave/node/lib/wallet";
import nacl from "tweetnacl";

// Initialize Arweave client (using testnet for development)
const arweave = Arweave.init({
  host: "testnet.arweave.net",
  port: 1984,
  protocol: "https",
});

// Load or generate a wallet (for now, placeholder; replace with user wallet)
let wallet: JWKInterface | undefined;

// Initialize with a test wallet for development
const initTestWallet = async () => {
  if (!wallet) {
    try {
      console.log("Generating test Arweave wallet for development...");
      wallet = await arweave.wallets.generate();
      console.log("Generated test Arweave wallet successfully");
    } catch (error) {
      console.error("Failed to generate Arweave wallet:", error);
      throw new Error("Could not initialize Arweave wallet");
    }
  }
};

export const setWallet = (jwk: JWKInterface) => {
  wallet = jwk;
};

// Upload encrypted content to Arweave
export const uploadToArweave = async (data: Uint8Array): Promise<string> => {
  console.log("Creating Arweave transaction with data length:", data.length);

  if (!checkArweaveWallet()) {
    installArConnectGuide();
    throw new Error("ArConnect wallet required. Please install it and try again.");
  }

  // Check if wallet is connected
  let address: string;
  try {
    address = await (window as any).arweaveWallet.getActiveAddress();
    console.log("ArConnect wallet connected:", address);
  } catch (error) {
    console.log("ArConnect wallet not connected, attempting to connect...");
    try {
      await (window as any).arweaveWallet.connect(['ACCESS_ADDRESS', 'SIGN_TRANSACTION']);
      address = await (window as any).arweaveWallet.getActiveAddress();
      console.log("Successfully connected to ArConnect:", address);
    } catch (connectError) {
      console.error("Failed to connect ArConnect wallet:", connectError);
      throw new Error("Please unlock your ArConnect wallet and try again.");
    }
  }

  // Check AR balance
  const balance = await getArweaveBalance(address);
  if (balance < 0.001) {
    const fundingMessage = `
❌ Insufficient AR Balance

You have ${balance.toFixed(6)} AR, but need at least 0.001 AR to store this note.

GET AR TOKENS NOW:
• Binance: https://binance.com (search "AR")
• Coinbase: https://coinbase.com (search "AR")
• KuCoin: https://kucoin.com (search "AR")
• Gate.io: https://gate.io (search "AR")

💰 Current AR Price: ~$20-30 USD
📊 Storage Cost: ~$0.001 per note (very cheap!)

After getting AR tokens, return here and try publishing again.
    `.trim();

    alert(fundingMessage);
    throw new Error(`Insufficient AR balance: ${balance} AR. Please get AR tokens and try again.`);
  }

  // Create transaction
  const transaction = await arweave.createTransaction(
    {
      data: data,
    },
    "use_wallet"
  );

  transaction.addTag("Content-Type", "application/octet-stream");
  transaction.addTag("App-Name", "Elysium-Notes");
  transaction.addTag("App-Version", "1.0.0");
  transaction.addTag("Uploaded-By", address);

  console.log("Arweave transaction created:", transaction.id);
  console.log("Transaction fee:", arweave.ar.winstonToAr(transaction.reward), "AR");

  // Sign transaction with ArConnect
  try {
    await (window as any).arweaveWallet.sign(transaction);
    console.log("Transaction signed by ArConnect");
  } catch (error) {
    console.error("Failed to sign transaction:", error);
    throw new Error("Transaction signing cancelled. Please try again and approve the transaction in ArConnect.");
  }

  // Post transaction
  try {
    const response = await arweave.transactions.post(transaction);
    if (response.status === 200) {
      console.log("Arweave upload successful, transaction ID:", transaction.id);
      console.log("Data will be available at:", `https://arweave.net/${transaction.id}`);
      return transaction.id;
    } else {
      throw new Error(`Upload failed with status ${response.status}: ${response.statusText}`);
    }
  } catch (error) {
    console.error("Failed to post transaction:", error);
    throw new Error("Failed to upload to Arweave. Please check your connection and try again.");
  }
};

// Check if ArConnect wallet is available
export const checkArweaveWallet = (): boolean => {
  return typeof window !== 'undefined' && (window as any).arweaveWallet;
};

// Guide user to install ArConnect
export const installArConnectGuide = (): void => {
  const message = `
🔗 ArConnect Wallet Required

To permanently store your notes on Arweave, you need the ArConnect browser extension:

📥 INSTALL ARCONNECT:
1. Visit: https://arconnect.io
2. Click "Add to Browser"
3. Follow installation steps
4. Refresh this page

💰 GET AR TOKENS (after installing ArConnect):
• Visit any exchange: Binance, Coinbase, KuCoin, or Gate.io
• Search for "AR" (Arweave token)
• Buy ~$20-30 worth of AR tokens
• Send AR to your ArConnect wallet

💡 Why Arweave?
• Permanent storage (never disappears)
• Censorship-resistant
• Very cheap (~$0.001 per note)

After installing ArConnect and getting AR tokens, try publishing again!
  `.trim();

  alert(message);
  // Also open ArConnect website
  window.open('https://arconnect.io', '_blank');
};

// Connect to Arweave wallet
export const connectArweaveWallet = async (): Promise<string> => {
  if (!checkArweaveWallet()) {
    throw new Error("ArConnect wallet not found. Please install ArConnect browser extension.");
  }

  try {
    await (window as any).arweaveWallet.connect(['ACCESS_ADDRESS', 'SIGN_TRANSACTION']);
    const address = await (window as any).arweaveWallet.getActiveAddress();
    console.log("Connected to Arweave wallet:", address);
    return address;
  } catch (error) {
    console.error("Failed to connect Arweave wallet:", error);
    throw new Error("Failed to connect to Arweave wallet. Please make sure ArConnect is unlocked.");
  }
};

// Get AR balance
export const getArweaveBalance = async (address: string): Promise<number> => {
  try {
    const balance = await arweave.wallets.getBalance(address);
    const arBalance = arweave.ar.winstonToAr(balance);
    console.log("AR balance:", arBalance);
    return parseFloat(arBalance);
  } catch (error) {
    console.error("Failed to get AR balance:", error);
    return 0;
  }
};

// Get information about getting AR tokens
export const getArweaveFundingInfo = (): string => {
  return `
To store your notes permanently on Arweave, you need AR tokens. Here's how to get them:

🏦 **Exchanges (Recommended for beginners):**
• Binance: https://binance.com
• Coinbase: https://coinbase.com
• KuCoin: https://kucoin.com
• Gate.io: https://gate.io

💰 **AR Price:** ~$20-30 USD per AR token
📊 **Storage Cost:** ~$0.001 per note (very cheap!)

🔄 **After getting AR tokens:**
1. Send them to your ArConnect wallet address
2. Try publishing your note again

💡 **Pro tip:** You only pay once per note. Updates are free!

Need help? Check: https://arweave.org
  `.trim();
};
