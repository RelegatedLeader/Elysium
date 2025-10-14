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

export const disconnectArweaveWallet = async (): Promise<void> => {
  const isMobile = isMobileDevice();
  const walletType = getWalletType();

  if (isMobile && checkWanderWallet()) {
    try {
      await (window as any).wanderWallet.disconnect();
      console.log("Disconnected from Wander wallet");
    } catch (error) {
      console.error("Error disconnecting from Wander wallet:", error);
      // Don't throw error for disconnect - it's not critical
    }
  } else if (checkArweaveWallet()) {
    try {
      await (window as any).arweaveWallet.disconnect();
      console.log("Disconnected from Arweave wallet");
    } catch (error) {
      console.error("Error disconnecting from Arweave wallet:", error);
      // Don't throw error for disconnect - it's not critical
    }
  }
};

// Upload encrypted content to Arweave
export const uploadToArweave = async (data: Uint8Array): Promise<string> => {
  console.log("🚀 Starting Arweave upload process...");

  const isMobile = isMobileDevice();
  const walletType = getWalletType();

  if (!checkArweaveWallet()) {
    const walletName = isMobile ? "Wander wallet" : "ArConnect wallet";
    console.error(`❌ ${walletName} not found`);
    throw new Error(`${walletName} required. Please install it and try again.`);
  }

  // Check if wallet is connected and has proper permissions
  let address: string;
  const wallet = isMobile
    ? (window as any).wanderWallet
    : (window as any).arweaveWallet;
  const walletName = isMobile ? "Wander" : "ArConnect";

  try {
    console.log(`🔗 Checking ${walletName} wallet connection...`);
    address = await wallet.getActiveAddress();
    console.log(`✅ ${walletName} wallet connected:`, address);
  } catch (error) {
    console.log(
      `🔄 ${walletName} wallet not connected, attempting to connect...`
    );
    try {
      // Request permissions for mainnet Arweave
      await wallet.connect([
        "ACCESS_ADDRESS",
        "ACCESS_PUBLIC_KEY",
        "SIGN_TRANSACTION",
        "ACCESS_ARWEAVE_CONFIG",
      ]);
      // Small delay to ensure connection is fully established
      await new Promise((resolve) => setTimeout(resolve, 500));
      address = await wallet.getActiveAddress();
      console.log(`✅ Successfully connected to ${walletName}:`, address);
    } catch (connectError) {
      console.error(`❌ Failed to connect ${walletName} wallet:`, connectError);
      throw new Error(`Please unlock your ${walletName} wallet and try again.`);
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
    size: data.length + " bytes",
  });

  // Sign transaction with wallet - this should show the popup immediately
  console.log(`✍️ Requesting ${walletName} signature...`);
  try {
    const signedTx = await wallet.sign(transaction);
    console.log(
      `✅ Transaction signed by ${walletName}, signed tx:`,
      signedTx.id
    );
    // Use the signed transaction for posting
    transaction = signedTx;
  } catch (error) {
    console.error("❌ Transaction signing failed:", error);
    if (error instanceof Error) {
      if (
        error.message.includes("User cancelled") ||
        error.message.includes("cancelled")
      ) {
        throw new Error("Transaction cancelled by user.");
      }
    }
    throw new Error(
      `Transaction signing failed. Please try again and approve the transaction in ${walletName}.`
    );
  }

  // Post transaction
  try {
    const response = await arweave.transactions.post(transaction);
    if (response.status === 200) {
      console.log("Arweave upload successful, transaction ID:", transaction.id);
      console.log(
        "Data will be available at:",
        `https://arweave.net/${transaction.id}`
      );
      return transaction.id;
    } else {
      throw new Error(
        `Upload failed with status ${response.status}: ${response.statusText}`
      );
    }
  } catch (error) {
    console.error("Failed to post transaction:", error);
    throw new Error(
      "Failed to upload to Arweave. Please check your connection and try again."
    );
  }
};

// Check if ArConnect or Wander wallet is available
export const checkArweaveWallet = (): boolean => {
  if (typeof window === "undefined") return false;

  // Check for ArConnect or Wander wallet
  const hasArConnect = (window as any).arweaveWallet;
  const hasWander =
    (window as any).wander || (window as any).arweaveWallet?.isWander;

  return hasArConnect || hasWander;
};

// Check if Wander wallet is specifically available
export const checkWanderWallet = (): boolean => {
  if (typeof window === "undefined") return false;
  return (window as any).wanderWallet !== "undefined";
};

// Check if we're on a mobile device
export const isMobileDevice = (): boolean => {
  if (typeof window === "undefined") return false;
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
    navigator.userAgent
  );
};

// Get wallet type for better user guidance
export const getWalletType = (): "arconnect" | "wander" | "unknown" => {
  if (typeof window === "undefined") return "unknown";

  if ((window as any).arweaveWallet?.isWander) return "wander";
  if ((window as any).wander) return "wander";
  if ((window as any).arweaveWallet) return "arconnect";

  return "unknown";
};

