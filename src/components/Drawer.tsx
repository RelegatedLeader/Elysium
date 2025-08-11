import React, { useState } from "react";

interface DrawerProps {
  onNavigate: (page: "recent" | "create" | "settings" | "logout") => void;
}

const Drawer: React.FC<DrawerProps> = ({ onNavigate }) => {
  const [isOpen, setIsOpen] = useState(false);

  const toggleDrawer = () => {
    setIsOpen(!isOpen);
  };

  const handleNavigate = (
    page: "recent" | "create" | "settings" | "logout"
  ) => {
    onNavigate(page);
    setIsOpen(false); // Close the drawer after navigation
  };

  return (
    <>
      <button
        onClick={toggleDrawer}
        className="fixed top-6 left-6 z-50 text-white hover:text-gray-200 focus:outline-none transition-colors duration-300 ease-in-out"
      >
        <svg
          className="h-8 w-8"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M4 6h16M4 12h16M4 18h16"
          />
        </svg>
      </button>

      <div
        className={`fixed top-0 left-0 h-full w-64 bg-gradient-to-br from-purple-900 via-indigo-900 to-black text-white transform transition-transform duration-300 ease-in-out shadow-2xl z-40 ${
          isOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <button
          onClick={toggleDrawer}
          className="absolute top-6 right-6 text-white hover:text-gray-300 focus:outline-none transition-colors duration-300 ease-in-out"
        >
          <svg
            className="h-6 w-6"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        </button>

        <nav className="mt-20 px-6 space-y-4">
          <input
            type="text"
            placeholder="Search notes..."
            className="w-full py-3 px-4 rounded-lg bg-gradient-to-br from-indigo-800 to-indigo-900 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all duration-300 ease-in-out"
          />
          <button
            onClick={() => handleNavigate("recent")}
            className="w-full py-3 px-4 rounded-lg bg-gradient-to-br from-indigo-800 to-indigo-900 bg-opacity-70 hover:bg-opacity-90 transition-all duration-300 ease-in-out text-left"
          >
            Recent Notes
          </button>
          <button
            onClick={() => handleNavigate("create")}
            className="w-full py-3 px-4 rounded-lg bg-gradient-to-br from-indigo-800 to-indigo-900 bg-opacity-70 hover:bg-opacity-90 transition-all duration-300 ease-in-out text-left"
          >
            Create Note
          </button>
          <div className="w-full py-3 px-4 rounded-lg bg-gradient-to-br from-indigo-800 to-indigo-900 bg-opacity-70 flex items-center space-x-2">
            Sync Status: <span className="text-green-400">Online</span>
            <span className="w-2 h-2 rounded-full bg-green-400"></span>
          </div>
          <button
            onClick={() => handleNavigate("settings")}
            className="w-full py-3 px-4 rounded-lg bg-gradient-to-br from-indigo-800 to-indigo-900 bg-opacity-70 hover:bg-opacity-90 transition-all duration-300 ease-in-out text-left"
          >
            Settings
          </button>
          <button
            onClick={() => handleNavigate("logout")}
            className="w-full py-3 px-4 rounded-lg bg-gradient-to-br from-red-800 to-red-900 bg-opacity-70 hover:bg-opacity-90 transition-all duration-300 ease-in-out text-left"
          >
            Logout
          </button>
        </nav>
      </div>

      {isOpen && (
        <div
          onClick={toggleDrawer}
          className="fixed inset-0 bg-gradient-to-br from-black via-indigo-900 to-black bg-opacity-70 z-30 transition-opacity duration-300 ease-in-out"
        ></div>
      )}
    </>
  );
};

export default Drawer;
