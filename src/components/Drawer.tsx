import React, { useState, useEffect } from "react";
import { supabase } from "../SUPABASE/supabaseClient";

interface DrawerProps {
  onNavigate: (page: "recent" | "create" | "settings" | "logout" | "search" | "api-test") => void;
  onSearch: (query: string) => void;
  theme?: string;
}

const Drawer: React.FC<DrawerProps> = ({ onNavigate, onSearch, theme = "Dark" }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [syncStatus, setSyncStatus] = useState<'online' | 'offline' | 'syncing'>('online');
  const [lastSyncTime, setLastSyncTime] = useState<Date | null>(null);
  const [connectionQuality, setConnectionQuality] = useState<'good' | 'slow' | 'poor'>('good');

  // Check connectivity and sync status
  useEffect(() => {
    const checkConnectivity = async () => {
      try {
        const startTime = Date.now();
        const { error } = await supabase.from('notes').select('count').limit(1).single();
        const responseTime = Date.now() - startTime;

        if (error && error.code !== 'PGRST116') { // PGRST116 is "no rows returned" which is OK
          setSyncStatus('offline');
          setConnectionQuality('poor');
        } else {
          setSyncStatus('online');
          setLastSyncTime(new Date());

          if (responseTime < 500) setConnectionQuality('good');
          else if (responseTime < 2000) setConnectionQuality('slow');
          else setConnectionQuality('poor');
        }
      } catch (error) {
        setSyncStatus('offline');
        setConnectionQuality('poor');
      }
    };

    // Initial check
    checkConnectivity();

    // Check every 30 seconds
    const interval = setInterval(checkConnectivity, 30000);

    return () => clearInterval(interval);
  }, []);

  const handleManualSync = async () => {
    setSyncStatus('syncing');
    try {
      // Test connection with a simple query
      const { error } = await supabase.from('notes').select('count').limit(1).single();
      if (error && error.code !== 'PGRST116') {
        throw error;
      }
      setSyncStatus('online');
      setLastSyncTime(new Date());
    } catch (error) {
      setSyncStatus('offline');
      console.error('Manual sync failed:', error);
    }
  };

  const toggleDrawer = () => {
    setIsOpen(!isOpen);
  };

  const handleNavigate = (
    page: "recent" | "create" | "settings" | "logout" | "search" | "api-test"
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
        className={`fixed top-0 left-0 h-full w-64 text-white transform transition-transform duration-300 ease-in-out shadow-2xl z-40 ${
          isOpen ? "translate-x-0" : "-translate-x-full"
        } ${
          theme === "Light"
            ? "bg-gradient-to-br from-white/95 via-purple-50/95 to-indigo-50/95 border-r border-purple-200/50"
            : "bg-gradient-to-br from-purple-900 via-indigo-900 to-black"
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
          <button
            onClick={() => handleNavigate("search")}
            className={`w-full py-3 px-4 rounded-lg transition-all duration-300 ease-in-out text-left flex items-center space-x-2 ${
              theme === "Light"
                ? "bg-gradient-to-br from-purple-100 to-indigo-100 hover:from-purple-200 hover:to-indigo-200 text-gray-800 border border-purple-200/50"
                : "bg-gradient-to-br from-indigo-800 to-indigo-900 bg-opacity-70 hover:bg-opacity-90 text-white"
            }`}
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <span>Search Notes</span>
          </button>
          <button
            onClick={() => handleNavigate("recent")}
            className={`w-full py-3 px-4 rounded-lg transition-all duration-300 ease-in-out text-left ${
              theme === "Light"
                ? "bg-gradient-to-br from-purple-100 to-indigo-100 hover:from-purple-200 hover:to-indigo-200 text-gray-800 border border-purple-200/50"
                : "bg-gradient-to-br from-indigo-800 to-indigo-900 bg-opacity-70 hover:bg-opacity-90 text-white"
            }`}
          >
            Recent Notes
          </button>
          <button
            onClick={() => handleNavigate("create")}
            className={`w-full py-3 px-4 rounded-lg transition-all duration-300 ease-in-out text-left ${
              theme === "Light"
                ? "bg-gradient-to-br from-purple-100 to-indigo-100 hover:from-purple-200 hover:to-indigo-200 text-gray-800 border border-purple-200/50"
                : "bg-gradient-to-br from-indigo-800 to-indigo-900 bg-opacity-70 hover:bg-opacity-90 text-white"
            }`}
          >
            Create Note
          </button>
          <div className={`w-full py-3 px-4 rounded-lg flex items-center space-x-2 ${
            theme === "Light"
              ? "bg-gradient-to-br from-purple-100 to-indigo-100 text-gray-800 border border-purple-200/50"
              : "bg-gradient-to-br from-indigo-800 to-indigo-900 bg-opacity-70 text-white"
          }`}>
            Sync Status: <span className="text-green-400">Online</span>
            <span className="w-2 h-2 rounded-full bg-green-400"></span>
          </div>
          <div className={`w-full py-3 px-4 rounded-lg ${
            theme === "Light"
              ? "bg-gradient-to-br from-purple-100 to-indigo-100 text-gray-800 border border-purple-200/50"
              : "bg-gradient-to-br from-indigo-800 to-indigo-900 bg-opacity-70 text-white"
          }`}>
            <div className="flex items-center justify-between mb-1">
              <span className="text-sm">Database Sync</span>
              <button
                onClick={handleManualSync}
                disabled={syncStatus === 'syncing'}
                className="text-xs text-indigo-300 hover:text-indigo-200 disabled:text-gray-500 disabled:cursor-not-allowed"
                title="Manual sync"
              >
                {syncStatus === 'syncing' ? '⏳' : '🔄'}
              </button>
            </div>
            <div className="flex items-center space-x-2">
              <span className={`w-2 h-2 rounded-full ${
                syncStatus === 'online' ? 'bg-green-400' :
                syncStatus === 'syncing' ? 'bg-yellow-400 animate-pulse' :
                'bg-red-400'
              }`}></span>
              <span className="text-xs text-silver-200 capitalize">{syncStatus}</span>
              <span className={`text-xs ${
                connectionQuality === 'good' ? 'text-green-400' :
                connectionQuality === 'slow' ? 'text-yellow-400' :
                'text-red-400'
              }`}>
                {connectionQuality === 'good' ? '●' :
                 connectionQuality === 'slow' ? '○' : '●'}
              </span>
            </div>
            {lastSyncTime && (
              <div className="text-xs text-gray-400 mt-1">
                Last sync: {lastSyncTime.toLocaleTimeString()}
              </div>
            )}
          </div>
          <button
            onClick={() => handleNavigate("settings")}
            className={`w-full py-3 px-4 rounded-lg transition-all duration-300 ease-in-out text-left ${
              theme === "Light"
                ? "bg-gradient-to-br from-purple-100 to-indigo-100 hover:from-purple-200 hover:to-indigo-200 text-gray-800 border border-purple-200/50"
                : "bg-gradient-to-br from-indigo-800 to-indigo-900 bg-opacity-70 hover:bg-opacity-90 text-white"
            }`}
          >
            Settings
          </button>
          <button
            onClick={() => handleNavigate("api-test")}
            className={`w-full py-3 px-4 rounded-lg transition-all duration-300 ease-in-out text-left flex items-center space-x-2 ${
              theme === "Light"
                ? "bg-gradient-to-br from-yellow-100 to-orange-100 hover:from-yellow-200 hover:to-orange-200 text-gray-800 border border-yellow-200/50"
                : "bg-gradient-to-br from-yellow-800 to-orange-900 bg-opacity-70 hover:bg-opacity-90 text-white"
            }`}
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
            <span>API Test</span>
          </button>
          <button
            onClick={() => handleNavigate("logout")}
            className={`w-full py-3 px-4 rounded-lg transition-all duration-300 ease-in-out text-left ${
              theme === "Light"
                ? "bg-gradient-to-br from-red-100 to-pink-100 hover:from-red-200 hover:to-pink-200 text-red-800 border border-red-200/50"
                : "bg-gradient-to-br from-red-800 to-red-900 bg-opacity-70 hover:bg-opacity-90 text-white"
            }`}
          >
            Logout
          </button>
        </nav>
      </div>

      {isOpen && (
        <div
          onClick={toggleDrawer}
          className={`fixed inset-0 z-30 transition-opacity duration-300 ease-in-out ${
            theme === "Light"
              ? "bg-gradient-to-br from-purple-900/20 via-indigo-900/20 to-black/20"
              : "bg-gradient-to-br from-black via-indigo-900 to-black bg-opacity-70"
          }`}
        ></div>
      )}
    </>
  );
};

export default Drawer;
