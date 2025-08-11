import React, { useState, useEffect } from "react";
import { animated, useSpring } from "react-spring";
import { WalletAdapterNetwork } from "@solana/wallet-adapter-base";
import {
  ConnectionProvider,
  WalletProvider,
  useWallet,
} from "@solana/wallet-adapter-react";
import {
  WalletModalProvider,
  useWalletModal,
} from "@solana/wallet-adapter-react-ui";
import { useMemo } from "react";
import { clusterApiUrl } from "@solana/web3.js";
import { ReactComponent as ElysiumLogo } from "./components/ElysiumLogo.svg";
import Drawer from "./components/Drawer";
import CreateNote from "./components/CreateNote";
import Settings from "./components/Settings";
import Logout from "./components/Logout";

interface Note {
  id: number;
  title: string;
  content: string;
  template: string;
}

const network = WalletAdapterNetwork.Mainnet;
const endpoint = clusterApiUrl(network);

function App() {
  const wallets = useMemo(() => [], []);

  return (
    <ConnectionProvider endpoint={endpoint}>
      <WalletProvider wallets={wallets} autoConnect>
        <WalletModalProvider>
          <WelcomePage />
        </WalletModalProvider>
      </WalletProvider>
    </ConnectionProvider>
  );
}

// Child component for welcome page
function WelcomePage() {
  const { connected, publicKey, disconnect, wallets } = useWallet();
  const { setVisible } = useWalletModal();
  const [hasBeenConnected, setHasBeenConnected] = useState(false);
  const [showPopup, setShowPopup] = useState(false);
  const [notes, setNotes] = useState<Note[]>([
    {
      id: 1,
      title: "Meeting Notes 08/07/2025",
      content:
        "Discuss project timeline...\n- [ ] Prepare agenda\n- [ ] Assign tasks\n- [ ] Review progress",
      template: "To-Do List",
    },
    {
      id: 2,
      title: "Ideas",
      content:
        "Brainstorm new features for Elysium...\n- [ ] Add folder support\n- [ ] Enhance templates\n- [ ] Improve UI",
      template: "Checklist",
    },
  ]);
  const [activePage, setActivePage] = useState<
    "recent" | "create" | "settings" | "logout"
  >("recent");
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [files, setFiles] = useState<File[]>([]);

  const logoSpring = useSpring({
    from: { opacity: 0, transform: "scale(0.8)" },
    to: { opacity: 1, transform: "scale(1)" },
    delay: 200,
  });
  const titleSpring = useSpring({
    from: { opacity: 0, transform: "translateY(-20px)" },
    to: { opacity: 1, transform: "translateY(0)" },
    delay: 400,
  });
  const buttonSpring = useSpring({
    from: { opacity: 0, transform: "scale(0.9)" },
    to: { opacity: 1, transform: "scale(1)" },
    delay: 600,
  });
  const noteSpring = useSpring({
    from: { opacity: 0, transform: "translateY(20px)" },
    to: { opacity: 1, transform: "translateY(0)" },
    delay: 200,
  });

  const handleSelectWallet = () => {
    setVisible(true); // Opens the wallet selection modal
  };

  const handleWalletAction = () => {
    if (connected && publicKey) {
      setShowPopup(true); // Show popup for wallet switch or logout
    } else {
      setVisible(true); // Opens modal to select/change wallet
    }
  };

  const handleSwitchWallet = () => {
    if (connected) {
      setVisible(true); // Trigger wallet selection modal for switching
      setShowPopup(false); // Close popup after selection
    }
  };

  const handleLogout = () => {
    if (connected && disconnect) {
      disconnect(); // Confirm logout with wallet disconnect
      setShowPopup(false); // Close popup after logout
    }
  };

  const handleLogoButton = () => {
    alert(
      "You are amazing. Use the Drawer on the left to navigate and the button on the right to log out."
    );
  };

  const handleCreateNote = (note: {
    title: string;
    content: string;
    template: string;
    files: File[];
  }) => {
    if (note.title && note.content) {
      setNotes([
        ...notes,
        {
          id: Date.now(),
          title: note.title,
          content: note.content,
          template: note.template,
        },
      ]);
      setFiles(note.files);
      setShowCreateModal(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) setFiles(Array.from(e.target.files));
  };

  const handlePageChange = (
    page: "recent" | "create" | "settings" | "logout"
  ) => {
    setActivePage(page);
  };

  useEffect(() => {
    if (connected) {
      setHasBeenConnected(true);
    } else if (hasBeenConnected && !connected) {
      window.location.reload(); // Reload to login screen on disconnect
    }
  }, [connected, hasBeenConnected]);

  const shortenedAddress = publicKey
    ? `${publicKey.toBase58().slice(0, 4)}...${publicKey.toBase58().slice(-4)}`
    : "";

  const renderList = (
    noteId: number,
    content: string,
    template: string,
    notes: Note[],
    setNotes: React.Dispatch<React.SetStateAction<Note[]>>
  ) => {
    const lines = content.split("\n");
    const items = lines.map((line, index) => {
      const trimmed = line.trim();
      if (trimmed.startsWith("-") || trimmed.startsWith(".")) {
        let itemText = trimmed.slice(1).trim();
        let isChecked = false;
        let timestamp = "";
        let isDone = false;

        if (itemText.startsWith("[x]") || itemText.startsWith("[X]")) {
          isChecked = true;
          isDone = true;
          itemText = itemText.slice(3).trim();
          timestamp = new Date().toISOString();
        } else if (itemText.startsWith("[ ]")) {
          itemText = itemText.slice(3).trim();
        }

        return {
          id: index,
          text: itemText,
          checked: isChecked,
          timestamp,
          isDone,
        };
      }
      return {
        id: index,
        text: line,
        checked: false,
        timestamp: "",
        isDone: false,
      };
    });

    const handleToggleCheck = (
      noteId: number,
      index: number,
      checked: boolean
    ) => {
      const updatedNotes = notes.map((n: Note) => {
        if (n.id === noteId) {
          const updatedLines = n.content.split("\n").map((line, i) => {
            if (i === index) {
              const prefix =
                line.trim().startsWith("-") || line.trim().startsWith(".")
                  ? line.slice(0, line.indexOf(line.trim()[0]) + 1)
                  : "";
              const timestamp = checked
                ? ` (Done at ${new Date().toISOString()})`
                : "";
              return `${prefix} [${checked ? "x" : " "}] ${
                items[index].text
              }${timestamp}`;
            }
            return line;
          });
          return { ...n, content: updatedLines.join("\n") };
        }
        return n;
      });
      setNotes(updatedNotes);
    };

    const handleRemoveItem = (noteId: number, index: number) => {
      const updatedNotes = notes.map((n: Note) => {
        if (n.id === noteId && !items[index].isDone) {
          const updatedLines = n.content
            .split("\n")
            .filter((_, i) => i !== index);
          return { ...n, content: updatedLines.join("\n") };
        }
        return n;
      });
      setNotes(updatedNotes);
    };

    return items.map((item) => (
      <div key={item.id} className="flex items-center mb-2">
        {(item.text.trim() ||
          template === "To-Do List" ||
          template === "Checklist" ||
          template === "List") && (
          <>
            <input
              type="checkbox"
              checked={item.checked}
              onChange={(e) =>
                handleToggleCheck(noteId, item.id, e.target.checked)
              }
              className="mr-2 h-5 w-5 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded transition-colors duration-200"
            />
            <span
              className={`text-silver-200 flex-1 ${
                item.checked ? "line-through text-gray-500" : ""
              }`}
            >
              {item.text}
            </span>
            {(template === "Checklist" || template === "List") &&
              !item.isDone && (
                <button
                  onClick={() => handleRemoveItem(noteId, item.id)}
                  className="ml-2 text-red-400 hover:text-red-300 transition-colors duration-200"
                >
                  Remove
                </button>
              )}
            {item.checked && item.timestamp && (
              <span className="text-gray-500 text-sm ml-2">
                {item.timestamp}
              </span>
            )}
          </>
        )}
        {template !== "To-Do List" &&
          template !== "Checklist" &&
          template !== "List" && (
            <span className="text-silver-200 flex-1">{item.text}</span>
          )}
      </div>
    ));
  };

  return (
    <>
      {!connected ? (
        <div className="min-h-screen h-screen flex flex-col items-center justify-center bg-gradient-to-br from-purple-900 via-indigo-900 to-black text-white relative overflow-hidden">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(255,255,255,0.1)_0%,transparent_50%)] pointer-events-none"></div>
          <animated.div style={logoSpring}>
            <ElysiumLogo className="mb-6 w-24 h-24" />
          </animated.div>
          <animated.h1
            style={titleSpring}
            className="text-5xl font-extrabold tracking-wide mb-2 text-gold-100"
          >
            Welcome to Elysium
          </animated.h1>
          <animated.p
            style={titleSpring}
            className="text-xl italic mb-6 max-w-md text-center text-silver-200"
          >
            Unlock Your Eternal Notes in a Decentralized Realm
          </animated.p>
          <animated.div style={buttonSpring}>
            <button
              onClick={handleSelectWallet}
              className="bg-gradient-to-r from-blue-600 to-purple-700 hover:from-blue-700 hover:to-purple-800 text-white font-bold py-3 px-8 rounded-full shadow-xl transition-all duration-300"
            >
              Select SOL Wallet
            </button>
          </animated.div>
        </div>
      ) : (
        <div className="min-h-screen h-screen flex flex-col bg-gradient-to-br from-purple-900 via-indigo-900 to-black text-white relative overflow-hidden">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(255,255,255,0.05)_0%,transparent_70%)] pointer-events-none"></div>
          <Drawer onNavigate={handlePageChange} />
          <button onClick={handleLogoButton}>
            <div className="fixed top-6 left-1/2 transform -translate-x-1/2 z-40">
              <ElysiumLogo className="w-16 h-16" />
            </div>
          </button>
          <header className="w-full p-4 flex justify-end absolute top-0 left-0">
            <button
              onClick={handleWalletAction}
              className="bg-gradient-to-r from-purple-600 to-blue-700 hover:from-purple-700 hover:to-blue-800 text-white font-bold py-2 px-6 rounded-full shadow-xl transition-all duration-300"
            >
              {shortenedAddress}
            </button>
          </header>

          {/* Popup for wallet switch and logout */}
          {showPopup && (
            <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50">
              <div className="bg-gradient-to-br from-purple-900 via-indigo-900 to-black p-6 rounded-lg shadow-2xl text-white w-80 transform transition-all duration-300 ease-in-out">
                <h3 className="text-lg font-semibold mb-4 border-b border-indigo-700 pb-2 text-gold-100">
                  Wallet Options
                </h3>
                <button
                  onClick={handleLogout}
                  className="w-full bg-red-800 bg-opacity-70 hover:bg-opacity-90 text-white font-semibold py-2 px-4 rounded-lg shadow-md transition-all duration-200 mt-4"
                >
                  Logout
                </button>
              </div>
            </div>
          )}

          <div
            className="flex flex-col items-center justify-start flex-1 mt-20 overflow-y-auto"
            style={{
              scrollbarWidth: "thin",
              scrollbarColor: "#4B0082 #1A202C",
            }}
          >
            <style>
              {`
                /* Webkit browsers (Chrome, Safari) */
                .overflow-y-auto::-webkit-scrollbar {
                  width: 12px;
                }
                .overflow-y-auto::-webkit-scrollbar-track {
                  background: url('data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24"><path fill="%234B0082" d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm-1-13h2v6h-2zm0 8h2v2h-2z"/></svg>') repeat-y center, #1A202C;
                  background-size: 20px;
                }
                .overflow-y-auto::-webkit-scrollbar-thumb {
                  background: linear-gradient(45deg, #4B0082, #6A0DAD);
                  border-radius: 6px;
                  border: 2px solid #1A202C;
                }
                .overflow-y-auto::-webkit-scrollbar-thumb:hover {
                  background: linear-gradient(45deg, #6A0DAD, #9370DB);
                }
              `}
            </style>
            <div className="w-full p-6">
              {activePage === "recent" && (
                <>
                  <h1 className="text-5xl font-extrabold mb-8 text-gold-100">
                    Recent Notes
                  </h1>
                  <button
                    onClick={() => setShowCreateModal(true)}
                    className="bg-gradient-to-r from-blue-600 to-purple-700 hover:from-blue-700 hover:to-purple-800 text-white font-bold py-3 px-8 rounded-full shadow-xl mb-8 transition-all duration-300"
                  >
                    Create Note
                  </button>
                  {notes.length > 0 ? (
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                      {notes.map((note: Note) => (
                        <animated.div
                          key={note.id}
                          style={noteSpring}
                          className="bg-gradient-to-br from-indigo-800 to-indigo-700 p-6 rounded-lg shadow-2xl flex flex-col justify-between"
                        >
                          <div>
                            <h2 className="text-2xl font-semibold text-gold-100 mb-4">
                              {note.title}
                            </h2>
                            {renderList(
                              note.id,
                              note.content,
                              note.template,
                              notes,
                              setNotes
                            )}
                          </div>
                          <div className="mt-4 text-right">
                            <button
                              onClick={() => {
                                setNotes(notes.filter((n) => n.id !== note.id));
                              }}
                              className="text-red-400 hover:text-red-300 transition-colors duration-200"
                              disabled={notes.some(
                                (n) =>
                                  n.id === note.id && n.content.includes("[x]")
                              )}
                            >
                              Delete
                            </button>
                          </div>
                        </animated.div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-center text-gray-400 flex items-center justify-center h-64">
                      No notes yet—create one to get started!
                    </p>
                  )}
                </>
              )}
              {activePage === "create" && (
                <CreateNote
                  onSave={handleCreateNote}
                  onCancel={() => setShowCreateModal(false)}
                />
              )}
              {activePage === "settings" && <Settings />}
              {activePage === "logout" && (
                <Logout
                  onConfirm={handleLogout}
                  onCancel={() => setShowPopup(false)}
                />
              )}
            </div>

            {showCreateModal && (
              <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50">
                <div className="w-[32rem] max-w-full">
                  <CreateNote
                    onSave={handleCreateNote}
                    onCancel={() => setShowCreateModal(false)}
                  />
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}

export default App;
