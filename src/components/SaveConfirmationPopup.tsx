import React from "react";

interface SaveConfirmationPopupProps {
  isOpen: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  theme?: string;
  message: string;
}

const SaveConfirmationPopup: React.FC<SaveConfirmationPopupProps> = ({
  isOpen,
  onConfirm,
  onCancel,
  theme = "Dark",
  message,
}) => {
  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
      onClick={onCancel}
    >
      <div
        className={`p-8 rounded-2xl shadow-2xl w-[30rem] max-w-full flex items-center justify-center transform transition-all duration-300 ease-in-out ${
          theme === "Light"
            ? "bg-gradient-to-br from-white/90 via-purple-50/90 to-indigo-50/90 border border-purple-200/50"
            : "bg-gradient-to-br from-indigo-900 via-indigo-800 to-purple-700"
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="text-center">
          <h2 className="text-3xl font-extrabold mb-6 text-gold-100">
            Confirm Save
          </h2>
          <p
            className={`mb-8 ${
              theme === "Light" ? "text-gray-700" : "text-silver-200"
            }`}
          >
            {message}
          </p>
          <div className="flex justify-center space-x-4">
            <button
              onClick={onCancel}
              className={`py-2 px-6 rounded-lg transition-all duration-200 ${
                theme === "Light"
                  ? "bg-gray-300 hover:bg-gray-400 text-gray-800"
                  : "bg-gray-700 hover:bg-gray-800 text-white"
              }`}
            >
              Cancel
            </button>
            <button
              onClick={onConfirm}
              className="bg-gradient-to-r from-green-600 to-blue-600 hover:from-green-700 hover:to-blue-700 text-white py-2 px-6 rounded-lg transition-all duration-200"
            >
              Save
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SaveConfirmationPopup;
