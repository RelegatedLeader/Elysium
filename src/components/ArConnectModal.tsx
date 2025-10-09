import React from "react";

interface ArConnectModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  message: string;
  actionButton?: {
    text: string;
    onClick: () => void;
  };
}

const ArConnectModal: React.FC<ArConnectModalProps> = ({
  isOpen,
  onClose,
  title,
  message,
  actionButton,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4 p-6">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 text-xl"
          >
            ×
          </button>
        </div>

        <div className="text-gray-700 mb-6 whitespace-pre-line">{message}</div>

        <div className="flex gap-3 justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-md transition-colors"
          >
            Close
          </button>
          {actionButton && (
            <button
              onClick={actionButton.onClick}
              className="px-4 py-2 bg-blue-600 text-white hover:bg-blue-700 rounded-md transition-colors"
            >
              {actionButton.text}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default ArConnectModal;
