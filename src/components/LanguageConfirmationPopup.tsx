import React, { useState } from "react";

interface LanguageConfirmationPopupProps {
  selectedLanguage: string;
  languageName: string;
  onConfirm: () => Promise<void> | void;
  onCancel: () => void;
  theme?: string;
  isTranslating?: boolean;
}

const LanguageConfirmationPopup: React.FC<LanguageConfirmationPopupProps> = ({
  selectedLanguage,
  languageName,
  onConfirm,
  onCancel,
  theme = "Dark",
  isTranslating = false,
}) => {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className={`absolute inset-0 ${
          theme === "Light" ? "bg-black/30" : "bg-black/50"
        }`}
        onClick={onCancel}
      />

      {/* Popup */}
      <div
        className={`relative max-w-md w-full mx-4 p-6 rounded-2xl shadow-2xl border ${
          theme === "Light"
            ? "bg-white border-purple-200"
            : "bg-gradient-to-br from-purple-900 via-indigo-900 to-black border-indigo-600"
        }`}
      >
        {/* Header */}
        <div className="text-center mb-6">
          <div className="text-4xl mb-3">🌐</div>
          <h2
            className={`text-xl font-bold mb-2 ${
              theme === "Light" ? "text-gray-800" : "text-white"
            }`}
          >
            Apply Language Change
          </h2>
          <p
            className={`text-sm ${
              theme === "Light" ? "text-gray-600" : "text-gray-300"
            }`}
          >
            Would you like to translate the entire application to{" "}
            <span className="font-semibold text-purple-400">
              {languageName}
            </span>
            ?
          </p>
        </div>

        {/* Preview */}
        <div
          className={`p-4 rounded-lg mb-6 border ${
            theme === "Light"
              ? "bg-purple-50 border-purple-200"
              : "bg-indigo-950/50 border-indigo-600"
          }`}
        >
          <div className="text-xs text-gray-500 mb-2">Language Code:</div>
          <div
            className={`font-mono text-sm ${
              theme === "Light" ? "text-purple-700" : "text-purple-300"
            }`}
          >
            {selectedLanguage}
          </div>
        </div>

        {/* Conditional Content */}
        {isTranslating ? (
          <div className="text-center">
            <div className="mb-4">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-purple-500"></div>
            </div>
            <h3
              className={`text-lg font-semibold mb-2 ${
                theme === "Light" ? "text-gray-800" : "text-white"
              }`}
            >
              Translating...
            </h3>
            <p
              className={`text-sm ${
                theme === "Light" ? "text-gray-600" : "text-gray-300"
              }`}
            >
              Please wait while we translate the entire application to{" "}
              <span className="font-semibold text-purple-400">
                {languageName}
              </span>
            </p>
          </div>
        ) : (
          <>
            {/* Success/Loading State */}
            <div className="text-center">
              <div className="mb-4">
                <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-green-500"></div>
              </div>
              <h3
                className={`text-lg font-semibold mb-2 ${
                  theme === "Light" ? "text-gray-800" : "text-white"
                }`}
              >
                Applying Language...
              </h3>
              <p
                className={`text-sm ${
                  theme === "Light" ? "text-gray-600" : "text-gray-300"
                }`}
              >
                The page will refresh to apply{" "}
                <span className="font-semibold text-purple-400">
                  {languageName}
                </span>{" "}
                to the entire application.
              </p>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default LanguageConfirmationPopup;
