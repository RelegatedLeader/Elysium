import React, { useState, useEffect } from "react";
import elysiumLogo from "../img/elysium_logo_2.jpg";

interface CreateNoteProps {
  onSave: (note: {
    title: string;
    content: string;
    template: string;
    files: File[];
  }) => void;
  onCancel: () => void;
  mode: "web3" | "db" | "cloud";
}

const CreateNote: React.FC<CreateNoteProps> = ({ onSave, onCancel, mode }) => {
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [template, setTemplate] = useState("Auto");
  const [files, setFiles] = useState<File[]>([]);
  const [showAIPopup, setShowAIPopup] = useState(false);
  const [aiSuggestions, setAiSuggestions] = useState<string[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);

  const getPlaceholderText = () => {
    switch (template) {
      case "To-Do List":
        return "Create your to-do list:\n* Task 1\n* Task 2\n* Task 3\n\nUse * to create checkbox items";
      case "List":
        return "Create your list:\n- Item 1\n- Item 2\n- Item 3\n\nUse - or . to create bullet points";
      case "Canvas":
        return "Free-form canvas - write, draw ideas, brainstorm...\n\nIdeas:\nConnections:\nNotes:";
      case "Auto":
        return "Welcome to Elysium! Here's how to use templates:\n\n📝 List: Use - or . for bullet points\n✅ To-Do List: Use * for checkboxes\n🎨 Canvas: Free-form writing\n\nStart typing to automatically detect your template!";
      default:
        return "Type your note here (e.g., * Task or - Item)...";
    }
  };

  const getTextareaClass = () => {
    const baseClass = "w-full p-4 bg-indigo-950/80 border border-indigo-700/50 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-indigo-400 transition-all duration-200 resize-none hover:shadow-[inset_0_0_10px_rgba(79,70,229,0.2)]";
    
    if (template === "Canvas") {
      return baseClass + " h-80 font-mono text-sm";
    }
    return baseClass + " h-64";
  };

  const handleContentChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newContent = e.target.value;
    setContent(newContent);

    // Auto-template detection for "Auto" mode
    if (template === "Auto") {
      const firstLine = newContent.trim().split("\n")[0] || "";
      if (firstLine.startsWith("* ")) {
        setTemplate("To-Do List");
      } else if (firstLine.startsWith("-") || firstLine.startsWith(".")) {
        setTemplate("List");
      }
    }
  };

  // AI Assistant Functions
  const generateAISuggestions = async (context: string, type: string) => {
    setIsGenerating(true);
    try {
      // For now, using rule-based suggestions (can be upgraded to API later)
      const suggestions = [];

      if (type === "summarize") {
        suggestions.push(`📝 Summary: ${context.split(' ').slice(0, 10).join(' ')}...`);
        suggestions.push(`🔑 Key Points:\n• ${context.split('.').slice(0, 3).join('\n• ')}`);
      } else if (type === "list") {
        const items = context.split(/[.!?]+/).filter(item => item.trim().length > 5);
        suggestions.push(`📋 Action Items:\n${items.slice(0, 5).map(item => `• ${item.trim()}`).join('\n')}`);
      } else if (type === "todo") {
        const sentences = context.split(/[.!?]+/).filter(s => s.trim().length > 3);
        suggestions.push(`✅ Tasks:\n${sentences.slice(0, 5).map(s => `* ${s.trim()}`).join('\n')}`);
      } else if (type === "improve") {
        suggestions.push(`✨ Improved: ${context.replace(/\s+/g, ' ').trim()}`);
        suggestions.push(`🎯 Concise: ${context.split(' ').slice(0, 15).join(' ')}...`);
      }

      // Add some generic helpful suggestions
      suggestions.push("💡 Tip: Use * for checkboxes, - for lists, or free-form for notes");
      suggestions.push("🔒 Security: Your notes are encrypted and stored securely");

      setAiSuggestions(suggestions);
    } catch (error) {
      console.error("AI generation error:", error);
      setAiSuggestions(["❌ Sorry, couldn't generate suggestions right now."]);
    } finally {
      setIsGenerating(false);
    }
  };

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      // Could add a toast notification here
      alert("Copied to clipboard!");
    } catch (error) {
      console.error("Copy failed:", error);
      // Fallback for older browsers
      const textArea = document.createElement("textarea");
      textArea.value = text;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand("copy");
      document.body.removeChild(textArea);
      alert("Copied to clipboard!");
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) setFiles(Array.from(e.target.files));
  };

  const handleSave = () => {
    if (title && content) {
      const confirmationMessage =
        mode === "db"
          ? "Save this note to the database?"
          : mode === "web3"
          ? "Save this note to the blockchain? (Gas fee applies)"
          : "Save this note to cloud storage?";
      
      if (window.confirm(confirmationMessage)) {
        onSave({ title, content, template, files });
        setTitle("");
        setContent("");
        setTemplate("Auto");
        setFiles([]);
      }
    }
  };

  return (
    <div className="flex items-center justify-center">
      <div className="relative w-[32rem] max-w-full mx-4">
        <div className="rounded-xl p-8 bg-gradient-to-br from-indigo-900/80 via-indigo-800/80 to-purple-700/80 backdrop-blur-lg border border-indigo-500/50 shadow-[0_0_15px_rgba(79,70,229,0.3)] hover:shadow-[0_0_20px_rgba(79,70,229,0.5)] transition-all duration-300 ease-in-out transform hover:scale-105">
          <h2 className="text-2xl font-semibold text-gold-100 mb-6 text-center tracking-tight text-shadow-md">
            Create New Note
          </h2>
          <div className="space-y-6">
            <div>
              <label
                htmlFor="title"
                className="block text-sm font-medium text-gray-200 mb-1"
              >
                Note Title
              </label>
              <input
                id="title"
                type="text"
                placeholder="Enter Note Title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full p-3 bg-indigo-950/80 border border-indigo-700/50 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-indigo-400 transition-all duration-200 hover:shadow-[inset_0_0_10px_rgba(79,70,229,0.2)]"
                aria-required="true"
              />
            </div>
            <div>
              <label
                htmlFor="content"
                className="block text-sm font-medium text-gray-200 mb-1"
              >
                Note Content
              </label>
              <div className="flex items-center justify-between mb-2">
                <select
                  value={template}
                  onChange={(e) => setTemplate(e.target.value)}
                  className="p-2 bg-indigo-950/80 border border-indigo-700/50 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-indigo-400 transition-all duration-200 hover:shadow-[0_0_5px_rgba(79,70,229,0.3)]"
                  aria-label="Select note template"
                >
                  <option value="Auto">Auto</option>
                  <option value="To-Do List">To-Do List</option>
                  <option value="List">List</option>
                  <option value="Canvas">Canvas</option>
                </select>
                <label className="flex items-center cursor-pointer text-gray-200 hover:text-indigo-300 transition-colors duration-200 hover:shadow-[0_0_5px_rgba(79,70,229,0.3)]">
                  <svg
                    className="w-4 h-4"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                    aria-hidden="true"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      d="M15.172 7l-6.586 6.586a2 2 0 002.828 2.828l6.586-6.586a4 4 0 00-5.656-5.656l-6.586 6.586a6 6 0 008.485 8.485l6.586-6.586"
                    />
                  </svg>
                  <input
                    type="file"
                    multiple
                    onChange={handleFileChange}
                    className="hidden"
                    aria-label="Attach files"
                  />
                </label>
              </div>
              <textarea
                id="content"
                placeholder={getPlaceholderText()}
                value={content}
                onChange={handleContentChange}
                className={getTextareaClass()}
                aria-required="true"
              />
              {files.length > 0 && (
                <p className="text-xs text-gray-400 mt-2">
                  {files.length} file(s) selected
                </p>
              )}
            </div>
            <div className="flex justify-end space-x-4">
              <button
                onClick={onCancel}
                className="px-4 py-2 bg-gray-700/80 text-white rounded-lg hover:bg-gray-600/80 focus:ring-2 focus:ring-gray-500 focus:outline-none transition-all duration-200 hover:shadow-[0_0_10px_rgba(107,114,128,0.4)]"
                aria-label="Cancel note creation"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                className="px-6 py-3 bg-gradient-to-r from-cyan-500 to-blue-700 text-white font-bold rounded-full hover:from-cyan-600 hover:to-blue-800 focus:ring-2 focus:ring-blue-400 focus:outline-none transition-all duration-200 hover:shadow-[0_0_15px_rgba(0,74,173,0.7)]"
                aria-label="Save note to blockchain"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* AI Mascot - positioned at bottom right of create note interface */}
      <div
        className="absolute bottom-4 right-4 cursor-pointer transition-all duration-300 ease-out hover:scale-110"
        onClick={() => setShowAIPopup(!showAIPopup)}
      >
        <div className="w-14 h-14 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-full flex items-center justify-center shadow-lg hover:shadow-xl transition-shadow duration-300 border-2 border-gold-400/50 animate-pulse relative overflow-hidden">
          {/* Custom Elephant Logo Image */}
          <img
            src={elysiumLogo}
            alt="Elysium AI Elephant"
            className="w-10 h-10 rounded-full object-cover object-center"
            style={{
              transform: 'scale(1.2)',
              transformOrigin: 'center',
            }}
          />
          
          {/* Sparkle effect */}
          <div className="absolute -top-1 -right-1 w-3 h-3 bg-gold-400 rounded-full animate-ping opacity-75"></div>
        </div>
      </div>

      {/* AI Popup - positioned next to mascot */}
      {showAIPopup && (
        <div className="absolute bottom-20 right-4 z-50">
          <div className="bg-gradient-to-br from-indigo-900/95 via-indigo-800/95 to-purple-700/95 backdrop-blur-lg border border-indigo-500/50 rounded-xl shadow-[0_0_30px_rgba(79,70,229,0.3)] p-4 max-w-xs w-80">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-lg font-semibold text-gold-100 flex items-center">
                <span className="text-xl mr-2">🐘</span>
                AI Assistant
              </h3>
              <button
                onClick={() => setShowAIPopup(false)}
                className="text-gray-400 hover:text-white transition-colors text-sm"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3">
              <p className="text-silver-200 text-xs">
                Transform your thoughts into perfect notes!
              </p>

              {/* AI Action Buttons - smaller grid */}
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => generateAISuggestions(content, "summarize")}
                  disabled={!content.trim() || isGenerating}
                  className="bg-indigo-700/50 hover:bg-indigo-600/50 disabled:bg-gray-700/50 text-silver-200 px-2 py-1.5 rounded text-xs transition-colors disabled:cursor-not-allowed"
                >
                  📝 Summarize
                </button>
                <button
                  onClick={() => generateAISuggestions(content, "list")}
                  disabled={!content.trim() || isGenerating}
                  className="bg-indigo-700/50 hover:bg-indigo-600/50 disabled:bg-gray-700/50 text-silver-200 px-2 py-1.5 rounded text-xs transition-colors disabled:cursor-not-allowed"
                >
                  📋 Extract
                </button>
                <button
                  onClick={() => generateAISuggestions(content, "todo")}
                  disabled={!content.trim() || isGenerating}
                  className="bg-indigo-700/50 hover:bg-indigo-600/50 disabled:bg-gray-700/50 text-silver-200 px-2 py-1.5 rounded text-xs transition-colors disabled:cursor-not-allowed"
                >
                  ✅ Tasks
                </button>
                <button
                  onClick={() => generateAISuggestions(content, "improve")}
                  disabled={!content.trim() || isGenerating}
                  className="bg-indigo-700/50 hover:bg-indigo-600/50 disabled:bg-gray-700/50 text-silver-200 px-2 py-1.5 rounded text-xs transition-colors disabled:cursor-not-allowed"
                >
                  ✨ Improve
                </button>
              </div>

              {/* Loading State */}
              {isGenerating && (
                <div className="text-center py-2">
                  <div className="inline-block animate-spin rounded-full h-4 w-4 border-b-2 border-gold-400"></div>
                  <p className="text-silver-300 text-xs mt-1">Generating...</p>
                </div>
              )}

              {/* AI Suggestions - compact */}
              {aiSuggestions.length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-gold-100 font-medium text-sm">💡 Click to copy:</h4>
                  <div className="max-h-32 overflow-y-auto space-y-1">
                    {aiSuggestions.slice(0, 3).map((suggestion, index) => (
                      <div
                        key={index}
                        onClick={() => copyToClipboard(suggestion)}
                        className="bg-indigo-950/50 rounded p-2 border border-indigo-700/50 cursor-pointer hover:bg-indigo-900/50 transition-colors group text-xs"
                      >
                        <div className="flex justify-between items-start">
                          <pre className="text-silver-200 whitespace-pre-wrap flex-1 font-mono leading-tight">
                            {suggestion.length > 80 ? suggestion.substring(0, 80) + "..." : suggestion}
                          </pre>
                          <span className="text-gold-400 opacity-0 group-hover:opacity-100 transition-opacity ml-1 text-xs">
                            📋
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Template Tips - compact */}
              <div className="bg-indigo-950/50 rounded p-2 border border-indigo-700/50">
                <h4 className="text-gold-100 font-medium mb-1 text-sm">🎨 Tips:</h4>
                <ul className="text-silver-300 space-y-0.5 text-xs">
                  <li>• <strong>*</strong> for checkboxes</li>
                  <li>• <strong>-</strong> for lists</li>
                  <li>• Free-form for notes</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CreateNote;
