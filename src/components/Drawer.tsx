import React, { useState, useEffect } from "react";
import { supabase } from "../SUPABASE/supabaseClient";
import { useDynamicTranslation } from "../hooks/useDynamicTranslation";

interface DrawerProps {
  onNavigate: (
    page: "recent" | "create" | "settings" | "logout" | "search"
  ) => void;
  onSearch: (query: string) => void;
  theme?: string;
  isOnline?: boolean;
}

const Drawer: React.FC<DrawerProps> = ({
  onNavigate,
  onSearch,
  theme = "Dark",
  isOnline = true,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [syncStatus, setSyncStatus] = useState<
    "online" | "offline" | "syncing"
  >("online");
  const [lastSyncTime, setLastSyncTime] = useState<Date | null>(null);
  const [connectionQuality, setConnectionQuality] = useState<
    "good" | "slow" | "poor"
  >("good");

  // Translation hook
  const { translate, currentLanguage, ensureLanguageApplied } = useDynamicTranslation();

  // Translated strings state
  const [translatedStrings, setTranslatedStrings] = useState({
    searchNotes: "Search Notes",
    recentNotes: "Recent Notes",
    createNote: "Create Note",
    settings: "Settings",
    logout: "Logout",
    offlineMode: "Offline Mode",
    usingCachedData: "Using cached data - changes will sync when online",
    syncStatus: "Sync Status:",
    online: "Online",
    databaseSync: "Database Sync",
    manualSync: "Manual sync",
  });

  // Translate strings when language changes
  useEffect(() => {
    const translateStrings = async () => {
      const newStrings = {
        searchNotes: await translate("Search Notes"),
        recentNotes: await translate("Recent Notes"),
        createNote: await translate("Create Note"),
        settings: await translate("Settings"),
        logout: await translate("Logout"),
        offlineMode: await translate("Offline Mode"),
        usingCachedData: await translate("Using cached data - changes will sync when online"),
        syncStatus: await translate("Sync Status:"),
        online: await translate("Online"),
        databaseSync: await translate("Database Sync"),
        manualSync: await translate("Manual sync"),
      };
      setTranslatedStrings(newStrings);
    };
    translateStrings();
  }, [currentLanguage, translate]);

  // Apply cached translations after component mounts and translations load
  useEffect(() => {
    const timer = setTimeout(() => {
      ensureLanguageApplied();
    }, 100); // Small delay to ensure DOM is ready
    return () => clearTimeout(timer);
  }, [translatedStrings, ensureLanguageApplied]);

  // Check connectivity and sync status
  useEffect(() => {
    const checkConnectivity = async () => {
      try {
        const startTime = Date.now();
        const { error } = await supabase
          .from("notes")
          .select("count")
          .limit(1)
          .single();
        const responseTime = Date.now() - startTime;

        if (error && error.code !== "PGRST116") {
          // PGRST116 is "no rows returned" which is OK
          setSyncStatus("offline");
          setConnectionQuality("poor");
        } else {
          setSyncStatus("online");
          setLastSyncTime(new Date());

          if (responseTime < 500) setConnectionQuality("good");
          else if (responseTime < 2000) setConnectionQuality("slow");
          else setConnectionQuality("poor");
        }
      } catch (error) {
        setSyncStatus("offline");
        setConnectionQuality("poor");
      }
    };

    // Initial check
    checkConnectivity();

    // Check every 30 seconds
    const interval = setInterval(checkConnectivity, 30000);

    return () => clearInterval(interval);
  }, []);

  const handleManualSync = async () => {
    setSyncStatus("syncing");
    try {
      // Test connection with a simple query
      const { error } = await supabase
        .from("notes")
        .select("count")
        .limit(1)
        .single();
      if (error && error.code !== "PGRST116") {
        throw error;
      }
      setSyncStatus("online");
      setLastSyncTime(new Date());
    } catch (error) {
      setSyncStatus("offline");
      console.error("Manual sync failed:", error);
    }
  };

  const toggleDrawer = () => {
    setIsOpen(!isOpen);
  };

  const handleNavigate = (
    page: "recent" | "create" | "settings" | "logout" | "search"
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

        {!isOnline && (
          <div className="mt-16 mx-6 mb-4">
            <div className="bg-gradient-to-r from-orange-600 to-red-600 text-white px-4 py-3 rounded-lg shadow-lg border border-orange-500/50">
              <div className="flex items-center space-x-2">
                <div className="w-3 h-3 bg-white rounded-full animate-pulse"></div>
                <span className="text-sm font-semibold">Offline Mode</span>
              </div>
              <p className="text-xs mt-1 opacity-90">
                {translatedStrings.usingCachedData}
              </p>
            </div>
          </div>
        )}

        <nav className="mt-20 px-6 space-y-4 overflow-y-auto max-h-[calc(100vh-8rem)]">
          <button
            onClick={() => handleNavigate("search")}
            className={`w-full py-3 px-4 rounded-lg transition-all duration-300 ease-in-out text-left flex items-center space-x-2 ${
              theme === "Light"
                ? "bg-gradient-to-br from-purple-100 to-indigo-100 hover:from-purple-200 hover:to-indigo-200 text-gray-800 border border-purple-200/50"
                : "bg-gradient-to-br from-indigo-800 to-indigo-900 bg-opacity-70 hover:bg-opacity-90 text-white"
            }`}
          >
            <svg
              className="h-5 w-5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
              />
            </svg>
            <span>{translatedStrings.searchNotes}</span>
          </button>
          <button
            onClick={() => handleNavigate("recent")}
            className={`w-full py-3 px-4 rounded-lg transition-all duration-300 ease-in-out text-left ${
              theme === "Light"
                ? "bg-gradient-to-br from-purple-100 to-indigo-100 hover:from-purple-200 hover:to-indigo-200 text-gray-800 border border-purple-200/50"
                : "bg-gradient-to-br from-indigo-800 to-indigo-900 bg-opacity-70 hover:bg-opacity-90 text-white"
            }`}
          >
            {translatedStrings.recentNotes}
          </button>
          <button
            onClick={() => handleNavigate("create")}
            className={`w-full py-3 px-4 rounded-lg transition-all duration-300 ease-in-out text-left ${
              theme === "Light"
                ? "bg-gradient-to-br from-purple-100 to-indigo-100 hover:from-purple-200 hover:to-indigo-200 text-gray-800 border border-purple-200/50"
                : "bg-gradient-to-br from-indigo-800 to-indigo-900 bg-opacity-70 hover:bg-opacity-90 text-white"
            }`}
          >
            {translatedStrings.createNote}
          </button>
          <div
            className={`w-full py-3 px-4 rounded-lg flex items-center space-x-2 ${
              theme === "Light"
                ? "bg-gradient-to-br from-purple-100 to-indigo-100 text-gray-800 border border-purple-200/50"
                : "bg-gradient-to-br from-indigo-800 to-indigo-900 bg-opacity-70 text-white"
            }`}
          >
            {translatedStrings.syncStatus} <span className="text-green-400">{translatedStrings.online}</span>
            <span className="w-2 h-2 rounded-full bg-green-400"></span>
          </div>
          <div
            className={`w-full py-3 px-4 rounded-lg ${
              theme === "Light"
                ? "bg-gradient-to-br from-purple-100 to-indigo-100 text-gray-800 border border-purple-200/50"
                : "bg-gradient-to-br from-indigo-800 to-indigo-900 bg-opacity-70 text-white"
            }`}
          >
            <div className="flex items-center justify-between mb-1">
              <span className="text-sm">{translatedStrings.databaseSync}</span>
              <button
                onClick={handleManualSync}
                disabled={syncStatus === "syncing"}
                className="text-xs text-indigo-300 hover:text-indigo-200 disabled:text-gray-500 disabled:cursor-not-allowed"
                title={translatedStrings.manualSync}
              >
                {syncStatus === "syncing" ? "⏳" : "🔄"}
              </button>
            </div>
            <div className="flex items-center space-x-2">
              <span
                className={`w-2 h-2 rounded-full ${
                  syncStatus === "online"
                    ? "bg-green-400"
                    : syncStatus === "syncing"
                    ? "bg-yellow-400 animate-pulse"
                    : "bg-red-400"
                }`}
              ></span>
              <span className="text-xs text-silver-200 capitalize">
                {syncStatus}
              </span>
              <span
                className={`text-xs ${
                  connectionQuality === "good"
                    ? "text-green-400"
                    : connectionQuality === "slow"
                    ? "text-yellow-400"
                    : "text-red-400"
                }`}
              >
                {connectionQuality === "good"
                  ? "●"
                  : connectionQuality === "slow"
                  ? "○"
                  : "●"}
              </span>
            </div>
            {lastSyncTime && (
              <div className="text-xs text-gray-400 mt-1">
                Last Sync: {lastSyncTime.toLocaleTimeString()}
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
            {translatedStrings.settings}
          </button>
          <button
            onClick={() => handleNavigate("logout")}
            className={`w-full py-3 px-4 rounded-lg transition-all duration-300 ease-in-out text-left ${
              theme === "Light"
                ? "bg-gradient-to-br from-red-100 to-pink-100 hover:from-red-200 hover:to-pink-200 text-red-800 border border-red-200/50"
                : "bg-gradient-to-br from-red-800 to-red-900 bg-opacity-70 hover:bg-opacity-90 text-white"
            }`}
          >
            {translatedStrings.logout}
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
