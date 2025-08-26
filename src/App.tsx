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
import { Connection, PublicKey, SystemProgram } from "@solana/web3.js";
import { clusterApiUrl } from "@solana/web3.js";
import { AnchorProvider, Program, Idl, BN } from "@coral-xyz/anchor";
import { useAnchorWallet } from "@solana/wallet-adapter-react";
import { ReactComponent as ElysiumLogo } from "./components/ElysiumLogo.svg";
import Drawer from "./components/Drawer";
import CreateNote from "./components/CreateNote";
import Settings from "./components/Settings";
import Logout from "./components/Logout";
import { encryptAndCompress, decryptNote } from "./utils/crypto";
import { uploadToArweave, setWallet } from "./utils/arweave-utils";
import idlJson from "./idl.json";

interface Note {
  id: number;
  title: string;
  content: string;
  template: string;
  encryptedContent?: Uint8Array;
  nonce?: Uint8Array;
  arweaveHash?: string;
  isPermanent?: boolean;
  completionTimestamps?: { [taskIndex: number]: string };
}

const network = WalletAdapterNetwork.Devnet;
const endpoint = clusterApiUrl(network);
const connection = new Connection(endpoint, "confirmed");
const programId = new PublicKey(idlJson.address);
const idl = idlJson as Idl;

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

function getDefaultNotes(mode: "web3" | "db" | "cloud"): Note[] {
  if (mode === "db") {
    return [
      {
        id: 1,
        title: "Database Schema Notes",
        content:
          "Plan database structure...\n- [ ] Define tables\n- [ ] Set up indexes\n- [ ] Test queries",
        template: "To-Do List",
        isPermanent: false,
        completionTimestamps: {},
      },
    ];
  } else if (mode === "cloud") {
    return [
      {
        id: 1,
        title: "Cloud Sync Notes",
        content:
          "Configure cloud storage...\n- [ ] Set up S3 bucket\n- [ ] Enable versioning\n- [ ] Test sync",
        template: "Checklist",
        isPermanent: false,
        completionTimestamps: {},
      },
    ];
  } else {
    return [
      {
        id: 1,
        title: "Meeting Notes 08/07/2025",
        content:
          "Discuss project timeline...\n- [ ] Prepare agenda\n- [ ] Assign tasks\n- [ ] Review progress",
        template: "To-Do List",
        isPermanent: false,
        completionTimestamps: {},
      },
      {
        id: 2,
        title: "Ideas",
        content:
          "Brainstorm new features for Elysium...\n- [ ] Add folder support\n- [ ] Enhance templates\n- [ ] Improve UI",
        template: "Checklist",
        isPermanent: false,
        completionTimestamps: {},
      },
    ];
  }
}

