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
    aiResponseStyle: string;
    aiPersonality: string;
    autoSave: boolean;
    defaultTemplate: string;
    noteSorting: string;
    dataRetention: number;
  }) => void;
  onCancel?: () => void;
  onCleanupOrphanedNotes?: () => void;
  initialTheme?: string;
  initialNotifications?: boolean;
  initialSyncInterval?: number;
  initialAiResponseStyle?: string;
  initialAiPersonality?: string;
  initialAutoSave?: boolean;
  initialDefaultTemplate?: string;
  initialNoteSorting?: string;
  initialDataRetention?: number;
}

const Settings: React.FC<SettingsProps> = ({
  onSave,
  onCancel,
  onCleanupOrphanedNotes,
  initialTheme = "Dark",
  initialNotifications = false,
  initialSyncInterval = 15,
  initialAiResponseStyle = "Balanced",
  initialAiPersonality = "Professional",
  initialAutoSave = true,
  initialDefaultTemplate = "Blank",
  initialNoteSorting = "Date Created",
  initialDataRetention = 365,
}) => {
  const [theme, setTheme] = useState(initialTheme);
  const [notifications, setNotifications] = useState(initialNotifications);
  const [syncInterval, setSyncInterval] = useState(initialSyncInterval);
  const [aiResponseStyle, setAiResponseStyle] = useState(initialAiResponseStyle);
  const [aiPersonality, setAiPersonality] = useState(initialAiPersonality);
  const [autoSave, setAutoSave] = useState(initialAutoSave);
  const [defaultTemplate, setDefaultTemplate] = useState(initialDefaultTemplate);
  const [noteSorting, setNoteSorting] = useState(initialNoteSorting);
  const [dataRetention, setDataRetention] = useState(initialDataRetention);
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
      syncInterval !== initialSyncInterval ||
      aiResponseStyle !== initialAiResponseStyle ||
      aiPersonality !== initialAiPersonality ||
      autoSave !== initialAutoSave ||
      defaultTemplate !== initialDefaultTemplate ||
      noteSorting !== initialNoteSorting ||
      dataRetention !== initialDataRetention;
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
      onSave({ theme, notifications, syncInterval, aiResponseStyle, aiPersonality, autoSave, defaultTemplate, noteSorting, dataRetention });
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
    <div className={`min-h-screen flex items-center justify-center text-white relative overflow-hidden ${theme === 'Light' ? 'bg-gradient-to-br from-purple-100 via-pink-50 to-indigo-100' : 'bg-gradient-to-br from-purple-900 via-indigo-900 to-black'}`}>
      <div className={`absolute inset-0 ${theme === 'Light' ? 'bg-[radial-gradient(ellipse_at_center,rgba(139,92,246,0.05)_0%,transparent_70%)]' : 'bg-[radial-gradient(ellipse_at_center,rgba(255,255,255,0.05)_0%,transparent_70%)]'} pointer-events-none`}></div>
      <div className={`p-8 ${theme === 'Light' ? 'bg-gradient-to-br from-white/90 via-purple-50/90 to-pink-50/90 border-purple-200/50' : 'bg-gradient-to-br from-indigo-900/80 via-indigo-800/80 to-purple-700/80 border-indigo-500/30'} backdrop-blur-lg border rounded-2xl shadow-2xl w-[32rem] h-auto max-w-full max-h-full flex items-center justify-center transform transition-all duration-300 ease-in-out hover:shadow-[0_0_20px_rgba(139,92,246,0.3)]`}>
        <div className="text-center space-y-6 w-full">
          <h2 className={`text-3xl font-bold mb-6 tracking-tight text-shadow-[0_2px_4px_rgba(0,0,0,0.3)] ${theme === 'Light' ? 'text-purple-800' : 'text-gold-100'}`}>
            Settings
          </h2>
          <div className="space-y-4">
            <div>
              <label
                htmlFor="theme"
                className={`block text-sm font-medium mb-1 ${theme === 'Light' ? 'text-purple-700' : 'text-gray-200'}`}
              >
                Theme
              </label>
              <select
                id="theme"
                value={theme}
                onChange={(e) => setTheme(e.target.value)}
                className={`w-full p-3 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-400 focus:border-purple-400 transition-all duration-300 ${theme === 'Light' ? 'bg-white/90 border-purple-300 text-purple-800 hover:bg-purple-50/90' : 'bg-indigo-950/90 border-indigo-600 text-white hover:bg-indigo-900/90'}`}
                aria-label="Select theme"
              >
                <option value="Dark">Dark</option>
                <option value="Light">Light</option>
              </select>
            </div>
            <div>
              <label
                htmlFor="notifications"
                className={`block text-sm font-medium mb-2 ${theme === 'Light' ? 'text-purple-700' : 'text-gray-200'}`}
              >
                Notification Preferences
              </label>
              <div className="flex items-center justify-center space-x-2">
                <input
                  id="notifications"
                  type="checkbox"
                  checked={notifications}
                  onChange={(e) => setNotifications(e.target.checked)}
                  className={`h-4 w-4 focus:ring-purple-400 border-purple-300 rounded transition-all duration-200 ${theme === 'Light' ? 'text-purple-600 bg-white border-purple-300' : 'text-indigo-400 bg-indigo-950/90 border-indigo-600'}`}
                  aria-label="Enable notifications"
                />
                <span className={`text-sm ${theme === 'Light' ? 'text-purple-700' : 'text-gray-200'}`}>
                  Enable Notifications
                </span>
              </div>
            </div>
            <div>
              <label
                htmlFor="sync-interval"
                className={`block text-sm font-medium mb-1 ${theme === 'Light' ? 'text-purple-700' : 'text-gray-200'}`}
              >
                Auto-Sync Interval (minutes)
              </label>
              <input
                id="sync-interval"
                type="number"
                min="5"
                max="120"
                value={syncInterval}
                onChange={(e) => setSyncInterval(parseInt(e.target.value) || 15)}
                className={`w-full p-3 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-400 focus:border-purple-400 transition-all duration-300 ${theme === 'Light' ? 'bg-white/90 border-purple-300 text-purple-800 hover:bg-purple-50/90' : 'bg-indigo-950/90 border-indigo-600 text-white hover:bg-indigo-900/90'}`}
                aria-label="Set sync interval"
              />
              <p className={`text-xs mt-1 ${theme === 'Light' ? 'text-purple-600' : 'text-gray-400'}`}>
                How often to automatically sync your notes (5-120 minutes)
              </p>
            </div>

            {/* AI Agent Settings */}
            <div className={`border-t pt-4 ${theme === 'Light' ? 'border-purple-200' : 'border-indigo-600'}`}>
              <h3 className={`text-lg font-semibold mb-3 ${theme === 'Light' ? 'text-purple-800' : 'text-gold-100'}`}>
                🤖 AI Agent Settings
              </h3>
              <div className="space-y-3">
                <div>
                  <label
                    htmlFor="ai-response-style"
                    className={`block text-sm font-medium mb-1 ${theme === 'Light' ? 'text-purple-700' : 'text-gray-200'}`}
                  >
                    Response Style
                  </label>
                  <select
                    id="ai-response-style"
                    value={aiResponseStyle}
                    onChange={(e) => setAiResponseStyle(e.target.value)}
                    className={`w-full p-3 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-400 focus:border-purple-400 transition-all duration-300 ${theme === 'Light' ? 'bg-white/90 border-purple-300 text-purple-800 hover:bg-purple-50/90' : 'bg-indigo-950/90 border-indigo-600 text-white hover:bg-indigo-900/90'}`}
                    aria-label="Select AI response style"
                  >
                    <option value="Concise">Concise</option>
                    <option value="Balanced">Balanced</option>
                    <option value="Detailed">Detailed</option>
                    <option value="Creative">Creative</option>
                  </select>
                </div>
                <div>
                  <label
                    htmlFor="ai-personality"
                    className={`block text-sm font-medium mb-1 ${theme === 'Light' ? 'text-purple-700' : 'text-gray-200'}`}
                  >
                    AI Personality
                  </label>
                  <select
                    id="ai-personality"
                    value={aiPersonality}
                    onChange={(e) => setAiPersonality(e.target.value)}
                    className={`w-full p-3 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-400 focus:border-purple-400 transition-all duration-300 ${theme === 'Light' ? 'bg-white/90 border-purple-300 text-purple-800 hover:bg-purple-50/90' : 'bg-indigo-950/90 border-indigo-600 text-white hover:bg-indigo-900/90'}`}
                    aria-label="Select AI personality"
                  >
                    <option value="Professional">Professional</option>
                    <option value="Friendly">Friendly</option>
                    <option value="Technical">Technical</option>
                    <option value="Creative">Creative</option>
                    <option value="Minimalist">Minimalist</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Note Management Settings */}
            <div className={`border-t pt-4 ${theme === 'Light' ? 'border-purple-200' : 'border-indigo-600'}`}>
              <h3 className={`text-lg font-semibold mb-3 ${theme === 'Light' ? 'text-purple-800' : 'text-gold-100'}`}>
                📝 Note Management
              </h3>
              <div className="space-y-3">
                <div>
                  <label className={`block text-sm font-medium mb-2 ${theme === 'Light' ? 'text-purple-700' : 'text-gray-200'}`}>
                    Auto-Save
                  </label>
                  <div className="flex items-center justify-center space-x-2">
                    <input
                      id="auto-save"
                      type="checkbox"
                      checked={autoSave}
                      onChange={(e) => setAutoSave(e.target.checked)}
                      className={`h-4 w-4 focus:ring-purple-400 border-purple-300 rounded transition-all duration-200 ${theme === 'Light' ? 'text-purple-600 bg-white border-purple-300' : 'text-indigo-400 bg-indigo-950/90 border-indigo-600'}`}
                      aria-label="Enable auto-save"
                    />
                    <span className={`text-sm ${theme === 'Light' ? 'text-purple-700' : 'text-gray-200'}`}>
                      Auto-save notes as you type
                    </span>
                  </div>
                </div>
                <div>
                  <label
                    htmlFor="default-template"
                    className={`block text-sm font-medium mb-1 ${theme === 'Light' ? 'text-purple-700' : 'text-gray-200'}`}
                  >
                    Default Template
                  </label>
                  <select
                    id="default-template"
                    value={defaultTemplate}
                    onChange={(e) => setDefaultTemplate(e.target.value)}
                    className={`w-full p-3 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-400 focus:border-purple-400 transition-all duration-300 ${theme === 'Light' ? 'bg-white/90 border-purple-300 text-purple-800 hover:bg-purple-50/90' : 'bg-indigo-950/90 border-indigo-600 text-white hover:bg-indigo-900/90'}`}
                    aria-label="Select default template"
                  >
                    <option value="Blank">Blank</option>
                    <option value="Meeting Notes">Meeting Notes</option>
                    <option value="Project Plan">Project Plan</option>
                    <option value="Journal Entry">Journal Entry</option>
                    <option value="Code Snippet">Code Snippet</option>
                    <option value="Research Notes">Research Notes</option>
                  </select>
                </div>
                <div>
                  <label
                    htmlFor="note-sorting"
                    className={`block text-sm font-medium mb-1 ${theme === 'Light' ? 'text-purple-700' : 'text-gray-200'}`}
                  >
                    Note Sorting
                  </label>
                  <select
                    id="note-sorting"
                    value={noteSorting}
                    onChange={(e) => setNoteSorting(e.target.value)}
                    className={`w-full p-3 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-400 focus:border-purple-400 transition-all duration-300 ${theme === 'Light' ? 'bg-white/90 border-purple-300 text-purple-800 hover:bg-purple-50/90' : 'bg-indigo-950/90 border-indigo-600 text-white hover:bg-indigo-900/90'}`}
                    aria-label="Select note sorting"
                  >
                    <option value="Date Modified">Date Modified (Newest First)</option>
                    <option value="Date Created">Date Created (Newest First)</option>
                    <option value="Alphabetical">Alphabetical (A-Z)</option>
                    <option value="Custom">Custom Order</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Privacy & Security Settings */}
            <div className={`border-t pt-4 ${theme === 'Light' ? 'border-purple-200' : 'border-indigo-600'}`}>
              <h3 className={`text-lg font-semibold mb-3 ${theme === 'Light' ? 'text-purple-800' : 'text-gold-100'}`}>
                🔒 Privacy & Security
              </h3>
              <div className="space-y-3">
                <div>
                  <label
                    htmlFor="data-retention"
                    className={`block text-sm font-medium mb-1 ${theme === 'Light' ? 'text-purple-700' : 'text-gray-200'}`}
                  >
                    Data Retention (days)
                  </label>
                  <select
                    id="data-retention"
                    value={dataRetention}
                    onChange={(e) => setDataRetention(parseInt(e.target.value))}
                    className={`w-full p-3 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-400 focus:border-purple-400 transition-all duration-300 ${theme === 'Light' ? 'bg-white/90 border-purple-300 text-purple-800 hover:bg-purple-50/90' : 'bg-indigo-950/90 border-indigo-600 text-white hover:bg-indigo-900/90'}`}
                    aria-label="Select data retention period"
                  >
                    <option value={30}>30 days</option>
                    <option value={90}>90 days</option>
                    <option value={365}>1 year</option>
                    <option value={-1}>Forever</option>
                  </select>
                  <p className={`text-xs mt-1 ${theme === 'Light' ? 'text-purple-600' : 'text-gray-400'}`}>
                    How long to keep deleted notes before permanent removal
                  </p>
                </div>
              </div>
            </div>

            {onCleanupOrphanedNotes && (
              <div>
                <label className={`block text-sm font-medium mb-2 ${theme === 'Light' ? 'text-purple-700' : 'text-gray-200'}`}>
                  Database Maintenance
                </label>
                <div className="text-center space-y-2">
                  <p className={`text-xs ${theme === 'Light' ? 'text-purple-600' : 'text-yellow-300'}`}>
                    Clean up notes that were encrypted with an old method and cannot be recovered
                  </p>
                  <button
                    onClick={onCleanupOrphanedNotes}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${theme === 'Light' ? 'bg-red-600 hover:bg-red-700 text-white' : 'bg-red-600 hover:bg-red-700 text-white'}`}
                  >
                    Clean Up Orphaned Notes
                  </button>
                </div>
              </div>
            )}
            <div>
              <label className={`block text-sm font-medium mb-2 ${theme === 'Light' ? 'text-purple-700' : 'text-gray-200'}`}>
                Support Elysium
              </label>
              <div className="text-center space-y-2">
                <p className={`text-xs ${theme === 'Light' ? 'text-purple-600' : 'text-yellow-300'} break-all font-mono bg-opacity-50 p-2 rounded ${theme === 'Light' ? 'bg-purple-100 text-purple-800' : 'bg-indigo-950/50'}`}>
                  Donate SOL to: 7utEYstQZSbmei5SoUjBbrNSqzV2q1ZUgUpWwQKFeWxv
                </p>
                <button
                  onClick={handleDonateClick}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${theme === 'Light' ? 'bg-purple-600 hover:bg-purple-700 text-white' : 'bg-purple-600 hover:bg-purple-700 text-white'}`}
                >
                  Donate SOL
                </button>
              </div>
            </div>
          </div>
          {hasChanges && (
            <div className="flex justify-center space-x-4 mt-6">
              <button
                onClick={handleCancel}
                className={`py-2 px-6 rounded-lg transition-all duration-200 ${theme === 'Light' ? 'bg-gray-200 hover:bg-gray-300 text-purple-800' : 'bg-gray-700 hover:bg-gray-800 text-white'}`}
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                className={`py-2 px-6 rounded-lg transition-all duration-200 ${theme === 'Light' ? 'bg-purple-600 hover:bg-purple-700 text-white' : 'bg-green-700 hover:bg-green-800 text-white'}`}
              >
                Save Settings
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
