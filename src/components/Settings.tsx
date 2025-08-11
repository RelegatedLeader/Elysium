import React, { useState, useEffect } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import {
  Connection,
  PublicKey,
  SystemProgram,
  Transaction,
} from "@solana/web3.js";

interface SettingsProps {
  onSave?: (settings: {
    theme: string;
    notifications: boolean;
    syncInterval: number;
  }) => void;
  onCancel?: () => void;
  initialTheme?: string;
  initialNotifications?: boolean;
  initialSyncInterval?: number;
}

const Settings: React.FC<SettingsProps> = ({
  onSave,
  onCancel,
  initialTheme = "Dark",
  initialNotifications = false,
  initialSyncInterval = 15,
}) => {
  const [theme, setTheme] = useState(initialTheme);
  const [notifications, setNotifications] = useState(initialNotifications);
  const [syncInterval, setSyncInterval] = useState(initialSyncInterval);
  const [hasChanges, setHasChanges] = useState(false);
  const [donateAmount, setDonateAmount] = useState<number | null>(null);
  const [showDonateModal, setShowDonateModal] = useState(false);
  const [rpcError, setRpcError] = useState<string | null>(null);

  const { publicKey, sendTransaction } = useWallet();
  const connection = new Connection(
    "https://api.mainnet-beta.solana.com",
    "confirmed"
  ); // Mainnet-beta endpoint

  // Track changes to settings
  useEffect(() => {
    const settingsChanged =
      theme !== initialTheme ||
      notifications !== initialNotifications ||
      syncInterval !== initialSyncInterval;
    setHasChanges(settingsChanged);
  }, [
    theme,
    notifications,
    syncInterval,
    initialTheme,
    initialNotifications,
    initialSyncInterval,
  ]);

  const handleSave = () => {
    if (onSave && hasChanges) {
      onSave({ theme, notifications, syncInterval });
      setHasChanges(false); // Reset after saving
    }
  };

  const handleCancel = () => {
    setTheme(initialTheme);
    setNotifications(initialNotifications);
    setSyncInterval(initialSyncInterval);
    setHasChanges(false);
    if (onCancel) onCancel();
  };

  const handleDonateClick = () => {
    if (!publicKey) {
      alert("Please connect your wallet to donate.");
      return;
    }
    setShowDonateModal(true);
  };

  const handleDonate = async () => {
    if (!donateAmount || donateAmount <= 0 || !publicKey || !sendTransaction) {
      alert("Invalid amount or wallet not connected.");
      return;
    }

    setRpcError(null); // Reset error state

    try {
      const recipient = new PublicKey(
        "7utEYstQZSbmei5SoUjBbrNSqzV2q1ZUgUpWwQKFeWxv"
      );
      const lamports = Math.floor(donateAmount * 1_000_000_000); // Convert SOL to lamports

      const transaction = new Transaction().add(
        SystemProgram.transfer({
          fromPubkey: publicKey,
          toPubkey: recipient,
          lamports,
        })
      );

      // Fetch recent blockhash with retry logic
      let { blockhash, lastValidBlockHeight } =
        await connection.getLatestBlockhash();
      const startTime = Date.now();
      while (Date.now() - startTime < 5000) {
        // Retry for 5 seconds
        try {
          ({ blockhash, lastValidBlockHeight } =
            await connection.getLatestBlockhash());
          break;
        } catch (e) {
          if ((e as any).message.includes("403")) {
            throw new Error(
              "Access forbidden. Please configure a custom RPC endpoint with an API key from a provider like QuickNode or Alchemy."
            );
          }
          await new Promise((resolve) => setTimeout(resolve, 500)); // Wait 500ms before retry
        }
      }

      transaction.recentBlockhash = blockhash;
      transaction.feePayer = publicKey;

      // Use sendTransaction to trigger wallet popup with correct options
      const signature = await sendTransaction(transaction, connection, {
        signers: [],
        preflightCommitment: "confirmed", // Use preflightCommitment instead of commitment
      });

      // Confirm transaction
      await connection.confirmTransaction(
        { signature, blockhash, lastValidBlockHeight },
        "confirmed"
      );

      alert(`Donation successful! Transaction signature: ${signature}`);
      setShowDonateModal(false);
      setDonateAmount(null);
    } catch (error: any) {
      console.error("Donation failed:", error);
      if (error.message.includes("403")) {
        setRpcError(
          "Failed to connect to the Solana network. Please configure a custom RPC endpoint with an API key (e.g., from QuickNode or Alchemy) in your app settings or contact support."
        );
      } else {
        setRpcError(`Donation failed: ${error.message || "Please try again."}`);
      }
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-purple-900 via-indigo-900 to-black text-white relative overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(255,255,255,0.05)_0%,transparent_70%)] pointer-events-none"></div>
      <div className="p-8 bg-gradient-to-br from-indigo-900/80 via-indigo-800/80 to-purple-700/80 backdrop-blur-lg border border-indigo-500/30 rounded-2xl shadow-2xl w-[30rem] h-[30rem] max-w-full max-h-full flex items-center justify-center transform transition-all duration-300 ease-in-out hover:shadow-[0_0_20px_rgba(79,70,229,0.5)]">
        <div className="text-center space-y-6 w-full">
          <h2 className="text-3xl font-bold text-gold-100 mb-6 tracking-tight text-shadow-[0_2px_4px_rgba(0,0,0,0.3)]">
            Settings
          </h2>
          <div className="space-y-4">
            <div>
              <label
                htmlFor="theme"
                className="block text-sm font-medium text-gray-200 mb-1"
              >
                Theme
              </label>
              <select
                id="theme"
                value={theme}
                onChange={(e) => setTheme(e.target.value)}
                className="w-full p-3 bg-indigo-950/90 border border-indigo-600 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-indigo-400 transition-all duration-300 hover:bg-indigo-900/90"
                aria-label="Select theme"
              >
                <option>Dark</option>
                <option>Light</option>
              </select>
            </div>
            <div>
              <label
                htmlFor="notifications"
                className="block text-sm font-medium text-gray-200 mb-2"
              >
                Notification Preferences
              </label>
              <div className="flex items-center justify-center space-x-2">
                <input
                  id="notifications"
                  type="checkbox"
                  checked={notifications}
                  onChange={(e) => setNotifications(e.target.checked)}
                  className="h-4 w-4 text-indigo-400 focus:ring-indigo-400 border-indigo-600 rounded bg-indigo-950/90 transition-all duration-200"
                  aria-label="Enable notifications"
                />
                <span className="text-sm text-gray-200">
                  Enable Notifications
                </span>
              </div>
            </div>
            <div>
              <label
                htmlFor="sync-interval"
                className="block text-sm font-medium text-gray-200 mb-1"
              >
                Sync Interval (minutes)
              </label>
              <input
                id="sync-interval"
                type="number"
                value={syncInterval}
                onChange={(e) => setSyncInterval(parseInt(e.target.value) || 0)}
                className="w-full p-3 bg-indigo-950/90 border border-indigo-600 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-indigo-400 transition-all duration-300 hover:bg-indigo-900/90"
                aria-label="Set sync interval"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-200 mb-2">
                Donate to Support Elysium
              </label>
              <div className="flex items-center justify-center space-x-4">
                <p className="text-xs text-yellow-300 break-all font-mono">
                  7utEYstQZSbmei5SoUjBbrNSqzV2q1ZUgUpWwQKFeWxv
                </p>
              </div>
            </div>
          </div>
          {hasChanges && (
            <div className="flex justify-center space-x-4 mt-6">
              <button
                onClick={handleCancel}
                className="bg-gray-700 hover:bg-gray-800 text-white py-2 px-6 rounded-lg transition-all duration-200"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                className="bg-green-700 hover:bg-green-800 text-white py-2 px-6 rounded-lg transition-all duration-200"
              >
                Save
              </button>
            </div>
          )}
          {rpcError && <p className="text-red-400 text-sm mt-4">{rpcError}</p>}
        </div>
      </div>

      {showDonateModal && (
        <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50 z-50">
          <div className="bg-gradient-to-br from-indigo-900/80 via-indigo-800/80 to-purple-700/80 p-6 rounded-2xl shadow-2xl w-80">
            <h3 className="text-xl font-bold text-gold-100 mb-4">Donate SOL</h3>
            <input
              type="number"
              step="0.01"
              min="0"
              placeholder="Enter amount in SOL"
              value={donateAmount || ""}
              onChange={(e) =>
                setDonateAmount(parseFloat(e.target.value) || null)
              }
              className="w-full p-3 bg-indigo-950/90 border border-indigo-600 rounded-lg text-white text-sm mb-4"
            />
            <div className="flex justify-end space-x-4">
              <button
                onClick={() => {
                  setShowDonateModal(false);
                  setDonateAmount(null);
                  setRpcError(null);
                }}
                className="bg-gray-700 hover:bg-gray-800 text-white py-2 px-4 rounded-lg"
              >
                Cancel
              </button>
              <button
                onClick={handleDonate}
                className="bg-blue-600 hover:bg-blue-700 text-white py-2 px-4 rounded-lg"
                disabled={!donateAmount || donateAmount <= 0}
              >
                Send
              </button>
            </div>
            {rpcError && (
              <p className="text-red-400 text-xs mt-2">{rpcError}</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default Settings;