function WelcomePage() {
  const { connected, publicKey, sendTransaction, disconnect } = useWallet();
  const { setVisible } = useWalletModal();
  const anchorWallet = useAnchorWallet();
  const [hasBeenConnected, setHasBeenConnected] = useState(false);
  const [showPopup, setShowPopup] = useState(false);

  // Initialize selectedMode from localStorage to persist across refreshes
  const [selectedMode, setSelectedMode] = useState<
    null | "web3" | "db" | "cloud"
  >(() => {
    const savedMode = localStorage.getItem("elysium_selected_mode");
    return savedMode ? (savedMode as "web3" | "db" | "cloud") : null;
  });

  const [mode, setMode] = useState<"web3" | "db" | "cloud">(() => {
    const savedMode = localStorage.getItem("elysium_selected_mode");
    return savedMode ? (savedMode as "web3" | "db" | "cloud") : "web3";
  });

  // Initialize notes to empty array; will be set in useEffect
  const [notes, setNotes] = useState<Note[]>([]);

  const [activePage, setActivePage] = useState<
    "recent" | "create" | "settings" | "logout"
  >("recent");
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [files, setFiles] = useState<File[]>([]);
  const [isCloudButtonClicked, setIsCloudButtonClicked] = useState(false);

  const mainMenuGif =
    "https://media4.giphy.com/media/v1.Y2lkPTc5MGI3NjExaDF1NzNmZmlkaGd6cXRtem42ZXptMmV6cHQwMXVobWY5eWdrazU0eCZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/ewwd4xlxeSrM4aDDpL/giphy.gif";
  const databaseGif =
    "https://media0.giphy.com/media/v1.Y2lkPTc5MGI3NjExMW1zNzFweGtiNHNvb2w2c2g2bWYxd3ZycTBwYTljNWtlcnMzMHZvaCZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/JczfG7NXSdysQHxgxr/giphy.gif";
  const cloudGif =
    "https://media3.giphy.com/media/v1.Y2lkPTc5MGI3NjExcHBxaW54cXo0YjB0MzNvZjJicnI3aWt4dTZrMWlrNmZwaWQ1bnpkcyZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/l3q2TTmsHJ8SayhLa/giphy.gif";
  const blockchainGif =
    "https://media3.giphy.com/media/v1.Y2lkPTc5MGI3NjExdnRjbDFqaDgzOWF4eXJ0YTNjOXRsNmN3Z2V5ZjhpbmNhbDZkZHEydiZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/3oFzmrqRPhYnFg9oGs/giphy.gif";

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

  const blockchainPageSpring = useSpring({
    from: { opacity: 0, transform: "scale(0.95)" },
    to: { opacity: 1, transform: "scale(1)" },
    delay: 200,
    reset: mode === "web3",
  });

  const handleSelectWallet = () => {
    setVisible(true);
  };

  const handleWalletAction = () => {
    if (connected && publicKey) {
      setShowPopup(true);
    } else {
      setVisible(true);
    }
  };

  const handleLogout = () => {
    if (connected && disconnect) {
      disconnect();
    }
    setShowPopup(false);
    setSelectedMode(null); // Redirect to main menu
    setMode("web3"); // Reset mode
    setActivePage("recent"); // Ensure navigation to Recent Notes
    localStorage.removeItem("elysium_selected_mode"); // Clear persisted mode
  };

  const handleLogoButton = () => {
    setActivePage("recent"); // Navigate to Recent Notes page of current mode
  };

  const handleExitToMainMenu = () => {
    setSelectedMode(null); // Return to main menu
    setActivePage("recent"); // Reset page
    setNotes([]); // Clear notes to prevent leakage
  };

  const saveToBlockchain = async (note: Note) => {
    if (mode !== "web3" || !publicKey || !sendTransaction || !anchorWallet) {
      return;
    }
    try {
      const provider = new AnchorProvider(connection, anchorWallet, {});
      const program = new Program(idl, provider);
      const dataStr = JSON.stringify({
        title: note.title,
        content: note.content,
        template: note.template,
        completionTimestamps: note.completionTimestamps,
      });
      const { encrypted, nonce } = encryptAndCompress(
        dataStr,
        publicKey.toBytes()
      );
      const uploadData = new Uint8Array(nonce.length + encrypted.length);
      uploadData.set(nonce);
      uploadData.set(encrypted, nonce.length);
      const arweaveHash = await uploadToArweave(uploadData);
      console.log("Arweave content saved, hash:", arweaveHash);
      const [noteAccountPDA] = await PublicKey.findProgramAddress(
        [
          Buffer.from("note"),
          publicKey.toBuffer(),
          Buffer.from(BigInt(note.id).toString(16).padStart(16, "0"), "hex"),
        ],
        programId
      );
      await program.methods
        .initializeNote(new BN(note.id), arweaveHash, new BN(Date.now()))
        .accounts({
          noteAccount: noteAccountPDA,
          user: publicKey,
          systemProgram: SystemProgram.programId,
        })
        .rpc();
      if (
        window.confirm("Make this note permanent? (Additional fee may apply)")
      ) {
        await program.methods
          .setPermanent(new BN(note.id))
          .accounts({
            noteAccount: noteAccountPDA,
            user: publicKey,
          })
          .rpc();
        setNotes(
          notes.map((n) =>
            n.id === note.id ? { ...n, arweaveHash, isPermanent: true } : n
          )
        );
      } else {
        setNotes(
          notes.map((n) =>
            n.id === note.id ? { ...n, arweaveHash, isPermanent: false } : n
          )
        );
      }
    } catch (error) {
      console.error("Blockchain save failed:", error);
      alert(
        "Failed to save to blockchain. Please try again or check your wallet."
      );
    }
  };

  const handleCreateNote = async (note: {
    title: string;
    content: string;
    template: string;
    files: File[];
  }) => {
    if (note.title && note.content) {
      let newNote: Note;
      if (mode === "web3" && publicKey) {
        const { encrypted, nonce } = encryptAndCompress(
          JSON.stringify({
            title: note.title,
            content: note.content,
            template: note.template,
            completionTimestamps: {},
          }),
          publicKey.toBytes()
        );
        newNote = {
          id: Date.now(),
          title: note.title,
          content: note.content,
          template: note.template,
          encryptedContent: encrypted,
          nonce: nonce,
          isPermanent: false,
          completionTimestamps: {},
        };
        await saveToBlockchain(newNote);
      } else {
        newNote = {
          id: Date.now(),
          title: note.title,
          content: note.content,
          template: note.template,
          isPermanent: false,
          completionTimestamps: {},
        };
      }
      setNotes([...notes, newNote]);
      setFiles(note.files);
      setShowCreateModal(false);
      setActivePage("recent"); // Navigate back to Recent Notes
      if (mode === "db" || mode === "cloud") {
        localStorage.setItem(
          `elysium_notes_${mode}`,
          JSON.stringify([...notes, newNote])
        );
      }
      setIsCloudButtonClicked(false); // Reset cloud button state
    } else if (mode === "web3") {
      alert("Please connect your wallet to create a note.");
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

  const loadFromBlockchain = async () => {
    if (!publicKey || !anchorWallet) return;
    const provider = new AnchorProvider(connection, anchorWallet, {});
    const program = new Program(idl, provider);
    try {
      const noteAccounts = await (program.account as any).NoteAccount.all([
        {
          memcmp: {
            offset: 8,
            bytes: publicKey.toBase58(),
          },
        },
      ]);
      const fetchedNotes: Note[] = [];
      for (const account of noteAccounts) {
        const note = account.account;
        const noteId = Number(note.noteId);
        if (note.arweaveHash) {
          try {
            const response = await fetch(
              `https://arweave.net/${note.arweaveHash}`
            );
            const data = await response.arrayBuffer();
            const buffer = new Uint8Array(data);
            const nonceLength = 24; // Matches tweetnacl.box.nonceLength
            const nonce = buffer.slice(0, nonceLength);
            const encrypted = buffer.slice(nonceLength);
            const decrypted = decryptNote(
              encrypted,
              publicKey.toBytes(),
              nonce
            );
            const parsed = JSON.parse(decrypted);
            fetchedNotes.push({
              id: noteId,
              title: parsed.title,
              content: parsed.content,
              template: parsed.template,
              completionTimestamps: parsed.completionTimestamps || {},
              arweaveHash: note.arweaveHash,
              isPermanent: note.isPermanent,
            });
          } catch (e) {
            console.error("Failed to fetch or decrypt note", e);
          }
        } else {
          fetchedNotes.push({
            id: noteId,
            title: "Untitled",
            content: "No content",
            template: "List",
            isPermanent: note.isPermanent,
            completionTimestamps: {},
          });
        }
      }
      setNotes(fetchedNotes);
    } catch (error) {
      console.error("Failed to load notes from blockchain:", error);
    }
  };

  useEffect(() => {
    if (selectedMode) {
      setMode(selectedMode);
      localStorage.setItem("elysium_selected_mode", selectedMode);
      setActivePage("recent"); // Navigate to Recent Notes on mode selection
    }
  }, [selectedMode]);

  useEffect(() => {
    if (mode !== "web3") {
      const stored = localStorage.getItem(`elysium_notes_${mode}`);
      setNotes(stored ? JSON.parse(stored) : getDefaultNotes(mode));
    } else {
      setNotes(getDefaultNotes(mode));
    }
  }, [mode]);

  useEffect(() => {
    if (mode !== "web3") {
      localStorage.setItem(`elysium_notes_${mode}`, JSON.stringify(notes));
    }
  }, [notes, mode]);

  useEffect(() => {
    if (connected && mode === "web3") {
      loadFromBlockchain();
      setHasBeenConnected(true);
      setWallet({} as any); // Temporary; replace with proper wallet integration
    } else if (hasBeenConnected && !connected && mode === "web3") {
      setSelectedMode(null);
      setMode("web3");
      setActivePage("recent");
      localStorage.removeItem("elysium_selected_mode");
    }
    const syncInterval = setInterval(() => {
      console.log("Syncing notes...", notes);
    }, 15 * 60 * 1000);
    return () => clearInterval(syncInterval);
  }, [connected, hasBeenConnected, notes, publicKey, mode, anchorWallet]);

  const shortenedAddress = publicKey
    ? `${publicKey.toBase58().slice(0, 4)}...${publicKey.toBase58().slice(-4)}`
    : "";

  const renderList = (
    noteId: number,
    content: string,
    template: string,
    notes: Note[],
    setNotes: React.Dispatch<React.SetStateAction<Note[]>>,
    isPermanent: boolean
  ) => {
    const lines = content.split("\n");
    const items = lines.map((line, index) => {
      const trimmed = line.trim();
      let itemText = trimmed;
      let isChecked = false;
      let timestamp =
        notes.find((n) => n.id === noteId)?.completionTimestamps?.[index] || "";
      if (trimmed.startsWith("-") || trimmed.startsWith(".")) {
        itemText = trimmed.slice(1).trim();
        if (itemText.startsWith("[x]") || itemText.startsWith("[X]")) {
          isChecked = true;
          itemText = itemText
            .slice(3)
            .trim()
            .replace(/\(Done at .*\)/, "");
        } else if (itemText.startsWith("[ ]")) {
          itemText = itemText.slice(3).trim();
        }
      }
      const handleToggleCheck = () => {
        if (!isChecked && (mode !== "web3" || publicKey)) {
          const newTimestamp = new Date().toISOString();
          const updatedNotes = notes.map((n) =>
            n.id === noteId
              ? {
                  ...n,
                  completionTimestamps: {
                    ...n.completionTimestamps,
                    [index]: newTimestamp,
                  },
                  content: n.content
                    .split("\n")
                    .map((l, i) =>
                      i === index
                        ? `${
                            trimmed.startsWith("-") || trimmed.startsWith(".")
                              ? trimmed[0]
                              : ""
                          } [x] ${itemText} (Done at ${newTimestamp})`
                        : l
                    )
                    .join("\n"),
                }
              : n
          );
          setNotes(updatedNotes);
          if (mode !== "web3") {
            localStorage.setItem(
              `elysium_notes_${mode}`,
              JSON.stringify(updatedNotes)
            );
          }
        }
      };
      const handleRemoveItem = () => {
        if (!isChecked && (mode !== "web3" || publicKey)) {
          const newTimestamp = new Date().toISOString();
          const updatedNotes = notes.map((n) =>
            n.id === noteId
              ? {
                  ...n,
                  completionTimestamps: {
                    ...n.completionTimestamps,
                    [index]: newTimestamp,
                  },
                  content: n.content
                    .split("\n")
                    .map((l, i) =>
                      i === index
                        ? `${
                            trimmed.startsWith("-") || trimmed.startsWith(".")
                              ? trimmed[0]
                              : ""
                          } [x] ${itemText} (Done at ${newTimestamp})`
                        : l
                    )
                    .join("\n"),
                }
              : n
          );
          setNotes(updatedNotes);
          if (mode !== "web3") {
            localStorage.setItem(
              `elysium_notes_${mode}`,
              JSON.stringify(updatedNotes)
            );
          }
        }
      };
      return (
        <div key={index} className="flex items-center mb-2">
          {(itemText.trim() ||
            template === "To-Do List" ||
            template === "Checklist" ||
            template === "List") && (
            <>
              <input
                type="checkbox"
                checked={isChecked}
                onChange={handleToggleCheck}
                className="mr-2 h-6 w-6 md:h-5 md:w-5 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded transition-colors duration-200"
                disabled={isChecked || isPermanent}
              />
              <span
                className={`text-silver-200 flex-1 text-base md:text-sm ${
                  isChecked ? "line-through text-gray-500" : ""
                }`}
              >
                {itemText}{" "}
                {timestamp && (
                  <span className="text-gray-500 text-xs md:text-sm ml-2">
                    {timestamp}
                  </span>
                )}
              </span>
              {(template === "Checklist" || template === "List") &&
                !isChecked &&
                !isPermanent && (
                  <button
                    onClick={handleRemoveItem}
                    className="ml-2 text-red-400 hover:text-red-300 transition-colors duration-200 text-sm md:text-base"
                  >
                    Remove
                  </button>
                )}
            </>
          )}
          {template !== "To-Do List" &&
            template !== "Checklist" &&
            template !== "List" && (
              <span className="text-silver-200 flex-1 text-base md:text-sm">
                {itemText}
              </span>
            )}
        </div>
      );
    });
    return items;
  };

  const isLoggedIn = connected || mode !== "web3";

  if (!selectedMode) {
    return (
      <div
        className="min-h-screen h-screen flex flex-col items-center justify-center bg-gradient-to-br from-purple-900 via-indigo-900 to-black text-white relative overflow-hidden px-4 sm:px-6"
        style={{
          backgroundImage: `url(${mainMenuGif})`,
          backgroundSize: "cover",
          backgroundPosition: "center",
          backgroundRepeat: "no-repeat",
        }}
      >
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(255,255,255,0.1)_0%,transparent_50%)] pointer-events-none"></div>
        <animated.div
          style={logoSpring}
          className="mb-6 sm:mb-8 flex items-center"
        >
          <h1 className="text-4xl sm:text-5xl font-extrabold tracking-wide text-gold-100 mr-4 font-serif">
            Elysium
          </h1>
          <ElysiumLogo className="w-12 h-12 sm:w-16 sm:h-16" />
        </animated.div>
        <animated.p
          style={titleSpring}
          className="text-lg sm:text-xl italic mb-6 max-w-md text-center text-silver-200"
        >
          Unlock Your Eternal Notes in a Decentralized Realm
        </animated.p>
        <div className="flex flex-col sm:flex-row w-full max-w-6xl mx-auto space-y-4 sm:space-y-0 sm:space-x-4">
          <div
            className="flex-1 p-6 sm:p-8 rounded-xl cursor-pointer transform transition-all duration-300 hover:scale-105 bg-opacity-80 shadow-2xl"
            onClick={() => setSelectedMode("db")}
            style={{
              backgroundImage: `url(${databaseGif})`,
              backgroundSize: "cover",
              backgroundRepeat: "repeat",
              backgroundPosition: "center",
            }}
          >
            <div className="bg-black/60 p-4 rounded text-center">
              <h2 className="text-2xl sm:text-3xl font-bold text-gold-100 mb-2 font-serif">
                Database Version (Free)
              </h2>
              <p className="text-silver-200 text-sm sm:text-base">
                Store notes locally in your browser database.
              </p>
            </div>
          </div>
          <div
            className="flex-1 p-6 sm:p-8 rounded-xl cursor-pointer transform transition-all duration-300 hover:scale-105 bg-opacity-80 shadow-2xl"
            onClick={() => setSelectedMode("cloud")}
            style={{
              backgroundImage: `url(${cloudGif})`,
              backgroundSize: "cover",
              backgroundRepeat: "repeat",
              backgroundPosition: "center",
            }}
          >
            <div className="bg-black/60 p-4 rounded text-center">
              <h2 className="text-2xl sm:text-3xl font-bold text-gold-100 mb-2 font-serif">
                Cloud Version
              </h2>
              <p className="text-silver-200 text-sm sm:text-base">
                Store notes in the cloud (simulated with local storage).
              </p>
            </div>
          </div>
          <div
            className="flex-1 p-6 sm:p-8 rounded-xl cursor-pointer transform transition-all duration-300 hover:scale-105 bg-opacity-80 shadow-2xl"
            onClick={() => setSelectedMode("web3")}
            style={{
              backgroundImage: `url(${blockchainGif})`,
              backgroundSize: "cover",
              backgroundRepeat: "repeat",
              backgroundPosition: "center",
            }}
          >
            <div className="bg-black/60 p-4 rounded text-center">
              <h2 className="text-2xl sm:text-3xl font-bold text-gold-100 mb-2 font-serif">
                Blockchain Version (SOL + Arweave)
              </h2>
              <p className="text-silver-200 text-sm sm:text-base">
                Store notes permanently on the blockchain.
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      {!isLoggedIn ? (
        <div className="min-h-screen h-screen flex flex-col items-center justify-center bg-gradient-to-br from-purple-900 via-indigo-900 to-black text-white relative overflow-hidden px-4 sm:px-6">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(255,255,255,0.1)_0%,transparent_50%)] pointer-events-none"></div>
          <animated.div style={logoSpring}>
            <ElysiumLogo className="mb-6 w-20 h-20 sm:w-24 sm:h-24" />
          </animated.div>
          <animated.h1
            style={titleSpring}
            className="text-4xl sm:text-5xl font-extrabold tracking-wide mb-2 text-gold-100 font-serif"
          >
            Welcome to Elysium
          </animated.h1>
          <animated.p
            style={titleSpring}
            className="text-lg sm:text-xl italic mb-6 max-w-md text-center text-silver-200"
          >
            Unlock Your Eternal Notes in a Decentralized Realm
          </animated.p>
          <animated.div style={buttonSpring}>
            <button
              onClick={handleSelectWallet}
              className="bg-gradient-to-r from-blue-600 to-purple-700 hover:from-blue-700 hover:to-purple-800 text-white font-bold py-3 px-6 sm:px-8 rounded-full shadow-xl transition-all duration-300 text-base sm:text-lg"
            >
              Select SOL Wallet
            </button>
            <button
              onClick={handleExitToMainMenu}
              className="mt-4 bg-gradient-to-r from-indigo-600 to-purple-700 hover:from-indigo-700 hover:to-purple-800 text-white font-bold py-3 px-6 sm:px-8 rounded-full shadow-xl transition-all duration-300 text-base sm:text-lg"
            >
              Exit to Main Menu
            </button>
          </animated.div>
        </div>
      ) : (
        <div className="min-h-screen h-screen flex flex-col bg-gradient-to-br from-purple-900 via-indigo-900 to-black text-white relative overflow-hidden">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(255,255,255,0.05)_0%,transparent_70%)] pointer-events-none"></div>
          <Drawer onNavigate={handlePageChange} />
          <button onClick={handleLogoButton}>
            <div className="fixed top-4 sm:top-6 left-1/2 transform -translate-x-1/2 z-40">
              <ElysiumLogo className="w-12 h-12 sm:w-16 sm:h-16" />
            </div>
          </button>
          <header className="w-full p-2 sm:p-4 flex justify-end absolute top-0 left-0 items-center space-x-2 sm:space-x-4">
            {connected && (
              <button
                onClick={handleWalletAction}
                className="bg-gradient-to-r from-purple-600 to-blue-700 hover:from-purple-700 hover:to-blue-800 text-white font-bold py-2 px-4 sm:px-6 rounded-full shadow-xl transition-all duration-300 text-sm sm:text-base"
              >
                {shortenedAddress}
              </button>
            )}
            {mode !== "web3" && (
              <button
                onClick={handleExitToMainMenu}
                className="bg-gradient-to-r from-indigo-600 to-purple-700 hover:from-indigo-700 hover:to-purple-800 text-white font-bold py-2 px-4 sm:px-6 rounded-full shadow-xl transition-all duration-300 text-sm sm:text-base"
              >
                Exit to Main Menu
              </button>
            )}
          </header>
          {showPopup && (
            <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50">
              <div className="bg-gradient-to-br from-purple-900 via-indigo-900 to-black p-4 sm:p-6 rounded-lg shadow-2xl text-white w-11/12 max-w-md sm:w-80 transform transition-all duration-300 ease-in-out">
                <h3 className="text-lg sm:text-xl font-semibold mb-4 border-b border-indigo-700 pb-2 text-gold-100 font-serif">
                  Wallet Options
                </h3>
                <button
                  onClick={handleLogout}
                  className="w-full bg-red-800 bg-opacity-70 hover:bg-opacity-90 text-white font-semibold py-2 px-4 rounded-lg shadow-md transition-all duration-200 mt-4 text-sm sm:text-base"
                >
                  Logout
                </button>
              </div>
            </div>
          )}
          <div
            className="flex flex-col items-center justify-start flex-1 mt-16 sm:mt-20 overflow-y-auto px-4 sm:px-6"
            style={{
              scrollbarWidth: "thin",
              scrollbarColor: "#4B0082 #1A202C",
            }}
          >
            <style>
              {`
                .overflow-y-auto::-webkit-scrollbar {
                  width: 8px sm:12px;
                }
                .overflow-y-auto::-webkit-scrollbar-track {
                  background: url('data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24"><path fill="%234B0082" d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm-1-13h2v6h-2zm0 8h2v2h-2z"/></svg>') repeat-y center, #1A202C;
                  background-size: 16px sm:20px;
                }
                .overflow-y-auto::-webkit-scrollbar-thumb {
                  background: linear-gradient(45deg, #4B0082, #6A0DAD);
                  border-radius: 4px sm:6px;
                  border: 2px solid #1A202C;
                }
                .overflow-y-auto::-webkit-scrollbar-thumb:hover {
                  background: linear-gradient(45deg, #6A0DAD, #9370DB);
                }
              `}
            </style>
            <animated.div
              style={mode === "web3" ? blockchainPageSpring : {}}
              className="w-full max-w-4xl p-4 sm:p-6"
            >
              {activePage === "recent" && (
                <>
                  <h1 className="text-4xl sm:text-5xl font-extrabold mb-6 sm:mb-8 text-gold-100 font-serif">
                    Recent Notes
                  </h1>
                  <p className="text-gray-300 text-sm mb-4">
                    Note: Delete removes from GUI only; blockchain storage is
                    permanent.
                  </p>
                  <div className="flex space-x-4 mb-6 sm:mb-8">
                    <button
                      onClick={() => setShowCreateModal(true)}
                      className={
                        mode === "db"
                          ? "bg-orange-500 hover:bg-orange-600 text-white font-bold py-3 px-6 sm:px-8 rounded-full shadow-xl transition-all duration-300 text-base sm:text-lg"
                          : mode === "cloud"
                          ? `bg-white text-gray-800 font-bold py-3 px-6 sm:px-8 rounded-full shadow-xl transition-all duration-300 text-base sm:text-lg ${
                              isCloudButtonClicked
                                ? "bg-cyan-300"
                                : "hover:bg-cyan-200"
                            }`
                          : "bg-gradient-to-r from-blue-600 to-purple-700 hover:from-blue-700 hover:to-purple-800 text-white font-bold py-3 px-6 sm:px-8 rounded-full shadow-xl transition-all duration-300 text-base sm:text-lg"
                      }
                      onClickCapture={() => {
                        if (mode === "cloud") setIsCloudButtonClicked(true);
                      }}
                    >
                      {mode === "db"
                        ? "Save to Database"
                        : mode === "cloud"
                        ? "Save to Cloud"
                        : "Create Note"}
                    </button>
                  </div>
                  {notes.length > 0 ? (
                    <div className="grid grid-cols-1 gap-6">
                      {notes.map((note) => (
                        <animated.div
                          key={note.id}
                          style={noteSpring}
                          className="bg-gradient-to-br from-indigo-800 to-indigo-700 p-4 sm:p-6 rounded-lg shadow-2xl flex flex-col justify-between"
                        >
                          <div>
                            <h2 className="text-xl sm:text-2xl font-semibold text-gold-100 mb-4 font-serif">
                              {note.title}{" "}
                              {note.isPermanent && "(Blockchain Saved)"}
                            </h2>
                            {renderList(
                              note.id,
                              note.content,
                              note.template,
                              notes,
                              setNotes,
                              note.isPermanent || false
                            )}
                          </div>
                          <div className="mt-4 text-right">
                            <button
                              onClick={() => {
                                if (note.isPermanent) {
                                  if (
                                    window.confirm(
                                      "This item will be deleted from the GUI only. It cannot be deleted from the blockchain as it is permanently stored."
                                    )
                                  ) {
                                    const updatedNotes = notes.filter(
                                      (n) => n.id !== note.id
                                    );
                                    setNotes(updatedNotes);
                                    if (mode !== "web3") {
                                      localStorage.setItem(
                                        `elysium_notes_${mode}`,
                                        JSON.stringify(updatedNotes)
                                      );
                                    }
                                  }
                                } else {
                                  const updatedNotes = notes.filter(
                                    (n) => n.id !== note.id
                                  );
                                  setNotes(updatedNotes);
                                  if (mode !== "web3") {
                                    localStorage.setItem(
                                      `elysium_notes_${mode}`,
                                      JSON.stringify(updatedNotes)
                                    );
                                  }
                                }
                              }}
                              className="text-red-400 hover:text-red-300 transition-colors duration-200 text-sm sm:text-base"
                              disabled={false}
                            >
                              Delete
                            </button>
                          </div>
                        </animated.div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-center text-gray-400 flex items-center justify-center h-64 text-sm sm:text-base">
                      No notes yet—create one to get started!
                    </p>
                  )}
                </>
              )}
              {activePage === "create" && (
                <CreateNote
                  onSave={handleCreateNote}
                  onCancel={() => {
                    setShowCreateModal(false);
                    setIsCloudButtonClicked(false);
                    setActivePage("recent"); // Navigate back to Recent Notes
                  }}
                />
              )}
              {activePage === "settings" && <Settings />}
              {activePage === "logout" && (
                <Logout
                  onConfirm={handleLogout}
                  onCancel={() => {
                    setShowPopup(false);
                    setIsCloudButtonClicked(false);
                    setActivePage("recent"); // Navigate back to Recent Notes
                  }}
                />
              )}
            </animated.div>
            {showCreateModal && (
              <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 px-4">
                <div className="w-full max-w-md sm:max-w-lg">
                  <CreateNote
                    onSave={handleCreateNote}
                    onCancel={() => {
                      setShowCreateModal(false);
                      setIsCloudButtonClicked(false);
                      setActivePage("recent"); // Navigate back to Recent Notes
                    }}
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
