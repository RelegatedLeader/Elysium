import React, { useState, useEffect, useRef } from "react";
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
  const [chatInput, setChatInput] = useState("");
  const [messageHistory, setMessageHistory] = useState<Array<{type: 'user' | 'ai', content: string}>>([]);

  // Ref for auto-scrolling to bottom of messages
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when new messages are added
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messageHistory]);

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

    // Add timeout to prevent infinite loading
    const timeoutId = setTimeout(() => {
      setIsGenerating(false);
      setAiSuggestions(["⏰ Request timed out. Please try again."]);
    }, 30000); // 30 second timeout

    try {
      console.log('Sending request to OpenRouter for', type);

      const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.REACT_APP_OPENROUTER_API_KEY}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': window.location.origin,
          'X-Title': 'Elysium Note Assistant',
        },
        body: JSON.stringify({
          model: 'meta-llama/llama-3.2-3b-instruct:free',
          messages: [{
            role: 'user',
            content: getPromptForType(type, context)
          }],
          max_tokens: 300,
          temperature: 0.3,
        }),
      });

      clearTimeout(timeoutId); // Clear timeout on successful response

      if (!response.ok) {
        const errorText = await response.text();
        console.error('OpenRouter API Error:', response.status, errorText);
        throw new Error(`API request failed: ${response.status} - ${errorText}`);
      }

      const data = await response.json();
      console.log('Received response from OpenRouter:', data);

      const suggestion = data.choices?.[0]?.message?.content;

      if (!suggestion) {
        throw new Error('No response content received from API');
      }

      setAiSuggestions([suggestion]);
    } catch (error) {
      console.error("OpenRouter API error:", error);
      clearTimeout(timeoutId); // Clear timeout on error
      setIsGenerating(false); // Ensure generating state is reset immediately

      let errorMessage = "❌ Sorry, couldn't generate suggestions right now.";

      if (error instanceof Error) {
        if (error.message.includes('429')) {
          errorMessage = "⏳ AI is busy right now. Please try again in a moment.";
        } else if (error.message.includes('401')) {
          errorMessage = "🔑 API key issue. Please check your OpenRouter token.";
        } else if (error.message.includes('403')) {
          errorMessage = "🚫 Access denied. Please verify your API permissions.";
        } else if (error.message.includes('402')) {
          errorMessage = "💰 Free credits exhausted. Please try again later.";
        } else if (error.message.includes('timeout') || error.message.includes('timed out')) {
          errorMessage = "⏰ Request timed out. Please try again.";
        }
      }

      setAiSuggestions([errorMessage]);
      return; // Exit early on error
    } finally {
      setIsGenerating(false);
    }
  };

  const getPromptForType = (type: string, context: string) => {
    const prompts = {
      summarize: `Please provide a clear and concise summary of this note in 2-3 sentences:\n\n${context}`,
      list: `Extract the main points and create a numbered list from this note:\n\n${context}`,
      todo: `Convert this note into a checklist of actionable tasks. Use * for each checkbox item:\n\n${context}`,
      improve: `Please improve and enhance this note by making it clearer, more organized, and more professional:\n\n${context}`
    };
    return prompts[type as keyof typeof prompts] || `Please help me with this note: ${context}`;
  };

  const handleChatSubmit = async () => {
    if (!chatInput.trim() || isGenerating) return;

    const userMessage = chatInput.trim();
    setChatInput('');

    // Add user message to history
    setMessageHistory(prev => [...prev, { type: 'user', content: userMessage }]);

    setIsGenerating(true);

    // Add timeout to prevent infinite loading
    const timeoutId = setTimeout(() => {
      setIsGenerating(false);
      setAiSuggestions(["⏰ Request timed out. Please try again."]);
    }, 30000); // 30 second timeout

    try {
      const conversationContext = messageHistory.slice(-4).map(msg =>
        `${msg.type === 'user' ? 'User' : 'Assistant'}: ${msg.content}`
      ).join('\n\n');

      const fullPrompt = `You are a helpful AI assistant for note-taking. The user is working with this note: "${content}"

Previous conversation:
${conversationContext}

User's new question: ${userMessage}

Please provide a helpful, friendly response. Be conversational and focus on helping with their note-taking needs.`;

      console.log('Sending request to OpenRouter...');

      const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.REACT_APP_OPENROUTER_API_KEY}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': window.location.origin,
          'X-Title': 'Elysium Note Assistant',
        },
        body: JSON.stringify({
          model: 'meta-llama/llama-3.2-3b-instruct:free',
          messages: [{
            role: 'user',
            content: fullPrompt
          }],
          max_tokens: 300,
          temperature: 0.7,
        }),
      });

      clearTimeout(timeoutId); // Clear timeout on successful response

      if (!response.ok) {
        const errorText = await response.text();
        console.error('OpenRouter Chat API Error:', response.status, errorText);
        throw new Error(`API request failed: ${response.status} - ${errorText}`);
      }

      const data = await response.json();
      console.log('Received response from OpenRouter:', data);

      const aiResponse = data.choices?.[0]?.message?.content;

      if (!aiResponse) {
        throw new Error('No response content received from API');
      }

      // Add AI response to history
      setMessageHistory(prev => [...prev, { type: 'ai', content: aiResponse }]);

      // Update suggestions to show the latest response
      setAiSuggestions([aiResponse]);
    } catch (error) {
      console.error("Chat API error:", error);
      clearTimeout(timeoutId); // Clear timeout on error
      setIsGenerating(false); // Ensure generating state is reset immediately

      let errorMessage = "❌ Sorry, couldn't generate a response right now.";

      if (error instanceof Error) {
        if (error.message.includes('429')) {
          errorMessage = "⏳ AI is busy right now. Please try again in a moment.";
        } else if (error.message.includes('401')) {
          errorMessage = "🔑 API key issue. Please check your OpenRouter token.";
        } else if (error.message.includes('403')) {
          errorMessage = "🚫 Access denied. Please verify your API permissions.";
        } else if (error.message.includes('402')) {
          errorMessage = "💰 Free credits exhausted. Please try again later.";
        } else if (error.message.includes('timeout') || error.message.includes('timed out')) {
          errorMessage = "⏰ Request timed out. Please try again.";
        }
      }

      setAiSuggestions([errorMessage]);
      return; // Exit early on error
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
          <div className="bg-gradient-to-br from-indigo-900/95 via-indigo-800/95 to-purple-700/95 backdrop-blur-lg border border-indigo-500/50 rounded-xl shadow-[0_0_30px_rgba(79,70,229,0.3)] p-4 max-w-xs w-80 max-h-[32rem] overflow-y-auto">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-lg font-semibold text-gold-100 flex items-center">
                <span className="text-xl mr-2">🐘</span>
                AI Assistant
              </h3>
              <button
                onClick={() => {
                  setShowAIPopup(false);
                  setMessageHistory([]);
                  setAiSuggestions([]);
                }}
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

              {/* Chat Input */}
              <div className="space-y-2">
                <h4 className="text-gold-100 font-medium text-sm">💬 Ask AI:</h4>
                <div className="flex space-x-2">
                  <input
                    type="text"
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && handleChatSubmit()}
                    placeholder="Ask anything about your note..."
                    className="flex-1 bg-indigo-950/50 border border-indigo-700/50 rounded px-2 py-1 text-silver-200 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-400 focus:border-indigo-400"
                    disabled={isGenerating}
                  />
                  <button
                    onClick={handleChatSubmit}
                    disabled={!chatInput.trim() || isGenerating}
                    className="bg-indigo-600/70 hover:bg-indigo-500/70 disabled:bg-gray-700/50 text-white px-3 py-1 rounded text-xs transition-colors disabled:cursor-not-allowed"
                  >
                    Send
                  </button>
                </div>
              </div>

              {/* Loading State */}
              {isGenerating && (
                <div className="text-center py-2">
                  <div className="inline-block animate-spin rounded-full h-4 w-4 border-b-2 border-gold-400"></div>
                  <p className="text-silver-300 text-xs mt-1">Generating...</p>
                </div>
              )}

              {/* Message History */}
              {messageHistory.length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-gold-100 font-medium text-sm">� Conversation:</h4>
                  <div className="max-h-48 overflow-y-auto space-y-2">
                    {messageHistory.map((message, index) => (
                      <div
                        key={index}
                        className={`rounded p-2 text-xs ${
                          message.type === 'user'
                            ? 'bg-indigo-600/30 border-l-2 border-indigo-400'
                            : 'bg-purple-600/30 border-l-2 border-purple-400'
                        }`}
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <span className="text-gold-100 font-medium text-xs">
                              {message.type === 'user' ? '👤 You:' : '🤖 AI:'}
                            </span>
                            <p className="text-silver-200 mt-1 whitespace-pre-wrap leading-relaxed">
                              {message.content}
                            </p>
                          </div>
                          <button
                            onClick={() => copyToClipboard(message.content)}
                            className="text-gold-400 hover:text-gold-300 opacity-0 group-hover:opacity-100 transition-opacity ml-2 text-xs"
                            title="Copy to clipboard"
                          >
                            📋
                          </button>
                        </div>
                      </div>
                    ))}
                    <div ref={messagesEndRef} /> {/* Invisible element for auto-scrolling */}
                  </div>
                </div>
              )}

              {/* Latest AI Response */}
              {aiSuggestions.length > 0 && messageHistory.length === 0 && (
                <div className="space-y-2">
                  <h4 className="text-gold-100 font-medium text-sm">💡 Latest Response:</h4>
                  <div className="bg-purple-600/30 border border-purple-400/50 rounded p-3 text-xs">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <span className="text-gold-100 font-medium text-xs">🤖 AI:</span>
                        <p className="text-silver-200 mt-1 whitespace-pre-wrap leading-relaxed">
                          {aiSuggestions[0]}
                        </p>
                      </div>
                      <button
                        onClick={() => copyToClipboard(aiSuggestions[0])}
                        className="text-gold-400 hover:text-gold-300 transition-opacity ml-2 text-xs"
                        title="Copy to clipboard"
                      >
                        📋
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CreateNote;
