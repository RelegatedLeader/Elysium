import Arweave from "arweave";
import { JWKInterface } from "arweave/node/lib/wallet";
import nacl from "tweetnacl";

// Initialize Arweave client (using mainnet for production)
const arweave = Arweave.init({
  host: "arweave.net",
  port: 443,
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
  console.log("🚀 Starting Arweave upload process...");

  if (!checkArweaveWallet()) {
    console.error("❌ ArConnect wallet not found");
    throw new Error("ArConnect wallet required. Please install it and try again.");
  }

  // Check if wallet is connected and has proper permissions
  let address: string;
  try {
    console.log("🔗 Checking ArConnect wallet connection...");
    address = await (window as any).arweaveWallet.getActiveAddress();
    console.log("✅ ArConnect wallet connected:", address);
  } catch (error) {
    console.log("🔄 ArConnect wallet not connected, attempting to connect...");
    try {
      // Request permissions for mainnet Arweave
      await (window as any).arweaveWallet.connect([
        'ACCESS_ADDRESS',
        'ACCESS_PUBLIC_KEY',
        'SIGN_TRANSACTION',
        'ACCESS_ARWEAVE_CONFIG'
      ]);
      // Small delay to ensure connection is fully established
      await new Promise(resolve => setTimeout(resolve, 500));
      address = await (window as any).arweaveWallet.getActiveAddress();
      console.log("✅ Successfully connected to ArConnect:", address);
    } catch (connectError) {
      console.error("❌ Failed to connect ArConnect wallet:", connectError);
      throw new Error("Please unlock your ArConnect wallet and try again.");
    }
  }

  console.log("� About to create Arweave transaction...");
  console.log("📊 Data size:", data.length, "bytes");
  console.log("🏠 Arweave host:", arweave.api.config.host);

  console.log("�📝 Creating Arweave transaction...");
  // Create transaction - try without "use_wallet" first, then sign with ArConnect
  let transaction;
  try {
    console.log("🔧 Calling arweave.createTransaction...");
    transaction = await arweave.createTransaction({
      data: data,
    });
    console.log("✅ Transaction object created successfully");
  } catch (txError) {
    console.error("❌ Failed to create transaction:", txError);
    throw new Error("Failed to create Arweave transaction. Please try again.");
  }

  transaction.addTag("Content-Type", "application/octet-stream");
  transaction.addTag("App-Name", "Elysium-Notes");
  transaction.addTag("App-Version", "1.0.0");
  transaction.addTag("Uploaded-By", address);

  console.log("💰 Transaction created:", {
    id: transaction.id,
    fee: arweave.ar.winstonToAr(transaction.reward) + " AR",
    size: data.length + " bytes"
  });

  // Sign transaction with ArConnect - this should show the popup immediately
  console.log("✍️ Requesting ArConnect signature...");
  try {
    const signedTx = await (window as any).arweaveWallet.sign(transaction);
    console.log("✅ Transaction signed by ArConnect, signed tx:", signedTx.id);
    // Use the signed transaction for posting
    transaction = signedTx;
  } catch (error) {
    console.error("❌ Transaction signing failed:", error);
    if (error instanceof Error) {
      if (error.message.includes("User cancelled") || error.message.includes("cancelled")) {
        throw new Error("Transaction cancelled by user.");
      }
    }
    throw new Error("Transaction signing failed. Please try again and approve the transaction in ArConnect.");
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
export const getArConnectInstallGuide = (): { title: string; message: string; actionUrl?: string } => {
  return {
    title: "ArConnect Wallet Required",
    message: `To permanently store your notes on Arweave, you need the ArConnect browser extension:

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

After installing ArConnect and getting AR tokens, try publishing again!`,
    actionUrl: 'https://arconnect.io'
  };
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

// Get AR balance with retry and timeout handling
export const getArweaveBalance = async (address: string, retries = 2): Promise<number> => {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      console.log(`Checking AR balance (attempt ${attempt + 1}/${retries + 1})...`);

      // Create a timeout promise
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Balance check timeout')), 10000); // 10 second timeout
      });

      // Race between the balance check and timeout
      const balance = await Promise.race([
        arweave.wallets.getBalance(address),
        timeoutPromise
      ]);

      const arBalance = arweave.ar.winstonToAr(balance as string);
      const balanceFloat = parseFloat(arBalance);
      console.log(`AR balance: ${balanceFloat} AR`);
      return balanceFloat;
    } catch (error) {
      console.error(`Balance check attempt ${attempt + 1} failed:`, error);

      if (attempt === retries) {
        // If this was the last attempt, return 0 but don't throw
        console.warn("All balance check attempts failed, assuming insufficient balance for safety");
        return 0;
      }

      // Wait before retrying (exponential backoff)
      await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 1000));
    }
  }

  return 0;
};

// Get funding information for insufficient balance
export const getArweaveFundingInfo = (): { title: string; message: string } => {
  return {
    title: "Insufficient AR Balance",
    message: `You need at least 0.001 AR to store this note.

GET AR TOKENS NOW:
• Binance: https://binance.com (search "AR")
• Coinbase: https://coinbase.com (search "AR")
• KuCoin: https://kucoin.com (search "AR")
• Gate.io: https://gate.io (search "AR")

💰 Current AR Price: ~$20-30 USD
📊 Storage Cost: ~$0.001 per note (very cheap!)

After getting AR tokens, return here and try publishing again.`
  };
};
