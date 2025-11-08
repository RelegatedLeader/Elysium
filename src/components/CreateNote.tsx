import React, { useState, useEffect, useRef } from "react";
import ContentEditable from "react-contenteditable";
import elysiumLogo from "../img/elysium_logo_2.jpg";
import SaveConfirmationPopup from "./SaveConfirmationPopup";
import { useDynamicTranslation } from "../hooks/useDynamicTranslation";

interface CreateNoteProps {
  onSave: (note: {
    title: string;
    content: string;
    template: string;
    files: File[];
  }) => void;
  onCancel: () => void;
  mode: "web3" | "db" | "cloud";
  theme?: string;
  defaultTemplate?: string;
  aiResponseStyle?: string;
  aiPersonality?: string;
  // Editing props
  isEditing?: boolean;
  initialTitle?: string;
  initialContent?: string;
  initialTemplate?: string;
  onEdit?: (note: {
    title: string;
    content: string;
    template: string;
    files: File[];
  }) => void;
}

const CreateNote: React.FC<CreateNoteProps> = ({
  onSave,
  onCancel,
  mode,
  theme = "Dark",
  defaultTemplate = "Blank",
  aiResponseStyle = "Balanced",
  aiPersonality = "Professional",
  isEditing = false,
  initialTitle = "",
  initialContent = "",
  initialTemplate = "Auto",
  onEdit,
}) => {
  // Function to strip HTML tags for plain text editing
  const stripHtml = (html: string) => {
    const tmp = document.createElement("DIV");
    tmp.innerHTML = html;
    return tmp.textContent || tmp.innerText || "";
  };

  // State management
  const [title, setTitle] = useState(isEditing ? initialTitle : "");
  const [content, setContent] = useState(
    isEditing ? stripHtml(initialContent) : ""
  );
  const [htmlContent, setHtmlContent] = useState(
    isEditing ? initialContent : ""
  );
  const [template, setTemplate] = useState(
    isEditing ? initialTemplate : defaultTemplate
  );
  const [files, setFiles] = useState<File[]>([]);
  const [showAIPopup, setShowAIPopup] = useState(false);
  const [showSaveConfirmation, setShowSaveConfirmation] = useState(false);
  const [saveConfirmationMessage, setSaveConfirmationMessage] = useState("");
  const [aiSuggestions, setAiSuggestions] = useState<string[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [chatInput, setChatInput] = useState("");
  const [messageHistory, setMessageHistory] = useState<
    Array<{ type: "user" | "ai"; content: string }>
  >([]);
  // Formatting state for create mode
  const [isBoldActive, setIsBoldActive] = useState(false);
  const [isItalicActive, setIsItalicActive] = useState(false);
  const [isListActive, setIsListActive] = useState(false);

  // Refs for auto-scrolling and textarea focus
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Translation hook
  const { translate, currentLanguage, ensureLanguageApplied } =
    useDynamicTranslation();

  // Translated strings state
  const [translatedStrings, setTranslatedStrings] = useState({
    createNewNote: "Create New Note",
    noteTitle: "Note Title",
    enterNoteTitle: "Enter Note Title",
    noteContent: "Note Content",
    auto: "Auto",
    toDoList: "To-Do List",
    list: "List",
    canvas: "Canvas",
    attachFiles: "Attach Files",
    listButton: "• List",
    boldButton: "B",
    italicButton: "I",
    largeHeading: "Large Heading",
    save: "Save",
    cancel: "Cancel",
    editNote: "Edit Note",
    insertBulletList: "Insert bullet list",
    boldText: "Bold text",
    italicText: "Italic text",
    largeHeadingTitle: "Large heading",
  });

  // Translate strings when language changes
  useEffect(() => {
    const translateStrings = async () => {
      try {
        const newStrings = {
          createNewNote: await translate("Create New Note"),
          noteTitle: await translate("Note Title"),
          enterNoteTitle: await translate("Enter Note Title"),
          noteContent: await translate("Note Content"),
          auto: await translate("Auto"),
          toDoList: await translate("To-Do List"),
          list: await translate("List"),
          canvas: await translate("Canvas"),
          attachFiles: await translate("Attach Files"),
          listButton: await translate("• List"),
          boldButton: await translate("B"),
          italicButton: await translate("I"),
          largeHeading: await translate("Large Heading"),
          save: await translate("Save"),
          cancel: await translate("Cancel"),
          editNote: await translate("Edit Note"),
          insertBulletList: await translate("Insert bullet list"),
          boldText: await translate("Bold text"),
          italicText: await translate("Italic text"),
          largeHeadingTitle: await translate("Large heading"),
        };
        setTranslatedStrings(newStrings);
      } catch (error) {
        console.error("Translation error:", error);
        // Fallback to original strings
        setTranslatedStrings({
          createNewNote: "Create New Note",
          noteTitle: "Note Title",
          enterNoteTitle: "Enter Note Title",
          noteContent: "Note Content",
          auto: "Auto",
          toDoList: "To-Do List",
          list: "List",
          canvas: "Canvas",
          attachFiles: "Attach Files",
          listButton: "• List",
          boldButton: "B",
          italicButton: "I",
          largeHeading: "Large Heading",
          save: "Save",
          cancel: "Cancel",
          editNote: "Edit Note",
          insertBulletList: "Insert bullet list",
          boldText: "Bold text",
          italicText: "Italic text",
          largeHeadingTitle: "Large heading",
        });
      }
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

  // Focus textarea when editing
  useEffect(() => {
    if (isEditing && textareaRef.current) {
      // Simple focus for editing - user can click where they want to edit
      setTimeout(() => {
        textareaRef.current?.focus();
      }, 100);
    }
  }, [isEditing]);

  // Auto-scroll to bottom when new messages are added
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messageHistory]);

  const getPlaceholderText = () => {
    switch (template) {
      case "To-Do List":
        return "Create your to-do list:\n* Task 1\n* Task 2\n* Task 3\n\nUse the toolbar buttons to format your text";
      case "List":
        return "Create your list:\n- Item 1\n- Item 2\n- Item 3\n\nUse the toolbar buttons to format your text";
      case "Canvas":
        return "Free-form canvas - write, draw ideas, brainstorm...\n\nIdeas:\nConnections:\nNotes:\n\nUse the toolbar buttons to format your text";
      case "Auto":
        return "Type your note here. Use the toolbar buttons above to format your text with lists, bold, italic, and more.";
      default:
        return "Type your note here. Use the toolbar buttons above to format your text.";
    }
  };

  const getTextareaClass = () => {
    const baseClass =
      "w-full p-4 bg-indigo-950/80 border border-indigo-700/50 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-indigo-400 transition-all duration-200 resize-none hover:shadow-[inset_0_0_10px_rgba(79,70,229,0.2)]";

    if (template === "Canvas") {
      return baseClass + " font-mono text-sm";
    }
    return baseClass;
  };

  const handleHtmlContentChange = (evt: any) => {
    let newHtml = evt.target.value;
    setHtmlContent(newHtml);
    // For create mode, also update content for saving
    if (!isEditing) {
      setContent(newHtml);
    }
  };

  const handleContentChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setContent(e.target.value);
  };

  // Check current formatting state for create mode
  const updateFormattingState = () => {
    if (!isEditing) {
      setIsBoldActive(document.queryCommandState("bold"));
      setIsItalicActive(document.queryCommandState("italic"));
      setIsListActive(document.queryCommandState("insertUnorderedList"));
    }
  };

  // Monitor formatting changes in create mode
  useEffect(() => {
    if (!isEditing) {
      const contentEditable = document.querySelector("[contenteditable]");
      if (contentEditable) {
        // Monitor selection changes to update formatting state
        const handleSelectionChange = () => {
          updateFormattingState();
        };

        document.addEventListener("selectionchange", handleSelectionChange);
        contentEditable.addEventListener("keyup", handleSelectionChange);
        contentEditable.addEventListener("mouseup", handleSelectionChange);

        return () => {
          document.removeEventListener(
            "selectionchange",
            handleSelectionChange
          );
          contentEditable.removeEventListener("keyup", handleSelectionChange);
          contentEditable.removeEventListener("mouseup", handleSelectionChange);
        };
      }
    }
  }, [isEditing]);

  // HTML formatting functions for create mode
  const formatText = (command: string, value?: string) => {
    document.execCommand(command, false, value);
    // Update formatting state after command execution
    setTimeout(updateFormattingState, 10);
  };

  const insertBulletList = () => {
    formatText("insertUnorderedList");
  };

  const insertBold = () => {
    formatText("bold");
  };

  const insertItalic = () => {
    formatText("italic");
  };

  const insertLargeText = () => {
    formatText("formatBlock", "h1");
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
      console.log("Sending request to Mistral AI for", type);
      console.log(
        "API Key available:",
        !!process.env.REACT_APP_MISTRAL_API_KEY
      );

      // Adjust parameters based on AI response style
      const getAIParameters = () => {
        switch (aiResponseStyle) {
          case "Concise":
            return { max_tokens: 150, temperature: 0.1 };
          case "Balanced":
            return { max_tokens: 300, temperature: 0.3 };
          case "Detailed":
            return { max_tokens: 500, temperature: 0.4 };
          case "Creative":
            return { max_tokens: 400, temperature: 0.7 };
          default:
            return { max_tokens: 300, temperature: 0.3 };
        }
      };

      const { max_tokens, temperature } = getAIParameters();

      const response = await fetch(
        "https://api.mistral.ai/v1/chat/completions",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${process.env.REACT_APP_MISTRAL_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "mistral-small",
            messages: [
              {
                role: "user",
                content: getPromptForType(type, context, aiPersonality),
              },
            ],
            max_tokens: max_tokens,
            temperature: temperature,
          }),
        }
      );

      clearTimeout(timeoutId); // Clear timeout on successful response

      if (!response.ok) {
        const errorText = await response.text();
        console.error("OpenRouter API Error:", response.status, errorText);
        throw new Error(
          `API request failed: ${response.status} - ${errorText}`
        );
      }

      const data = await response.json();
      console.log("Received response from Mistral AI:", data);

      const suggestion = data.choices?.[0]?.message?.content;
      console.log("Extracted suggestion:", suggestion);

      if (!suggestion) {
        throw new Error("No response content received from API");
      }

      // Add the AI suggestion to message history so it appears in chat
      setMessageHistory((prev) => [
        ...prev,
        { type: "ai", content: suggestion },
      ]);
      setAiSuggestions([suggestion]);
    } catch (error) {
      console.error("Mistral AI API error:", error);
      clearTimeout(timeoutId); // Clear timeout on error
      setIsGenerating(false); // Ensure generating state is reset immediately

      let errorMessage = "❌ Sorry, couldn't generate suggestions right now.";

      if (error instanceof Error) {
        if (error.message.includes("429")) {
          errorMessage =
            "⏳ AI is busy right now. Please try again in a moment.";
        } else if (error.message.includes("401")) {
          errorMessage = "🔑 API key issue. Please check your Mistral API key.";
        } else if (error.message.includes("403")) {
          errorMessage =
            "🚫 Access denied. Please verify your API permissions.";
        } else if (error.message.includes("402")) {
          errorMessage = "💰 Free credits exhausted. Please try again later.";
        } else if (
          error.message.includes("timeout") ||
          error.message.includes("timed out")
        ) {
          errorMessage = "⏰ Request timed out. Please try again.";
        }
      }

      setAiSuggestions([errorMessage]);
      return; // Exit early on error
    } finally {
      setIsGenerating(false);
    }
  };

  const getPromptForType = (
    type: string,
    context: string,
    personality?: string
  ) => {
    // Get personality-specific instructions
    const getPersonalityInstructions = () => {
      switch (personality) {
        case "Professional":
          return "Respond in a professional, business-like manner with clear, structured communication.";
        case "Friendly":
          return "Respond in a warm, friendly, and approachable manner, like a helpful colleague.";
        case "Technical":
          return "Respond with technical precision, using appropriate terminology and detailed explanations.";
        case "Creative":
          return "Respond creatively and engagingly, with innovative ideas and unique perspectives.";
        case "Minimalist":
          return "Respond concisely and directly, focusing only on essential information without unnecessary details.";
        default:
          return "Respond helpfully and professionally.";
      }
    };

    const personalityInstruction = personality
      ? `\n\n${getPersonalityInstructions()}`
      : "";

    const prompts = {
      summarize: `Please provide a clear and concise summary of this note in 2-3 sentences:\n\n${context}${personalityInstruction}`,
      list: `Extract the main points and create a numbered list from this note:\n\n${context}${personalityInstruction}`,
      todo: `Convert this note into a checklist of actionable tasks. Use * for each checkbox item:\n\n${context}${personalityInstruction}`,
      improve: `Please improve and enhance this note by making it clearer, more organized, and more professional:\n\n${context}${personalityInstruction}`,
    };
    return (
      prompts[type as keyof typeof prompts] ||
      `Please help me with this note: ${context}${personalityInstruction}`
    );
  };

  const handleChatSubmit = async () => {
    if (!chatInput.trim() || isGenerating) return;

    const userMessage = chatInput.trim();
    setChatInput("");

    // Add user message to history
    setMessageHistory((prev) => [
      ...prev,
      { type: "user", content: userMessage },
    ]);

    setIsGenerating(true);

    // Add timeout to prevent infinite loading
    const timeoutId = setTimeout(() => {
      setIsGenerating(false);
      setAiSuggestions(["⏰ Request timed out. Please try again."]);
    }, 30000); // 30 second timeout

    try {
      console.log("Starting chat request to Mistral AI");
      console.log(
        "API Key available:",
        !!process.env.REACT_APP_MISTRAL_API_KEY
      );
      console.log("User message:", userMessage);

      const conversationContext = messageHistory
        .slice(-4)
        .map(
          (msg) =>
            `${msg.type === "user" ? "User" : "Assistant"}: ${msg.content}`
        )
        .join("\n\n");

      // Adjust parameters based on AI response style
      const getChatParameters = () => {
        switch (aiResponseStyle) {
          case "Concise":
            return { max_tokens: 150, temperature: 0.1 };
          case "Balanced":
            return { max_tokens: 300, temperature: 0.3 };
          case "Detailed":
            return { max_tokens: 500, temperature: 0.4 };
          case "Creative":
            return { max_tokens: 400, temperature: 0.7 };
          default:
            return { max_tokens: 300, temperature: 0.3 };
        }
      };

      // Get personality-specific instructions for chat
      const getPersonalityInstructions = () => {
        switch (aiPersonality) {
          case "Professional":
            return "Respond in a professional, business-like manner with clear, structured communication.";
          case "Friendly":
            return "Respond in a warm, friendly, and approachable manner, like a helpful colleague.";
          case "Technical":
            return "Respond with technical precision, using appropriate terminology and detailed explanations.";
          case "Creative":
            return "Respond creatively and engagingly, with innovative ideas and unique perspectives.";
          case "Minimalist":
            return "Respond concisely and directly, focusing only on essential information without unnecessary details.";
          default:
            return "Respond helpfully and professionally.";
        }
      };

      const personalityInstruction = getPersonalityInstructions();
      const { max_tokens, temperature } = getChatParameters();

      const fullPrompt = `You are a helpful AI assistant for note-taking. The user is working with this note: "${content}"

${personalityInstruction}

Previous conversation:
${conversationContext}

User's new question: ${userMessage}

Please provide a helpful response. Be conversational and focus on helping with their note-taking needs.`;

      console.log("Sending chat request to Mistral AI...");

      const response = await fetch(
        "https://api.mistral.ai/v1/chat/completions",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${process.env.REACT_APP_MISTRAL_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "mistral-small",
            messages: [
              {
                role: "user",
                content: fullPrompt,
              },
            ],
            max_tokens: max_tokens,
            temperature: temperature,
          }),
        }
      );

      clearTimeout(timeoutId); // Clear timeout on successful response

      if (!response.ok) {
        const errorText = await response.text();
        console.error("Mistral AI Chat API Error:", response.status, errorText);
        throw new Error(
          `API request failed: ${response.status} - ${errorText}`
        );
      }

      const data = await response.json();
      console.log("Received response from Mistral AI:", data);

      const aiResponse = data.choices?.[0]?.message?.content;
      console.log("Extracted AI response:", aiResponse);

      if (!aiResponse) {
        throw new Error("No response content received from API");
      }

      // Add AI response to history
      setMessageHistory((prev) => [
        ...prev,
        { type: "ai", content: aiResponse },
      ]);

      // Update suggestions to show the latest response
      setAiSuggestions([aiResponse]);
    } catch (error) {
      console.error("Chat API error:", error);
      clearTimeout(timeoutId); // Clear timeout on error
      setIsGenerating(false); // Ensure generating state is reset immediately

      let errorMessage = "❌ Sorry, couldn't generate a response right now.";

      if (error instanceof Error) {
        if (error.message.includes("429")) {
          errorMessage =
            "⏳ AI is busy right now. Please try again in a moment.";
        } else if (error.message.includes("401")) {
          errorMessage =
            "🔑 API key issue. Please check your OpenRouter token.";
        } else if (error.message.includes("403")) {
          errorMessage =
            "🚫 Access denied. Please verify your API permissions.";
        } else if (error.message.includes("402")) {
          errorMessage = "💰 Free credits exhausted. Please try again later.";
        } else if (
          error.message.includes("timeout") ||
          error.message.includes("timed out")
        ) {
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
      // Skip confirmation for web3 drafts since they don't cost gas
      if (mode === "web3") {
        performSave();
      } else {
        // Show custom confirmation popup
        const message = isEditing
          ? "Save changes to this note?"
          : mode === "db"
          ? "Save this note to the database?"
          : mode === "cloud"
          ? "Save this note to cloud storage?"
          : "Save this note?";
        setSaveConfirmationMessage(message);
        setShowSaveConfirmation(true);
      }
    }
  };

  const performSave = () => {
    const noteContent = isEditing ? content : htmlContent;
    if (isEditing && onEdit) {
      onEdit({ title, content: noteContent, template, files });
    } else {
      onSave({ title, content: noteContent, template, files });
      setTitle("");
      setContent("");
      setHtmlContent("");
      setTemplate("Auto");
      setFiles([]);
    }
  };

  const handleSaveConfirm = () => {
    setShowSaveConfirmation(false);
    performSave();
  };

  const handleSaveCancel = () => {
    setShowSaveConfirmation(false);
  };

  return (
    <div className="flex items-center justify-center">
      <style>
        {`
          /* Prevent zoom on input focus for mobile */
          input, textarea, [contenteditable] {
            font-size: 16px !important;
          }
          /* Ensure content is visible while typing */
          [contenteditable] {
            min-height: 200px;
            max-height: 60vh;
            overflow-y: auto;
          }
        `}
      </style>
      <div className="relative w-full max-w-xs sm:max-w-sm md:max-w-md lg:max-w-lg xl:max-w-xl mx-1 sm:mx-2">
        <div
          className={`rounded-xl p-2 sm:p-3 md:p-6 backdrop-blur-lg border shadow-[0_0_15px_rgba(79,70,229,0.3)] hover:shadow-[0_0_20px_rgba(79,70,229,0.5)] transition-all duration-300 ease-in-out md:transform md:hover:scale-105 ${
            theme === "Light"
              ? "bg-gradient-to-br from-white/90 via-purple-50/90 to-indigo-50/90 border-purple-200/50"
              : "bg-gradient-to-br from-indigo-900/80 via-indigo-800/80 to-purple-700/80 border-indigo-500/50"
          }`}
        >
          <h2 className="text-base sm:text-lg font-semibold text-gold-100 mb-1 sm:mb-2 text-center tracking-tight text-shadow-md">
            {translatedStrings.createNewNote}
          </h2>
          <div className="space-y-2 sm:space-y-3">
            <div>
              <label
                htmlFor="title"
                className="block text-sm font-medium text-gray-200 mb-1"
              >
                {translatedStrings.noteTitle}
              </label>
              <input
                id="title"
                type="text"
                placeholder={translatedStrings.enterNoteTitle}
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full p-2 bg-indigo-950/80 border border-indigo-700/50 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-indigo-400 transition-all duration-200 hover:shadow-[inset_0_0_10px_rgba(79,70,229,0.2)]"
                aria-required="true"
              />
            </div>
            <div>
              <label
                htmlFor="content"
                className="block text-sm font-medium text-gray-200 mb-1"
              >
                {translatedStrings.noteContent}
              </label>
              <div className="flex items-center justify-between mb-2">
                <select
                  value={template}
                  onChange={(e) => setTemplate(e.target.value)}
                  className="p-1 bg-indigo-950/80 border border-indigo-700/50 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-indigo-400 transition-all duration-200 hover:shadow-[0_0_5px_rgba(79,70,229,0.3)]"
                  aria-label="Select note template"
                >
                  <option value="Auto">{translatedStrings.auto}</option>
                  <option value="To-Do List">
                    {translatedStrings.toDoList}
                  </option>
                  <option value="List">{translatedStrings.list}</option>
                  <option value="Canvas">{translatedStrings.canvas}</option>
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
                    aria-label={translatedStrings.attachFiles}
                  />
                </label>
              </div>
              {/* Formatting Toolbar - only for create mode (not editing) */}
              {!isEditing && (mode === "cloud" || mode === "db") && (
                <div className="flex flex-wrap gap-1 mb-1 p-1 bg-indigo-900/30 rounded border border-indigo-700/30">
                  <button
                    onClick={insertBulletList}
                    className={`px-2 py-1 text-white text-xs rounded transition-colors ${
                      isListActive
                        ? "bg-gradient-to-r from-cyan-500 to-blue-700 shadow-[0_0_10px_rgba(6,182,212,0.5)]"
                        : "bg-indigo-700/50 hover:bg-indigo-600/50"
                    }`}
                    title={translatedStrings.insertBulletList}
                  >
                    {translatedStrings.listButton}
                  </button>
                  <button
                    onClick={insertBold}
                    className={`px-2 py-1 text-white text-xs rounded font-bold transition-colors ${
                      isBoldActive
                        ? "bg-gradient-to-r from-cyan-500 to-blue-700 shadow-[0_0_10px_rgba(6,182,212,0.5)]"
                        : "bg-indigo-700/50 hover:bg-indigo-600/50"
                    }`}
                    title={translatedStrings.boldText}
                  >
                    {translatedStrings.boldButton}
                  </button>
                  <button
                    onClick={insertItalic}
                    className={`px-2 py-1 text-white text-xs rounded italic transition-colors ${
                      isItalicActive
                        ? "bg-gradient-to-r from-cyan-500 to-blue-700 shadow-[0_0_10px_rgba(6,182,212,0.5)]"
                        : "bg-indigo-700/50 hover:bg-indigo-600/50"
                    }`}
                    title={translatedStrings.italicText}
                  >
                    {translatedStrings.italicButton}
                  </button>
                  <button
                    onClick={insertLargeText}
                    className="px-2 py-1 bg-indigo-700/50 hover:bg-indigo-600/50 text-white text-xs rounded transition-colors"
                    title={translatedStrings.largeHeadingTitle}
                  >
                    H1
                  </button>
                </div>
              )}
              <div
                className="relative overflow-y-auto"
                style={{
                  maxHeight: template === "Canvas" ? "250px" : "200px",
                  minHeight: template === "Canvas" ? "250px" : "200px",
                }}
              >
                {!isEditing ? (
                  <ContentEditable
                    html={htmlContent}
                    onChange={handleHtmlContentChange}
                    className={`${getTextareaClass()} w-full z-10 resize-none`}
                    style={{
                      color: "white",
                      backgroundColor: "rgba(79, 70, 229, 0.1)",
                      WebkitTextFillColor: "white",
                      minHeight: template === "Canvas" ? "250px" : "200px",
                      outline: "none",
                      padding: "1rem",
                      overflowY: "visible",
                    }}
                    data-placeholder={getPlaceholderText()}
                    aria-required="true"
                  />
                ) : (
                  <textarea
                    ref={textareaRef}
                    value={content}
                    onChange={handleContentChange}
                    placeholder={getPlaceholderText()}
                    className={`${getTextareaClass()} w-full z-10`}
                    style={{
                      minHeight: template === "Canvas" ? "250px" : "200px",
                      padding: "1rem",
                    }}
                    aria-required="true"
                  />
                )}
              </div>
              {files.length > 0 && (
                <p className="text-xs text-gray-400 mt-2">
                  {files.length} file(s) selected
                </p>
              )}
            </div>
            <div className="flex justify-end space-x-2">
              <button
                onClick={onCancel}
                className="px-2 py-1 bg-gray-700/80 text-white rounded text-sm"
                aria-label="Cancel note creation"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                className="px-3 py-2 bg-gradient-to-r from-cyan-500 to-blue-700 text-white font-bold rounded-full text-sm"
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
        className="absolute bottom-4 right-4 cursor-pointer transition-all duration-300 ease-out md:hover:scale-110"
        onClick={() => setShowAIPopup(!showAIPopup)}
      >
        <div className="w-14 h-14 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-full flex items-center justify-center shadow-lg hover:shadow-xl transition-shadow duration-300 border-2 border-gold-400/50 animate-pulse relative overflow-hidden">
          {/* Custom Elephant Logo Image */}
          <img
            src={elysiumLogo}
            alt="Elysium AI Elephant"
            className="w-10 h-10 rounded-full object-cover object-center"
            style={{
              transform: "scale(1.2)",
              transformOrigin: "center",
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
                <h4 className="text-gold-100 font-medium text-sm">
                  💬 Ask AI:
                </h4>
                <div className="flex space-x-2">
                  <input
                    type="text"
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    onKeyPress={(e) => e.key === "Enter" && handleChatSubmit()}
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
                  <h4 className="text-gold-100 font-medium text-sm">
                    💬 Conversation:
                  </h4>
                  <div className="max-h-48 overflow-y-auto space-y-2">
                    {messageHistory.map((message, index) => (
                      <div
                        key={index}
                        className={`rounded p-2 text-xs ${
                          message.type === "user"
                            ? "bg-indigo-600/30 border-l-2 border-indigo-400"
                            : "bg-purple-600/30 border-l-2 border-purple-400"
                        }`}
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <span className="text-gold-100 font-medium text-xs">
                              {message.type === "user" ? "👤 You:" : "🤖 AI:"}
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
                    <div ref={messagesEndRef} />{" "}
                    {/* Invisible element for auto-scrolling */}
                  </div>
                </div>
              )}

              {/* Latest AI Response */}
              {aiSuggestions.length > 0 && messageHistory.length === 0 && (
                <div className="space-y-2">
                  <h4 className="text-gold-100 font-medium text-sm">
                    💡 Latest Response:
                  </h4>
                  <div className="bg-purple-600/30 border border-purple-400/50 rounded p-3 text-xs">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <span className="text-gold-100 font-medium text-xs">
                          🤖 AI:
                        </span>
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

      <SaveConfirmationPopup
        isOpen={showSaveConfirmation}
        onConfirm={handleSaveConfirm}
        onCancel={handleSaveCancel}
        theme={theme}
        message={saveConfirmationMessage}
      />
    </div>
  );
};

export default CreateNote;
