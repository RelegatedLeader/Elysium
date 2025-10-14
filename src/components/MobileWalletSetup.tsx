import React, { useState, useEffect } from "react";
import {
  checkArweaveWallet,
  checkWanderWallet,
  isMobileDevice,
  getArConnectInstallGuide,
} from "../utils/arweave-utils";

interface MobileWalletSetupProps {
  isOpen: boolean;
  onClose: () => void;
  onWalletConnected: (address: string, publicKey: Uint8Array) => void;
  theme: string;
}

type SetupStep = "detect" | "install" | "connect" | "verify" | "success";

const MobileWalletSetup: React.FC<MobileWalletSetupProps> = ({
  isOpen,
  onClose,
  onWalletConnected,
  theme,
}) => {
  const [currentStep, setCurrentStep] = useState<SetupStep>("detect");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [walletAddress, setWalletAddress] = useState<string | null>(null);

  const isMobile = isMobileDevice();
  const walletName = isMobile ? "Wander" : "ArConnect";

  useEffect(() => {
    if (isOpen) {
      checkWalletStatus();
    }
  }, [isOpen]);

  const checkWalletStatus = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const hasWallet = isMobile ? checkWanderWallet() : checkArweaveWallet();

      if (!hasWallet) {
        setCurrentStep("install");
      } else {
        // Check if already connected
        try {
          const wallet = isMobile
            ? (window as any).wanderWallet
            : (window as any).arweaveWallet;
          const address = await wallet.getActiveAddress();
          if (address) {
            setWalletAddress(address);
            setCurrentStep("success");
            return;
          }
        } catch (e) {
          // Not connected, proceed to connect step
        }
        setCurrentStep("connect");
      }
    } catch (err) {
      setError("Failed to check wallet status");
      setCurrentStep("detect");
    } finally {
      setIsLoading(false);
    }
  };

  const handleInstallWallet = () => {
    const guide = getArConnectInstallGuide();
    if (guide.actionUrl) {
      window.open(guide.actionUrl, "_blank");
    }
  };

  const handleConnectWallet = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const wallet = isMobile
        ? (window as any).wanderWallet
        : (window as any).arweaveWallet;

      // Request permissions
      await wallet.connect([
        "ACCESS_ADDRESS",
        "ACCESS_PUBLIC_KEY",
        "SIGN_TRANSACTION",
        "ACCESS_ARWEAVE_CONFIG",
      ]);

      // Get wallet info
      const address = await wallet.getActiveAddress();
      const publicKey = await wallet.getActivePublicKey();

      setWalletAddress(address);
      setCurrentStep("verify");

      // Small delay for verification
      setTimeout(() => {
        setCurrentStep("success");
        onWalletConnected(address, new Uint8Array(publicKey));
      }, 2000);
    } catch (err: any) {
      if (
        err.message?.includes("User cancelled") ||
        err.message?.includes("cancelled")
      ) {
        setError("Connection cancelled. Please try again.");
      } else {
        setError(`Failed to connect ${walletName}. Please try again.`);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleRetry = () => {
    setCurrentStep("detect");
    setError(null);
    checkWalletStatus();
  };

  if (!isOpen) return null;

  const renderStepContent = () => {
    switch (currentStep) {
      case "detect":
        return (
          <div className="text-center">
            <div className="mb-6">
              <div className="inline-block animate-spin rounded-full h-12 w-12 border-4 border-indigo-500 border-t-transparent"></div>
            </div>
            <h3
              className={`text-xl font-semibold mb-4 font-serif ${
                theme === "Light" ? "text-purple-900" : "text-gold-100"
              }`}
            >
              Detecting Wallet
            </h3>
            <p className="text-gray-300 text-sm">
              Checking for {walletName} wallet...
            </p>
          </div>
        );

      case "install":
        const guide = getArConnectInstallGuide();
        return (
          <div className="text-center">
            <div className="mb-6">
              <div className="text-4xl">📱</div>
            </div>
            <h3
              className={`text-xl font-semibold mb-4 font-serif ${
                theme === "Light" ? "text-purple-900" : "text-gold-100"
              }`}
            >
              {guide.title}
            </h3>
            <div className="text-left text-sm text-gray-300 mb-6 bg-black/20 p-4 rounded-lg">
              {guide.message.split("\n").map((line, i) => (
                <p key={i} className="mb-2">
                  {line}
                </p>
              ))}
            </div>
            <div className="space-y-3">
              <button
                onClick={handleInstallWallet}
                className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-3 px-4 rounded-lg shadow-md transition-all duration-200"
              >
                🚀 Install {walletName}
              </button>
              <button
                onClick={handleRetry}
                className="w-full bg-gray-600 hover:bg-gray-700 text-white font-semibold py-2 px-4 rounded-lg shadow-md transition-all duration-200 text-sm"
              >
                🔄 Check Again
              </button>
            </div>
          </div>
        );

      case "connect":
        return (
          <div className="text-center">
            <div className="mb-6">
              <div className="text-4xl">🔗</div>
            </div>
            <h3
              className={`text-xl font-semibold mb-4 font-serif ${
                theme === "Light" ? "text-purple-900" : "text-gold-100"
              }`}
            >
              Connect {walletName}
            </h3>
            <p className="text-gray-300 text-sm mb-6">
              {walletName} detected! Click below to connect your wallet and
              grant the necessary permissions.
            </p>
            <button
              onClick={handleConnectWallet}
              disabled={isLoading}
              className="w-full bg-green-600 hover:bg-green-700 disabled:bg-gray-600 text-white font-semibold py-3 px-4 rounded-lg shadow-md transition-all duration-200"
            >
              {isLoading ? "Connecting..." : `🔗 Connect ${walletName}`}
            </button>
          </div>
        );

      case "verify":
        return (
          <div className="text-center">
            <div className="mb-6">
              <div className="inline-block animate-spin rounded-full h-12 w-12 border-4 border-green-500 border-t-transparent"></div>
            </div>
            <h3
              className={`text-xl font-semibold mb-4 font-serif ${
                theme === "Light" ? "text-purple-900" : "text-gold-100"
              }`}
            >
              Verifying Connection
            </h3>
            <p className="text-gray-300 text-sm mb-4">
              Connected to:{" "}
              <span className="text-green-400 font-mono text-xs">
                {walletAddress}
              </span>
            </p>
            <p className="text-gray-300 text-sm">
              Verifying wallet permissions...
            </p>
          </div>
        );

      case "success":
        return (
          <div className="text-center">
            <div className="mb-6">
              <div className="text-4xl">✅</div>
            </div>
            <h3
              className={`text-xl font-semibold mb-4 font-serif ${
                theme === "Light" ? "text-purple-900" : "text-gold-100"
              }`}
            >
              Wallet Connected!
            </h3>
            <p className="text-gray-300 text-sm mb-4">
              Successfully connected to {walletName}
            </p>
            <p className="text-green-400 font-mono text-xs mb-6 break-all">
              {walletAddress}
            </p>
            <button
              onClick={onClose}
              className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-3 px-4 rounded-lg shadow-md transition-all duration-200"
            >
              🎉 Continue to Elysium
            </button>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-80 flex items-center justify-center z-50 p-4">
      <div className="bg-gradient-to-br from-purple-900 via-indigo-900 to-black p-6 rounded-lg shadow-2xl text-white w-full max-w-md transform transition-all duration-300 ease-in-out border border-indigo-700/50">
        <div className="flex justify-between items-center mb-6">
          <h2
            className={`text-lg font-semibold font-serif ${
              theme === "Light" ? "text-purple-900" : "text-gold-100"
            }`}
          >
            Wallet Setup
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors"
          >
            ✕
          </button>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-900/50 border border-red-700 rounded-lg">
            <p className="text-red-300 text-sm">{error}</p>
          </div>
        )}

        {renderStepContent()}

        {currentStep !== "detect" && currentStep !== "success" && (
          <div className="mt-6 flex justify-center space-x-2">
            <div
              className={`w-2 h-2 rounded-full ${
                currentStep === "install" ? "bg-indigo-500" : "bg-gray-600"
              }`}
            ></div>
            <div
              className={`w-2 h-2 rounded-full ${
                currentStep === "connect" ? "bg-indigo-500" : "bg-gray-600"
              }`}
            ></div>
            <div
              className={`w-2 h-2 rounded-full ${
                currentStep === "verify" ? "bg-indigo-500" : "bg-gray-600"
              }`}
            ></div>
          </div>
        )}
      </div>
    </div>
  );
};

export default MobileWalletSetup;
