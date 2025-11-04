import React from "react";

interface DeleteConfirmationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  theme?: string;
}

const DeleteConfirmationModal: React.FC<DeleteConfirmationModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmText = "Delete",
  cancelText = "Cancel",
  theme = "Dark",
}) => {
  if (!isOpen) return null;

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      onClick={handleBackdropClick}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black bg-opacity-50 backdrop-blur-sm"></div>

      {/* Modal */}
      <div
        className={`relative max-w-md w-full mx-4 p-6 rounded-lg shadow-2xl border ${
          theme === "Light"
            ? "bg-white border-gray-200"
            : "bg-gradient-to-br from-indigo-900 to-purple-900 border-indigo-700"
        }`}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <h3
            className={`text-lg font-semibold ${
              theme === "Light" ? "text-gray-900" : "text-white"
            }`}
          >
            {title}
          </h3>
          <button
            onClick={onClose}
            className={`text-2xl leading-none hover:opacity-70 transition-opacity ${
              theme === "Light" ? "text-gray-500" : "text-gray-400"
            }`}
          >
            ×
          </button>
        </div>

        {/* Message */}
        <p
          className={`mb-6 ${
            theme === "Light" ? "text-gray-700" : "text-gray-300"
          }`}
        >
          {message}
        </p>

        {/* Buttons */}
        <div className="flex justify-end space-x-3">
          <button
            onClick={onClose}
            className={`px-4 py-2 rounded-lg transition-colors ${
              theme === "Light"
                ? "bg-gray-200 text-gray-800 hover:bg-gray-300"
                : "bg-indigo-700 text-white hover:bg-indigo-600"
            }`}
          >
            {cancelText}
          </button>
          <button
            onClick={onConfirm}
            className="px-4 py-2 bg-gradient-to-r from-red-600 to-red-700 text-white rounded-lg hover:from-red-700 hover:to-red-800 transition-all duration-200 shadow-lg hover:shadow-red-500/25"
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
};

export default DeleteConfirmationModal;