// Guide user to install appropriate wallet
export const getArConnectInstallGuide = (): {
  title: string;
  message: string;
  actionUrl?: string;
} => {
  const isMobile = isMobileDevice();
  const walletType = getWalletType();

  if (isMobile) {
    return {
      title: "Wander Wallet Required",
      message: `For mobile devices, use Wander wallet to connect to Arweave:

📱 INSTALL WANDER WALLET:
1. Visit: https://wander.app
2. Download the Wander app
3. Create or import your Arweave wallet
4. Return to this page and connect

💰 GET AR TOKENS (after setting up Wander):
• Visit any exchange: Binance, Coinbase, KuCoin, or Gate.io
• Search for "AR" (Arweave token)
• Buy ~$20-30 worth of AR tokens
• Send AR to your Wander wallet

💡 Why Arweave?
• Permanent storage (never disappears)
• Censorship-resistant
• Very cheap (~$0.001 per note)

After installing Wander and getting AR tokens, try connecting again!`,
      actionUrl: "https://wander.app",
    };
  }

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
    actionUrl: "https://arconnect.io",
  };
};

// Connect to Arweave wallet
export const connectArweaveWallet = async (): Promise<{
  address: string;
  publicKey: Uint8Array;
}> => {
  const isMobile = isMobileDevice();
  const walletType = getWalletType();

  if (isMobile) {
    // Use Wander wallet for mobile devices
    if (!checkWanderWallet()) {
      throw new Error(
        "Wander wallet not found. Please install Wander wallet app."
      );
    }

    try {
      // Check if already connected
      try {
        const existingAddress = await (
          window as any
        ).wanderWallet.getActiveAddress();
        if (existingAddress) {
          console.log("Already connected to Wander wallet:", existingAddress);
          const publicKey = await (
            window as any
          ).wanderWallet.getActivePublicKey();
          return {
            address: existingAddress,
            publicKey: new Uint8Array(publicKey),
          };
        }
      } catch (error) {
        // Not connected yet, continue with connection
      }

      // Connect to Wander wallet with required permissions
      await (window as any).wanderWallet.connect([
        "ACCESS_ADDRESS",
        "ACCESS_PUBLIC_KEY",
        "SIGN_TRANSACTION",
      ]);

      const address = await (window as any).wanderWallet.getActiveAddress();
      const publicKey = await (window as any).wanderWallet.getActivePublicKey();
      console.log("Connected to Wander wallet:", address);

      return { address, publicKey: new Uint8Array(publicKey) };
    } catch (error) {
      console.error("Failed to connect Wander wallet:", error);
      throw new Error(
        "Failed to connect to Wander wallet. Please make sure Wander is unlocked."
      );
    }
  } else {
    // Use ArConnect for desktop browsers
    if (!checkArweaveWallet()) {
      throw new Error(
        "ArConnect wallet not found. Please install ArConnect browser extension."
      );
    }

    try {
      // Check if already connected
      try {
        const existingAddress = await (
          window as any
        ).arweaveWallet.getActiveAddress();
        if (existingAddress) {
          console.log("Already connected to Arweave wallet:", existingAddress);
          const publicKey = await (
            window as any
          ).arweaveWallet.getActivePublicKey();
          return {
            address: existingAddress,
            publicKey: new Uint8Array(publicKey),
          };
        }
      } catch (error) {
        // Not connected yet, continue with connection
      }

      // Connect to wallet with required permissions
      await (window as any).arweaveWallet.connect([
        "ACCESS_ADDRESS",
        "ACCESS_PUBLIC_KEY",
        "SIGN_TRANSACTION",
      ]);

      const address = await (window as any).arweaveWallet.getActiveAddress();
      const publicKey = await (
        window as any
      ).arweaveWallet.getActivePublicKey();
      console.log("Connected to Arweave wallet:", address);

      return { address, publicKey: new Uint8Array(publicKey) };
    } catch (error) {
      console.error("Failed to connect Arweave wallet:", error);
      throw new Error(
        "Failed to connect to Arweave wallet. Please make sure ArConnect is unlocked."
      );
    }
  }
};

// Get AR balance with retry and timeout handling
export const getArweaveBalance = async (
  address: string,
  retries = 2
): Promise<number> => {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      console.log(
        `Checking AR balance (attempt ${attempt + 1}/${retries + 1})...`
      );

      // Create a timeout promise
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error("Balance check timeout")), 10000); // 10 second timeout
      });

      // Race between the balance check and timeout
      const balance = await Promise.race([
        arweave.wallets.getBalance(address),
        timeoutPromise,
      ]);

      const arBalance = arweave.ar.winstonToAr(balance as string);
      const balanceFloat = parseFloat(arBalance);
      console.log(`AR balance: ${balanceFloat} AR`);
      return balanceFloat;
    } catch (error) {
      console.error(`Balance check attempt ${attempt + 1} failed:`, error);

      if (attempt === retries) {
        // If this was the last attempt, return 0 but don't throw
        console.warn(
          "All balance check attempts failed, assuming insufficient balance for safety"
        );
        return 0;
      }

      // Wait before retrying (exponential backoff)
      await new Promise((resolve) =>
        setTimeout(resolve, Math.pow(2, attempt) * 1000)
      );
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

After getting AR tokens, return here and try publishing again.`,
  };
};
