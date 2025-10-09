import React from "react";

interface LogoutProps {
  onConfirm: () => void;
  onCancel: () => void;
  theme?: string;
}

const Logout: React.FC<LogoutProps> = ({
  onConfirm,
  onCancel,
  theme = "Dark",
}) => {
  return (
    <div
      className={`flex items-center justify-center text-white relative overflow-hidden ${
        theme === "Light"
          ? "bg-gradient-to-br from-purple-100 via-pink-50 to-indigo-100"
          : "bg-gradient-to-br from-purple-900 via-indigo-900 to-black"
      }`}
      onClick={onCancel}
    >
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(255,255,255,0.05)_0%,transparent_70%)] pointer-events-none"></div>
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
            Confirm Logout
          </h2>
          <p className="text-silver-200 mb-8">
            Are you sure you want to log out?
          </p>
          <div className="flex justify-center space-x-4">
            <button
              onClick={onCancel}
              className="bg-gray-700 hover:bg-gray-800 text-white py-2 px-6 rounded-lg transition-all duration-200"
            >
              Cancel
            </button>
            <button
              onClick={onConfirm}
              className="bg-red-700 hover:bg-red-800 text-white py-2 px-6 rounded-lg transition-all duration-200"
            >
              Logout
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Logout;
