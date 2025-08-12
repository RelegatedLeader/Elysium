import Arweave from "arweave";
import { JWKInterface } from "arweave/node/lib/wallet";
import nacl from "tweetnacl";

// Initialize Arweave client (using mainnet)
const arweave = Arweave.init({
  host: "arweave.net",
  port: 443,
  protocol: "https",
});

// Load or generate a wallet (for now, placeholder; replace with user wallet)
let wallet: JWKInterface | undefined;
export const setWallet = (jwk: JWKInterface) => {
  wallet = jwk;
};

// Upload encrypted content to Arweave
export const uploadToArweave = async (data: Uint8Array): Promise<string> => {
  if (!wallet) throw new Error("Wallet not set. Please connect a wallet.");

  const transaction = await arweave.createTransaction(
    {
      data: data.buffer as ArrayBuffer, // Convert Uint8Array to ArrayBuffer
    },
    wallet
  );

  transaction.addTag("Content-Type", "application/octet-stream"); // Generic binary data
  transaction.addTag("App-Name", "Elysium-Notes");

  await arweave.transactions.sign(transaction, wallet);
  const response = await arweave.transactions.post(transaction);

  if (response.status === 200) {
    return transaction.id; // Return Arweave transaction hash
  } else {
    throw new Error(`Upload failed with status ${response.status}`);
  }
};

// Generate a key pair for Arweave signing (if needed separately)
export const generateArweaveKeyPair = (): JWKInterface => {
  return nacl.sign.keyPair() as unknown as JWKInterface; // Simplified; replace with proper Arweave key gen later
};
