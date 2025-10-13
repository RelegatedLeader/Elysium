import React, { useState, useEffect } from "react";

interface SettingsProps {
  onSave?: (settings: {
    theme: string;
    notifications: boolean;
    syncInterval: number;
    aiResponseStyle: string;
    aiPersonality: string;
    autoSave: boolean;
    defaultTemplate: string;
    noteSorting: string;
    dataRetention: number;
  }) => void;
  onCancel?: () => void;
  onCleanupOrphanedNotes?: () => void;
  onLogout?: () => void;
  initialTheme?: string;
  initialNotifications?: boolean;
  initialSyncInterval?: number;
  initialAiResponseStyle?: string;
  initialAiPersonality?: string;
  initialAutoSave?: boolean;
  initialDefaultTemplate?: string;
  initialNoteSorting?: string;
  initialDataRetention?: number;
  userEmail?: string;
}

const Settings: React.FC<SettingsProps> = ({
  onSave,
  onCancel,
  onCleanupOrphanedNotes,
  onLogout,
  initialTheme = "Dark",
  initialNotifications = false,
  initialSyncInterval = 15,
  initialAiResponseStyle = "Balanced",
  initialAiPersonality = "Professional",
  initialAutoSave = true,
  initialDefaultTemplate = "Blank",
  initialNoteSorting = "Date Created",
  initialDataRetention = 365,
  userEmail,
}) => {
  const [theme, setTheme] = useState(initialTheme);
  const [notifications, setNotifications] = useState(initialNotifications);
  const [syncInterval, setSyncInterval] = useState(initialSyncInterval);
  const [aiResponseStyle, setAiResponseStyle] = useState(
    initialAiResponseStyle
  );
  const [aiPersonality, setAiPersonality] = useState(initialAiPersonality);
  const [autoSave, setAutoSave] = useState(initialAutoSave);
  const [defaultTemplate, setDefaultTemplate] = useState(
    initialDefaultTemplate
  );
  const [noteSorting, setNoteSorting] = useState(initialNoteSorting);
  const [dataRetention, setDataRetention] = useState(initialDataRetention);
  const [showApiTest, setShowApiTest] = useState(false);
  const [apiTestResult, setApiTestResult] = useState<string>("");
  const [isTestingApi, setIsTestingApi] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const [copyButtonText, setCopyButtonText] = useState("Copy");

  // Track changes to settings
  useEffect(() => {
    const settingsChanged =
      theme !== initialTheme ||
      notifications !== initialNotifications ||
      syncInterval !== initialSyncInterval ||
      aiResponseStyle !== initialAiResponseStyle ||
      aiPersonality !== initialAiPersonality ||
      autoSave !== initialAutoSave ||
      defaultTemplate !== initialDefaultTemplate ||
      noteSorting !== initialNoteSorting ||
      dataRetention !== initialDataRetention;
    setHasChanges(settingsChanged);
  }, [
    theme,
    notifications,
    syncInterval,
    initialTheme,
    initialNotifications,
    initialSyncInterval,
  ]);

  const handleSave = () => {
    if (onSave && hasChanges) {
      onSave({
        theme,
        notifications,
        syncInterval,
        aiResponseStyle,
        aiPersonality,
        autoSave,
        defaultTemplate,
        noteSorting,
        dataRetention,
      });
      setHasChanges(false); // Reset after saving
    }
  };

  const handleCancel = () => {
    setTheme(initialTheme);
    setNotifications(initialNotifications);
    setSyncInterval(initialSyncInterval);
    setHasChanges(false);
    if (onCancel) onCancel();
  };

  const testApiConnection = async () => {
    setIsTestingApi(true);
    setApiTestResult("Testing Mistral AI API key and models...\n");

    const apiKey = process.env.REACT_APP_MISTRAL_API_KEY;

    if (!apiKey) {
      setApiTestResult(
        "❌ No Mistral AI API key found in environment variables"
      );
      setIsTestingApi(false);
      return;
    }

    setApiTestResult(
      (prev) =>
        prev + `✅ Mistral AI API key found: ${apiKey.substring(0, 20)}...\n\n`
    );

    const models = [
      "mistral-tiny", // Fast and free
      "mistral-small", // Good balance of speed/quality
      "mistral-medium", // More capable
      "mistral-large-latest", // Most capable (still free tier)
    ];

    for (const model of models) {
      try {
        setApiTestResult((prev) => prev + `🔄 Testing ${model}...\n`);

        const response = await fetch(
          "https://api.mistral.ai/v1/chat/completions",
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${apiKey}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              model: model,
              messages: [
                {
                  role: "user",
                  content: 'Say "Hello from Elysium test!" and nothing else.',
                },
              ],
              max_tokens: 50,
              temperature: 0.1,
            }),
          }
        );

        if (response.ok) {
          const data = await response.json();
          const content = data.choices?.[0]?.message?.content;
          setApiTestResult((prev) => prev + `✅ ${model}: ${content}\n\n`);
        } else {
          const errorText = await response.text();
          setApiTestResult(
            (prev) =>
              prev + `❌ ${model}: ${response.status} - ${errorText}\n\n`
          );
        }
      } catch (error) {
        setApiTestResult(
          (prev) =>
            prev +
            `💥 ${model}: ${
              error instanceof Error ? error.message : String(error)
            }\n\n`
        );
      }
    }

    setApiTestResult((prev) => prev + "Test completed.");
    setIsTestingApi(false);
  };

  return (
    <div
      className={`min-h-screen flex items-center justify-center text-white relative overflow-hidden ${
        theme === "Light"
          ? "bg-gradient-to-br from-purple-100 via-pink-50 to-indigo-100"
          : "bg-gradient-to-br from-purple-900 via-indigo-900 to-black"
      }`}
    >
      <div
        className={`absolute inset-0 ${
          theme === "Light"
            ? "bg-[radial-gradient(ellipse_at_center,rgba(139,92,246,0.05)_0%,transparent_70%)]"
            : "bg-[radial-gradient(ellipse_at_center,rgba(255,255,255,0.05)_0%,transparent_70%)]"
        } pointer-events-none`}
      ></div>
      <div
        className={`p-8 ${
          theme === "Light"
            ? "bg-gradient-to-br from-white/90 via-purple-50/90 to-pink-50/90 border-purple-200/50"
            : "bg-gradient-to-br from-indigo-900/80 via-indigo-800/80 to-purple-700/80 border-indigo-500/30"
        } backdrop-blur-lg border rounded-2xl shadow-2xl w-[32rem] h-auto max-w-full max-h-full flex items-center justify-center transform transition-all duration-300 ease-in-out hover:shadow-[0_0_20px_rgba(139,92,246,0.3)]`}
      >
        <div className="text-center space-y-6 w-full">
          <h2
            className={`text-3xl font-bold mb-6 tracking-tight text-shadow-[0_2px_4px_rgba(0,0,0,0.3)] ${
              theme === "Light" ? "text-purple-800" : "text-gold-100"
            }`}
          >
            Settings
          </h2>
          <div className="space-y-6">
            {/* Account Settings - Email */}
            <div
              className={`border-b pb-6 ${
                theme === "Light" ? "border-purple-200" : "border-indigo-600"
              }`}
            >
              <div className="flex items-center mb-4">
                <span className="text-2xl mr-3">👤</span>
                <h3
                  className={`text-xl font-bold ${
                    theme === "Light" ? "text-purple-800" : "text-gold-100"
                  }`}
                >
                  Account
                </h3>
              </div>
              {userEmail && (
                <div className="mb-4 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
                  <p className="text-sm font-medium text-blue-800 dark:text-blue-200">
                    Current User: {userEmail}
                  </p>
                </div>
              )}
              <div>
                <label
                  className={`block text-sm font-medium mb-2 ${
                    theme === "Light" ? "text-purple-700" : "text-gray-200"
                  }`}
                >
                  Email Address
                </label>
                <div
                  className={`w-full p-3 border rounded-lg text-sm ${
                    theme === "Light"
                      ? "bg-gray-100/90 border-purple-300 text-purple-800"
                      : "bg-indigo-950/90 border-indigo-600 text-white"
                  }`}
                >
                  {userEmail || "Not logged in"}
                </div>
                <p
                  className={`text-xs mt-1 ${
                    theme === "Light" ? "text-purple-600" : "text-gray-400"
                  }`}
                >
                  Your account email address
                </p>
              </div>
            </div>

            {/* Appearance Settings */}
            <div
              className={`border-b pb-6 ${
                theme === "Light" ? "border-purple-200" : "border-indigo-600"
              }`}
            >
              <div className="flex items-center mb-4">
                <span className="text-2xl mr-3">🎨</span>
                <h3
                  className={`text-xl font-bold ${
                    theme === "Light" ? "text-purple-800" : "text-gold-100"
                  }`}
                >
                  Appearance
                </h3>
              </div>
              <div>
                <label
                  htmlFor="theme"
                  className={`block text-sm font-medium mb-1 ${
                    theme === "Light" ? "text-purple-700" : "text-gray-200"
                  }`}
                >
                  Theme
                </label>
                <select
                  id="theme"
                  value={theme}
                  onChange={(e) => setTheme(e.target.value)}
                  className={`w-full p-3 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-400 focus:border-purple-400 transition-all duration-300 ${
                    theme === "Light"
                      ? "bg-white/90 border-purple-300 text-purple-800 hover:bg-purple-50/90"
                      : "bg-indigo-950/90 border-indigo-600 text-white hover:bg-indigo-900/90"
                  }`}
                  aria-label="Select theme"
                >
                  <option value="Dark">Dark</option>
                  <option value="Light">Light</option>
                </select>
              </div>
            </div>
            <div>
              <label
                htmlFor="notifications"
                className={`block text-sm font-medium mb-2 ${
                  theme === "Light" ? "text-purple-700" : "text-gray-200"
                }`}
              >
                Notification Preferences
              </label>
              <div className="flex items-center justify-center space-x-2">
                <input
                  id="notifications"
                  type="checkbox"
                  checked={notifications}
                  onChange={(e) => setNotifications(e.target.checked)}
                  className={`h-4 w-4 focus:ring-purple-400 border-purple-300 rounded transition-all duration-200 ${
                    theme === "Light"
                      ? "text-purple-600 bg-white border-purple-300"
                      : "text-indigo-400 bg-indigo-950/90 border-indigo-600"
                  }`}
                  aria-label="Enable notifications"
                />
                <span
                  className={`text-sm ${
                    theme === "Light" ? "text-purple-700" : "text-gray-200"
                  }`}
                >
                  Enable Notifications
                </span>
              </div>
            </div>
            <div>
              <label
                htmlFor="sync-interval"
                className={`block text-sm font-medium mb-1 ${
                  theme === "Light" ? "text-purple-700" : "text-gray-200"
                }`}
              >
                Auto-Sync Interval (minutes)
              </label>
              <input
                id="sync-interval"
                type="number"
                min="5"
                max="120"
                value={syncInterval}
                onChange={(e) =>
                  setSyncInterval(parseInt(e.target.value) || 15)
                }
                className={`w-full p-3 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-400 focus:border-purple-400 transition-all duration-300 ${
                  theme === "Light"
                    ? "bg-white/90 border-purple-300 text-purple-800 hover:bg-purple-50/90"
                    : "bg-indigo-950/90 border-indigo-600 text-white hover:bg-indigo-900/90"
                }`}
                aria-label="Set sync interval"
              />
              <p
                className={`text-xs mt-1 ${
                  theme === "Light" ? "text-purple-600" : "text-gray-400"
                }`}
              >
                How often to automatically sync your notes (5-120 minutes)
              </p>
            </div>

            {/* AI Assistant Settings */}
            <div
              className={`border-b pb-6 ${
                theme === "Light" ? "border-purple-200" : "border-indigo-600"
              }`}
            >
              <div className="flex items-center mb-4">
                <div className="flex items-center justify-center w-10 h-10 rounded-full bg-gradient-to-r from-purple-500 to-indigo-600 mr-3">
                  <span className="text-white text-lg">🤖</span>
                </div>
                <div>
                  <h3
                    className={`text-xl font-bold ${
                      theme === "Light" ? "text-purple-800" : "text-gold-100"
                    }`}
                  >
                    AI Assistant
                  </h3>
                  <p
                    className={`text-sm ${
                      theme === "Light" ? "text-purple-600" : "text-gray-400"
                    }`}
                  >
                    Customize your AI assistant and test connections
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                {/* Response Style */}
                <div
                  className={`p-4 rounded-lg border-2 transition-all duration-300 ${
                    theme === "Light"
                      ? "bg-purple-50/50 border-purple-200 hover:border-purple-400"
                      : "bg-indigo-950/30 border-indigo-600 hover:border-indigo-400"
                  }`}
                >
                  <div className="flex items-center mb-3">
                    <span className="text-2xl mr-2">📝</span>
                    <label
                      className={`text-sm font-semibold ${
                        theme === "Light" ? "text-purple-800" : "text-gray-200"
                      }`}
                    >
                      Response Style
                    </label>
                  </div>
                  <select
                    id="ai-response-style"
                    value={aiResponseStyle}
                    onChange={(e) => {
                      setAiResponseStyle(e.target.value);
                      // Auto-save immediately when changed
                      if (onSave) {
                        onSave({
                          theme,
                          notifications,
                          syncInterval,
                          aiResponseStyle: e.target.value,
                          aiPersonality,
                          autoSave,
                          defaultTemplate,
                          noteSorting,
                          dataRetention,
                        });
                      }
                    }}
                    className={`w-full p-3 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-400 focus:border-purple-400 transition-all duration-300 ${
                      theme === "Light"
                        ? "bg-white border-purple-300 text-purple-800 hover:bg-purple-50"
                        : "bg-indigo-950 border-indigo-600 text-white hover:bg-indigo-900"
                    }`}
                    aria-label="Select AI response style"
                  >
                    <option value="Concise">⚡ Concise (1-3 sentences)</option>
                    <option value="Balanced">⚖️ Balanced (standard)</option>
                    <option value="Detailed">
                      📖 Detailed (comprehensive)
                    </option>
                    <option value="Creative">🎨 Creative (innovative)</option>
                  </select>
                  <p
                    className={`text-xs mt-2 ${
                      theme === "Light" ? "text-purple-600" : "text-gray-400"
                    }`}
                  >
                    Controls response length and detail level
                  </p>
                </div>

                {/* AI Personality */}
                <div
                  className={`p-4 rounded-lg border-2 transition-all duration-300 ${
                    theme === "Light"
                      ? "bg-purple-50/50 border-purple-200 hover:border-purple-400"
                      : "bg-indigo-950/30 border-indigo-600 hover:border-indigo-400"
                  }`}
                >
                  <div className="flex items-center mb-3">
                    <span className="text-2xl mr-2">🎭</span>
                    <label
                      className={`text-sm font-semibold ${
                        theme === "Light" ? "text-purple-800" : "text-gray-200"
                      }`}
                    >
                      AI Personality
                    </label>
                  </div>
                  <select
                    id="ai-personality"
                    value={aiPersonality}
                    onChange={(e) => {
                      setAiPersonality(e.target.value);
                      // Auto-save immediately when changed
                      if (onSave) {
                        onSave({
                          theme,
                          notifications,
                          syncInterval,
                          aiResponseStyle,
                          aiPersonality: e.target.value,
                          autoSave,
                          defaultTemplate,
                          noteSorting,
                          dataRetention,
                        });
                      }
                    }}
                    className={`w-full p-3 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-400 focus:border-purple-400 transition-all duration-300 ${
                      theme === "Light"
                        ? "bg-white border-purple-300 text-purple-800 hover:bg-purple-50"
                        : "bg-indigo-950 border-indigo-600 text-white hover:bg-indigo-900"
                    }`}
                    aria-label="Select AI personality"
                  >
                    <option value="Professional">💼 Professional</option>
                    <option value="Friendly">😊 Friendly</option>
                    <option value="Technical">🔧 Technical</option>
                    <option value="Creative">🎨 Creative</option>
                    <option value="Minimalist">📝 Minimalist</option>
                  </select>
                  <p
                    className={`text-xs mt-2 ${
                      theme === "Light" ? "text-purple-600" : "text-gray-400"
                    }`}
                  >
                    Defines the AI's communication style
                  </p>
                </div>
              </div>

              {/* API Test Section */}
              <div
                className={`p-4 rounded-lg border-2 transition-all duration-300 ${
                  theme === "Light"
                    ? "bg-yellow-50/50 border-yellow-200"
                    : "bg-yellow-950/20 border-yellow-600"
                }`}
              >
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center">
                    <span className="text-2xl mr-2">🔧</span>
                    <div>
                      <label
                        className={`text-sm font-semibold ${
                          theme === "Light"
                            ? "text-yellow-800"
                            : "text-yellow-200"
                        }`}
                      >
                        API Connection Test
                      </label>
                      <p
                        className={`text-xs ${
                          theme === "Light"
                            ? "text-yellow-600"
                            : "text-yellow-400"
                        }`}
                      >
                        Test your Mistral AI API key and available models
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={testApiConnection}
                    disabled={isTestingApi}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-all duration-300 ${
                      theme === "Light"
                        ? "bg-yellow-600 hover:bg-yellow-700 text-white disabled:bg-yellow-400"
                        : "bg-yellow-600 hover:bg-yellow-700 text-white disabled:bg-yellow-800"
                    } disabled:cursor-not-allowed`}
                  >
                    {isTestingApi ? "Testing..." : "Test API"}
                  </button>
                </div>

                {apiTestResult && (
                  <div
                    className={`mt-3 p-3 rounded border text-xs font-mono whitespace-pre-wrap max-h-48 overflow-y-auto ${
                      theme === "Light"
                        ? "bg-gray-100 border-gray-300 text-gray-800"
                        : "bg-gray-900 border-gray-600 text-gray-200"
                    }`}
                  >
                    {apiTestResult}
                  </div>
                )}
              </div>

              {/* Live Preview */}
              <div
                className={`mt-6 p-4 rounded-lg ${
                  theme === "Light"
                    ? "bg-purple-100/50 border border-purple-300"
                    : "bg-indigo-900/30 border border-indigo-600"
                }`}
              >
                <h4
                  className={`text-sm font-semibold mb-2 ${
                    theme === "Light" ? "text-purple-800" : "text-gold-100"
                  }`}
                >
                  🎯 Current Settings Preview
                </h4>
                <div className="grid grid-cols-2 gap-4 text-xs">
                  <div>
                    <span
                      className={`font-medium ${
                        theme === "Light" ? "text-purple-700" : "text-gray-300"
                      }`}
                    >
                      Style:
                    </span>
                    <span
                      className={`ml-2 px-2 py-1 rounded ${
                        theme === "Light"
                          ? "bg-purple-200 text-purple-800"
                          : "bg-indigo-800 text-indigo-200"
                      }`}
                    >
                      {aiResponseStyle}
                    </span>
                  </div>
                  <div>
                    <span
                      className={`font-medium ${
                        theme === "Light" ? "text-purple-700" : "text-gray-300"
                      }`}
                    >
                      Personality:
                    </span>
                    <span
                      className={`ml-2 px-2 py-1 rounded ${
                        theme === "Light"
                          ? "bg-purple-200 text-purple-800"
                          : "bg-indigo-800 text-indigo-200"
                      }`}
                    >
                      {aiPersonality}
                    </span>
                  </div>
                </div>
                <p
                  className={`text-xs mt-2 ${
                    theme === "Light" ? "text-purple-600" : "text-gray-400"
                  }`}
                >
                  💡 Changes are applied immediately - try the AI buttons to
                  test!
                </p>
              </div>
            </div>

            {/* Behavior Settings */}
            <div
              className={`border-b pb-6 ${
                theme === "Light" ? "border-purple-200" : "border-indigo-600"
              }`}
            >
              <div className="flex items-center mb-4">
                <span className="text-2xl mr-3">⚙️</span>
                <h3
                  className={`text-xl font-bold ${
                    theme === "Light" ? "text-purple-800" : "text-gold-100"
                  }`}
                >
                  Behavior
                </h3>
              </div>
              <div className="space-y-4">
                <div>
                  <label
                    className={`block text-sm font-medium mb-2 ${
                      theme === "Light" ? "text-purple-700" : "text-gray-200"
                    }`}
                  >
                    Notifications
                  </label>
                  <div className="flex items-center justify-center space-x-2">
                    <input
                      id="notifications"
                      type="checkbox"
                      checked={notifications}
                      onChange={(e) => setNotifications(e.target.checked)}
                      className={`h-4 w-4 focus:ring-purple-400 border-purple-300 rounded transition-all duration-200 ${
                        theme === "Light"
                          ? "text-purple-600 bg-white border-purple-300"
                          : "text-indigo-400 bg-indigo-950/90 border-indigo-600"
                      }`}
                      aria-label="Enable notifications"
                    />
                    <span
                      className={`text-sm ${
                        theme === "Light" ? "text-purple-700" : "text-gray-200"
                      }`}
                    >
                      Enable Notifications
                    </span>
                  </div>
                </div>

                <div>
                  <label
                    className={`block text-sm font-medium mb-2 ${
                      theme === "Light" ? "text-purple-700" : "text-gray-200"
                    }`}
                  >
                    Auto-Save
                  </label>
                  <div className="flex items-center justify-center space-x-2">
                    <input
                      id="auto-save"
                      type="checkbox"
                      checked={autoSave}
                      onChange={(e) => setAutoSave(e.target.checked)}
                      className={`h-4 w-4 focus:ring-purple-400 border-purple-300 rounded transition-all duration-200 ${
                        theme === "Light"
                          ? "text-purple-600 bg-white border-purple-300"
                          : "text-indigo-400 bg-indigo-950/90 border-indigo-600"
                      }`}
                      aria-label="Enable auto-save"
                    />
                    <span
                      className={`text-sm ${
                        theme === "Light" ? "text-purple-700" : "text-gray-200"
                      }`}
                    >
                      Auto-save notes as you type
                    </span>
                  </div>
                </div>

                <div>
                  <label
                    htmlFor="default-template"
                    className={`block text-sm font-medium mb-1 ${
                      theme === "Light" ? "text-purple-700" : "text-gray-200"
                    }`}
                  >
                    Default Template
                  </label>
                  <select
                    id="default-template"
                    value={defaultTemplate}
                    onChange={(e) => setDefaultTemplate(e.target.value)}
                    className={`w-full p-3 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-400 focus:border-purple-400 transition-all duration-300 ${
                      theme === "Light"
                        ? "bg-white/90 border-purple-300 text-purple-800 hover:bg-purple-50/90"
                        : "bg-indigo-950/90 border-indigo-600 text-white hover:bg-indigo-900/90"
                    }`}
                    aria-label="Select default template"
                  >
                    <option value="Blank">Blank</option>
                    <option value="Meeting Notes">Meeting Notes</option>
                    <option value="Project Plan">Project Plan</option>
                    <option value="Journal Entry">Journal Entry</option>
                    <option value="Code Snippet">Code Snippet</option>
                    <option value="Research Notes">Research Notes</option>
                  </select>
                </div>

                <div>
                  <label
                    htmlFor="note-sorting"
                    className={`block text-sm font-medium mb-1 ${
                      theme === "Light" ? "text-purple-700" : "text-gray-200"
                    }`}
                  >
                    Note Sorting
                  </label>
                  <select
                    id="note-sorting"
                    value={noteSorting}
                    onChange={(e) => setNoteSorting(e.target.value)}
                    className={`w-full p-3 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-400 focus:border-purple-400 transition-all duration-300 ${
                      theme === "Light"
                        ? "bg-white/90 border-purple-300 text-purple-800 hover:bg-purple-50/90"
                        : "bg-indigo-950/90 border-indigo-600 text-white hover:bg-indigo-900/90"
                    }`}
                    aria-label="Select note sorting"
                  >
                    <option value="Date Modified">
                      Date Modified (Newest First)
                    </option>
                    <option value="Date Created">
                      Date Created (Newest First)
                    </option>
                    <option value="Alphabetical">Alphabetical (A-Z)</option>
                    <option value="Custom">Custom Order</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Data & Sync Settings */}
            <div
              className={`border-b pb-6 ${
                theme === "Light" ? "border-purple-200" : "border-indigo-600"
              }`}
            >
              <div className="flex items-center mb-4">
                <span className="text-2xl mr-3">💾</span>
                <h3
                  className={`text-xl font-bold ${
                    theme === "Light" ? "text-purple-800" : "text-gold-100"
                  }`}
                >
                  Data & Sync
                </h3>
              </div>
              <div className="space-y-4">
                <div>
                  <label
                    htmlFor="sync-interval"
                    className={`block text-sm font-medium mb-1 ${
                      theme === "Light" ? "text-purple-700" : "text-gray-200"
                    }`}
                  >
                    Auto-Sync Interval (minutes)
                  </label>
                  <input
                    id="sync-interval"
                    type="number"
                    min="5"
                    max="120"
                    value={syncInterval}
                    onChange={(e) =>
                      setSyncInterval(parseInt(e.target.value) || 15)
                    }
                    className={`w-full p-3 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-400 focus:border-purple-400 transition-all duration-300 ${
                      theme === "Light"
                        ? "bg-white/90 border-purple-300 text-purple-800 hover:bg-purple-50/90"
                        : "bg-indigo-950/90 border-indigo-600 text-white hover:bg-indigo-900/90"
                    }`}
                    aria-label="Set sync interval"
                  />
                  <p
                    className={`text-xs mt-1 ${
                      theme === "Light" ? "text-purple-600" : "text-gray-400"
                    }`}
                  >
                    How often to automatically sync your notes (5-120 minutes)
                  </p>
                </div>

                <div>
                  <label
                    htmlFor="data-retention"
                    className={`block text-sm font-medium mb-1 ${
                      theme === "Light" ? "text-purple-700" : "text-gray-200"
                    }`}
                  >
                    Data Retention (days)
                  </label>
                  <select
                    id="data-retention"
                    value={dataRetention}
                    onChange={(e) => setDataRetention(parseInt(e.target.value))}
                    className={`w-full p-3 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-400 focus:border-purple-400 transition-all duration-300 ${
                      theme === "Light"
                        ? "bg-white/90 border-purple-300 text-purple-800 hover:bg-purple-50/90"
                        : "bg-indigo-950/90 border-indigo-600 text-white hover:bg-indigo-900/90"
                    }`}
                    aria-label="Select data retention period"
                  >
                    <option value={30}>30 days</option>
                    <option value={90}>90 days</option>
                    <option value={365}>1 year</option>
                    <option value={-1}>Forever</option>
                  </select>
                  <p
                    className={`text-xs mt-1 ${
                      theme === "Light" ? "text-purple-600" : "text-gray-400"
                    }`}
                  >
                    How long to keep deleted notes before permanent removal
                  </p>
                </div>

                {onCleanupOrphanedNotes && (
                  <div
                    className={`p-4 rounded-lg border-2 ${
                      theme === "Light"
                        ? "bg-red-50/50 border-red-200"
                        : "bg-red-950/20 border-red-600"
                    }`}
                  >
                    <div className="flex items-center mb-2">
                      <span className="text-2xl mr-2">🧹</span>
                      <label
                        className={`text-sm font-semibold ${
                          theme === "Light" ? "text-red-800" : "text-red-200"
                        }`}
                      >
                        Database Maintenance
                      </label>
                    </div>
                    <p
                      className={`text-xs mb-3 ${
                        theme === "Light" ? "text-red-600" : "text-red-400"
                      }`}
                    >
                      Clean up notes that were encrypted with an old method and
                      cannot be recovered
                    </p>
                    <button
                      onClick={onCleanupOrphanedNotes}
                      className={`px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                        theme === "Light"
                          ? "bg-red-600 hover:bg-red-700 text-white"
                          : "bg-red-600 hover:bg-red-700 text-white"
                      }`}
                    >
                      Clean Up Orphaned Notes
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
          {hasChanges && (
            <div className="flex justify-center space-x-4 mt-6">
              <button
                onClick={handleCancel}
                className={`py-2 px-6 rounded-lg transition-all duration-200 ${
                  theme === "Light"
                    ? "bg-gray-200 hover:bg-gray-300 text-purple-800"
                    : "bg-gray-700 hover:bg-gray-800 text-white"
                }`}
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                className={`py-2 px-6 rounded-lg transition-all duration-200 ${
                  theme === "Light"
                    ? "bg-purple-600 hover:bg-purple-700 text-white"
                    : "bg-green-700 hover:bg-green-800 text-white"
                }`}
              >
                Save Settings
              </button>
            </div>
          )}

          {/* Support Section */}
          <div className="mt-8 p-4 rounded-lg border border-gray-600 bg-gray-800/50">
            <h3 className={`text-lg font-semibold mb-3 ${
              theme === "Light" ? "text-gray-800" : "text-gray-100"
            }`}>
              💝 Support Elysium
            </h3>
            <p className={`text-sm mb-3 ${
              theme === "Light" ? "text-gray-600" : "text-gray-300"
            }`}>
              Help keep Elysium free and open-source! Your support means the world to us.
            </p>
            <div className="flex items-center space-x-2">
              <input
                type="text"
                value="aIpHglLytKVYcPiIt6ag9RG6FhtetMk_ThaDUWKrPYk"
                readOnly
                className={`flex-1 px-3 py-2 text-xs font-mono rounded border ${
                  theme === "Light"
                    ? "bg-gray-100 border-gray-300 text-gray-800"
                    : "bg-gray-700 border-gray-600 text-gray-200"
                }`}
                onClick={(e) => e.currentTarget.select()}
              />
              <button
                onClick={() => {
                  navigator.clipboard.writeText("aIpHglLytKVYcPiIt6ag9RG6FhtetMk_ThaDUWKrPYk");
                  setCopyButtonText("Copied!");
                  setTimeout(() => setCopyButtonText("Copy"), 2000);
                }}
                className={`px-3 py-2 text-xs rounded transition-all duration-200 ${
                  copyButtonText === "Copied!"
                    ? "bg-green-600 hover:bg-green-700 text-white"
                    : theme === "Light"
                    ? "bg-blue-600 hover:bg-blue-700 text-white"
                    : "bg-blue-700 hover:bg-blue-800 text-white"
                }`}
              >
                {copyButtonText}
              </button>
            </div>
            <p className={`text-xs mt-2 ${
              theme === "Light" ? "text-gray-500" : "text-gray-400"
            }`}>
              Arweave Address • Click to copy
            </p>
          </div>

          {onLogout && (
            <div className="flex justify-center mt-6">
              <button
                onClick={onLogout}
                className={`py-2 px-6 rounded-lg transition-all duration-200 ${
                  theme === "Light"
                    ? "bg-red-600 hover:bg-red-700 text-white"
                    : "bg-red-700 hover:bg-red-800 text-white"
                }`}
              >
                Logout
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Settings;
