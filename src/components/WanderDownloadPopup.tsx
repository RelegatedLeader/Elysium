import React from "react";

interface WanderDownloadPopupProps {
  isOpen: boolean;
  onClose: () => void;
  theme: string;
}

const WanderDownloadPopup: React.FC<WanderDownloadPopupProps> = ({
  isOpen,
  onClose,
  theme,
}) => {
  if (!isOpen) return null;

  const handleDownload = () => {
    window.open("https://arconnect.io", "_blank");
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div
        className={`relative max-w-md w-full rounded-2xl shadow-2xl border ${
          theme === "Light"
            ? "bg-white border-purple-200"
            : "bg-gray-800 border-gold-700"
        }`}
      >
        {/* Close button */}
        <button
          onClick={onClose}
          className={`absolute top-4 right-4 w-8 h-8 rounded-full flex items-center justify-center transition-colors ${
            theme === "Light"
              ? "hover:bg-purple-100 text-purple-600"
              : "hover:bg-gray-700 text-gold-400"
          }`}
        >
          ✕
        </button>

        {/* Content */}
        <div className="p-8 text-center">
          {/* Wander Logo/Icon */}
          <div className="mb-6">
            <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-gradient-to-br from-purple-500 to-gold-500 flex items-center justify-center">
              <svg
                className="w-10 h-10 text-white"
                fill="currentColor"
                viewBox="0 0 24 24"
              >
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z" />
              </svg>
            </div>
            <h2
              className={`text-2xl font-bold mb-2 ${
                theme === "Light" ? "text-purple-900" : "text-gold-100"
              }`}
            >
              Connect with ArConnect Web
            </h2>
            <p
              className={`text-sm leading-relaxed ${
                theme === "Light" ? "text-purple-600" : "text-gold-300"
              }`}
            >
              Use ArConnect's web interface to connect your Arweave wallet on mobile.
              No app installation required - works directly in your browser.
            </p>
          </div>

          {/* Features */}
          <div className="mb-8 space-y-3">
            <div className="flex items-center justify-center space-x-3">
              <div className="w-2 h-2 rounded-full bg-green-500"></div>
              <span
                className={`text-sm ${
                  theme === "Light" ? "text-purple-700" : "text-gold-200"
                }`}
              >
                Browser-based wallet connection
              </span>
            </div>
            <div className="flex items-center justify-center space-x-3">
              <div className="w-2 h-2 rounded-full bg-green-500"></div>
              <span
                className={`text-sm ${
                  theme === "Light" ? "text-purple-700" : "text-gold-200"
                }`}
              >
                No app installation required
              </span>
            </div>
            <div className="flex items-center justify-center space-x-3">
              <div className="w-2 h-2 rounded-full bg-green-500"></div>
              <span
                className={`text-sm ${
                  theme === "Light" ? "text-purple-700" : "text-gold-200"
                }`}
              >
                Secure Arweave transactions
              </span>
            </div>
          </div>

          {/* Download Button */}
          <button
            onClick={handleDownload}
            className="w-full py-4 px-6 rounded-xl font-semibold text-white bg-gradient-to-r from-purple-600 to-gold-600 hover:from-purple-700 hover:to-gold-700 transition-all duration-300 transform hover:scale-105 shadow-lg hover:shadow-xl mb-4"
          >
            Open ArConnect Web Wallet
          </button>

          {/* Alternative */}
          <p
            className={`text-xs ${
              theme === "Light" ? "text-purple-500" : "text-gold-400"
            }`}
          >
            Or continue with desktop ArConnect for now
          </p>
        </div>
      </div>
    </div>
  );
};

export default WanderDownloadPopup;