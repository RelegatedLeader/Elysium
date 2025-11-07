import React, { useState } from "react";

interface LanguageSelectorProps {
  currentLanguage: string;
  onLanguageChange: (languageCode: string) => void;
  languageNames: { [key: string]: string };
  isTranslating: boolean;
}

const LanguageSelector: React.FC<LanguageSelectorProps> = ({
  currentLanguage,
  onLanguageChange,
  languageNames,
  isTranslating,
}) => {
  const [isOpen, setIsOpen] = useState(false);

  // Define the 12 most commonly used languages
  const popularLanguages = [
    { code: "en", name: "English", flag: "🇺🇸" },
    { code: "es", name: "Spanish", flag: "🇪🇸" },
    { code: "fr", name: "French", flag: "🇫🇷" },
    { code: "de", name: "German", flag: "🇩🇪" },
    { code: "it", name: "Italian", flag: "🇮🇹" },
    { code: "pt", name: "Portuguese", flag: "🇵🇹" },
    { code: "ru", name: "Russian", flag: "🇷🇺" },
    { code: "ja", name: "Japanese", flag: "🇯🇵" },
    { code: "ko", name: "Korean", flag: "🇰🇷" },
    { code: "zh", name: "Chinese", flag: "🇨🇳" },
    { code: "ar", name: "Arabic", flag: "🇸🇦" },
    { code: "hi", name: "Hindi", flag: "🇮🇳" },
  ];

  const currentLangData = popularLanguages.find(
    (lang) => lang.code === currentLanguage
  ) || { code: "en", name: "English", flag: "🇺🇸" };

  const handleLanguageChange = (languageCode: string) => {
    if (languageCode !== currentLanguage && !isTranslating) {
      onLanguageChange(languageCode);
      setIsOpen(false);
    }
  };

  return (
    <div className="language-selector relative">
      <label className="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-200">
        Language
      </label>

      {/* Dropdown Button */}
      <button
        onClick={() => !isTranslating && setIsOpen(!isOpen)}
        disabled={isTranslating}
        className={`w-full p-3 border rounded-lg text-left transition-all flex items-center justify-between ${
          isTranslating
            ? "bg-gray-100 dark:bg-gray-800 border-gray-300 dark:border-gray-600 cursor-not-allowed opacity-75"
            : "bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 hover:border-blue-500 dark:hover:border-blue-400 cursor-pointer"
        }`}
      >
        <div className="flex items-center space-x-3">
          <span className="text-2xl">{currentLangData.flag}</span>
          <div>
            <div
              className={`font-medium ${
                isTranslating
                  ? "text-gray-500"
                  : "text-gray-900 dark:text-gray-100"
              }`}
            >
              {currentLangData.name}
            </div>
            <div className="text-sm text-gray-500 dark:text-gray-400">
              {currentLangData.code.toUpperCase()}
            </div>
          </div>
        </div>
        <svg
          className={`w-5 h-5 transition-transform ${
            isOpen ? "rotate-180" : ""
          } ${isTranslating ? "text-gray-400" : "text-gray-500"}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M19 9l-7 7-7-7"
          />
        </svg>
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div className="absolute z-50 w-full mt-1 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg shadow-lg max-h-64 overflow-y-auto">
          {popularLanguages.map((lang) => (
            <button
              key={lang.code}
              onClick={() => handleLanguageChange(lang.code)}
              disabled={isTranslating}
              className={`w-full p-3 text-left hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors flex items-center space-x-3 first:rounded-t-lg last:rounded-b-lg ${
                currentLanguage === lang.code
                  ? "bg-blue-50 dark:bg-blue-900/20 border-l-4 border-blue-500"
                  : ""
              }`}
            >
              <span className="text-2xl">{lang.flag}</span>
              <div>
                <div
                  className={`font-medium ${
                    currentLanguage === lang.code
                      ? "text-blue-700 dark:text-blue-300"
                      : "text-gray-900 dark:text-gray-100"
                  }`}
                >
                  {lang.name}
                </div>
                <div className="text-sm text-gray-500 dark:text-gray-400">
                  {lang.code.toUpperCase()}
                </div>
              </div>
              {currentLanguage === lang.code && (
                <svg
                  className="w-5 h-5 text-blue-500 ml-auto"
                  fill="currentColor"
                  viewBox="0 0 20 20"
                >
                  <path
                    fillRule="evenodd"
                    d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                    clipRule="evenodd"
                  />
                </svg>
              )}
            </button>
          ))}
        </div>
      )}

      {/* Loading State */}
      {isTranslating && (
        <div className="mt-3 flex items-center space-x-2 text-sm text-blue-600 dark:text-blue-400">
          <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            ></circle>
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            ></path>
          </svg>
          <span>Translating page content...</span>
        </div>
      )}

      {/* Helper Text */}
      <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
        Note: User-generated content (notes) will remain in their original
        language.
      </p>

      {/* Click outside to close */}
      {isOpen && (
        <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
      )}
    </div>
  );
};

export default LanguageSelector;
