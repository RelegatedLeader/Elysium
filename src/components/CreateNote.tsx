import React, { useState, useEffect } from "react";

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
    </div>
  );
};

export default CreateNote;
