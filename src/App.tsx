import React, { useState, useEffect, useCallback, useRef } from "react";
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
import { supabase } from "./SUPABASE/supabaseClient";
import { Session } from "@supabase/supabase-js";

interface Note {
  id: string;
  title: string;
  content: string;
  template: string;
  encryptedContent?: Uint8Array;
  nonce?: Uint8Array;
  arweaveHash?: string;
  isPermanent?: boolean;
  completionTimestamps?: { [taskIndex: number]: string };
  createdAt: string;
  updatedAt: string;
  files?: File[];
}

interface SupabaseNote {
  id: string;
  user_id: string;
  title: string; // JSON string of encrypted data
  content: string; // JSON string of encrypted data
  template?: string;
  created_at: string;
}

const network = WalletAdapterNetwork.Devnet;
const endpoint = clusterApiUrl(network);
const connection = new Connection(endpoint, "confirmed");
const programId = new PublicKey(idlJson.address);

function App() {
  const wallets = useMemo(() => [], []);
  const [user, setUser] = useState<any>(null);
  const [authSubscriptionRef, setAuthSubscriptionRef] = useState<any>(null);
  const authProcessedRef = useRef(false);

  useEffect(() => {
    const handleAuthRedirect = async () => {
      if (authProcessedRef.current) {
        console.log("Auth already processed, skipping");
        return;
      }

      const hash = window.location.hash;
      console.log("URL hash on load:", hash);
      if (hash.includes("error=access_denied")) {
        console.error("Auth error in URL:", hash);
        alert(
          "Email link is invalid or has expired. Please request a new one."
        );
        return;
      }

      // Check if hash contains auth tokens
      if (hash.includes("access_token")) {
        // Parse the hash to extract tokens
        const hashParams = new URLSearchParams(hash.substring(1));
        const accessToken = hashParams.get("access_token");
        const refreshToken = hashParams.get("refresh_token");

        if (accessToken && refreshToken) {
          console.log("Setting session from hash tokens");
          const { data, error } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          });
          console.log("Set session result:", { data, error });
          if (error) {
            console.error("Error setting session:", error);
            alert(`Authentication failed: ${error.message}`);
          } else if (data.session) {
            setUser(data.session.user);
            console.log("User set from session:", data.session.user);
            alert(`Logged in as ${data.session.user.email}`);
            authProcessedRef.current = true;
          } else {
            console.log("No session returned from setSession");
            alert("Authentication failed: No session returned");
          }
        } else {
          console.log("Hash contains access_token but missing tokens");
          alert("Authentication failed: Missing tokens in URL");
        }
      } else {
        // No tokens in hash, get current session
        const {
          data: { session },
          error,
        } = await supabase.auth.getSession();
        console.log("Initial session check:", { session, error });
        setUser(session?.user ?? null);
        authProcessedRef.current = true;
      }

      // Clean the hash after processing
      if (hash) {
        window.history.replaceState(null, "", window.location.pathname);
        console.log("URL hash cleaned");
      }
      const storageKey = `sb-${process.env.REACT_APP_SUPABASE_URL?.replace(
        "https://",
        ""
      )}-auth-token`;
      console.log(
        "Supabase token in localStorage:",
        localStorage.getItem(storageKey)
      );
    };

    // Set up auth listener first
    if (!authSubscriptionRef) {
      const {
        data: { subscription },
      } = supabase.auth.onAuthStateChange(
        async (event: string, session: Session | null) => {
          console.log("Auth state changed:", { event, session });
          if (session) {
            setUser(session.user);
          } else {
            setUser(null);
          }
        }
      );
      setAuthSubscriptionRef(subscription);
    }

    // Then handle initial session (including from hash)
    handleAuthRedirect();

    return () => {
      if (authSubscriptionRef) {
        console.log("Unsubscribing auth state listener");
        authSubscriptionRef.unsubscribe();
        setAuthSubscriptionRef(null);
      }
    };
  }, []); // Only run once

  return (
    <ConnectionProvider endpoint={endpoint}>
      <WalletProvider wallets={wallets} autoConnect>
        <WalletModalProvider>
          <WelcomePage user={user} setUser={setUser} />
        </WalletModalProvider>
      </WalletProvider>
    </ConnectionProvider>
  );
}

function getDefaultNotes(mode: "web3" | "db" | "cloud"): Note[] {
  const now = new Date().toISOString();
  if (mode === "db") {
    return [];
  } else if (mode === "cloud") {
    return [
      {
        id: "1",
        title: "Cloud Sync Notes",
        content:
          "Configure cloud storage...\n- [ ] Set up S3 bucket\n- [ ] Enable versioning\n- [ ] Test sync",
        template: "Checklist",
        isPermanent: false,
        completionTimestamps: {},
        createdAt: now,
        updatedAt: now,
      },
    ];
  } else {
    return [
      {
        id: "1",
        title: "Meeting Notes 08/07/2025",
        content:
          "Discuss project timeline...\n- [ ] Prepare agenda\n- [ ] Assign tasks\n- [ ] Review progress",
        template: "To-Do List",
        isPermanent: false,
        completionTimestamps: {},
        createdAt: now,
        updatedAt: now,
      },
      {
        id: "2",
        title: "Ideas",
        content:
          "Brainstorm new features for Elysium...\n- [ ] Add folder support\n- [ ] Enhance templates\n- [ ] Improve UI",
        template: "Checklist",
        isPermanent: false,
        completionTimestamps: {},
        createdAt: now,
        updatedAt: now,
      },
    ];
  }
}

function WelcomePage({
  user,
  setUser,
}: {
  user: any;
  setUser: (user: any) => void;
}) {
  const { connected, publicKey, sendTransaction, disconnect } = useWallet();
  const { setVisible } = useWalletModal();
  const anchorWallet = useAnchorWallet();
  const [hasBeenConnected, setHasBeenConnected] = useState(false);
  const [showPopup, setShowPopup] = useState(false);
  const [email, setEmail] = useState("");
  const [isLoggingIn, setIsLoggingIn] = useState(false);

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

  const [notes, setNotes] = useState<Note[]>([]);
  const [isLoadingNotes, setIsLoadingNotes] = useState(false);

  const [activePage, setActivePage] = useState<
    "recent" | "create" | "settings" | "logout" | "search"
  >("recent");
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [files, setFiles] = useState<File[]>([]);
  const [isCloudButtonClicked, setIsCloudButtonClicked] = useState(false);

  // Search state
  const [searchQuery, setSearchQuery] = useState("");

  // Note viewing/editing state
  const [viewingNote, setViewingNote] = useState<Note | null>(null);
  const [editingNote, setEditingNote] = useState<Note | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editContent, setEditContent] = useState("");
  const [editTemplate, setEditTemplate] = useState("Auto");

  const [settings, setSettings] = useState(() => {
    const saved = localStorage.getItem("elysium_settings");
    return saved
      ? JSON.parse(saved)
      : {
          theme: "Dark",
          notifications: false,
          syncInterval: 15,
        };
  });

  // Apply theme to document
  useEffect(() => {
    if (settings.theme === "Light") {
      document.documentElement.classList.add("light-theme");
    } else {
      document.documentElement.classList.remove("light-theme");
    }
  }, [settings.theme]);

  // Auto-sync functionality
  useEffect(() => {
    if (!settings.notifications || settings.syncInterval <= 0) return;

    const interval = setInterval(() => {
      if (user && notes.length > 0) {
        // Trigger a sync operation
        fetchNotes();
      }
    }, settings.syncInterval * 60 * 1000); // Convert minutes to milliseconds

    return () => clearInterval(interval);
  }, [settings.notifications, settings.syncInterval, user, notes.length]);

  const handleSettingsSave = (newSettings: {
    theme: string;
    notifications: boolean;
    syncInterval: number;
  }) => {
    setSettings(newSettings);
    localStorage.setItem("elysium_settings", JSON.stringify(newSettings));

    // Show notification if enabled
    if (newSettings.notifications && !settings.notifications) {
      // Request notification permission
      if ("Notification" in window && Notification.permission === "default") {
        Notification.requestPermission();
      }
    }
  };

  // Notification utility function
  const showNotification = (title: string, body: string) => {
    if (
      settings.notifications &&
      "Notification" in window &&
      Notification.permission === "granted"
    ) {
      new Notification(title, {
        body,
        icon: "/favicon.ico",
        badge: "/favicon.ico",
      });
    }
  };

  // Clean up orphaned notes that can't be decrypted
  const cleanupOrphanedNotes = async () => {
    if (mode !== "db" || !user) return;

    try {
      const session = (await supabase.auth.getSession()).data.session;
      if (!session) return;

      const key = await deriveKey(session.access_token);
      const { data, error } = await supabase
        .from("notes")
        .select("*")
        .eq("user_id", session.user.id);

      if (error) {
        console.error("Error fetching notes for cleanup:", error);
        return;
      }

      const orphanedNoteIds: string[] = [];

      for (const note of data) {
        try {
          const title = await decryptData(JSON.parse(note.title), key);
          const content = await decryptData(JSON.parse(note.content), key);
          if (!title || !content) {
            orphanedNoteIds.push(note.id);
          }
        } catch (error) {
          orphanedNoteIds.push(note.id);
        }
      }

      if (orphanedNoteIds.length > 0) {
        const { error: deleteError } = await supabase
          .from("notes")
          .delete()
          .in("id", orphanedNoteIds);

        if (deleteError) {
          console.error("Error deleting orphaned notes:", deleteError);
          alert("Failed to clean up orphaned notes. Please try again.");
        } else {
          alert(
            `Successfully cleaned up ${orphanedNoteIds.length} orphaned note${
              orphanedNoteIds.length === 1 ? "" : "s"
            }.`
          );
          // Refresh notes
          fetchNotes();
        }
      } else {
        alert("No orphaned notes found to clean up.");
      }
    } catch (error) {
      console.error("Error during cleanup:", error);
      alert("An error occurred during cleanup. Please try again.");
    }
  };

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
    reset: notes.length === 0,
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

  const handleLogout = async () => {
    if (connected && disconnect) {
      disconnect();
    }
    if (mode === "db") {
      console.log("Logging out from Supabase");
      await supabase.auth.signOut();
      setUser(null);
    }
    setShowPopup(false);
    setSelectedMode(null);
    setMode("web3");
    setActivePage("recent");
    setNotes([]);
    localStorage.removeItem("elysium_selected_mode");
  };

  const handleLogoButton = () => {
    setActivePage("recent");
  };

  const handleExitToMainMenu = () => {
    setSelectedMode(null);
    setActivePage("recent");
    setNotes([]);
  };

  async function deriveKey(userId: string): Promise<CryptoKey> {
    const encoder = new TextEncoder();
    const keyMaterial = await crypto.subtle.importKey(
      "raw",
      encoder.encode(userId + "elysium-persistent-key"),
      "PBKDF2",
      false,
      ["deriveKey"]
    );
    return crypto.subtle.deriveKey(
      {
        name: "PBKDF2",
        salt: encoder.encode("elysium-eternal-salt"),
        iterations: 100000,
        hash: "SHA-256",
      },
      keyMaterial,
      { name: "AES-GCM", length: 256 },
      true,
      ["encrypt", "decrypt"]
    );
  }

  async function encryptData(data: string, key: CryptoKey) {
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const encrypted = await crypto.subtle.encrypt(
      { name: "AES-GCM", iv },
      key,
      new TextEncoder().encode(data)
    );
    return {
      iv: Array.from(iv),
      encrypted: Array.from(new Uint8Array(encrypted)),
    };
  }

  async function decryptData(
    encryptedData: { iv: number[]; encrypted: number[] },
    key: CryptoKey
  ): Promise<string> {
    try {
      const decrypted = await crypto.subtle.decrypt(
        { name: "AES-GCM", iv: new Uint8Array(encryptedData.iv) },
        key,
        new Uint8Array(encryptedData.encrypted)
      );
      return new TextDecoder().decode(decrypted);
    } catch (error) {
      console.error("Decryption failed:", error);
      return "";
    }
  }

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
          id: Date.now().toString(),
          title: note.title,
          content: note.content,
          template: note.template,
          encryptedContent: encrypted,
          nonce: nonce,
          isPermanent: false,
          completionTimestamps: {},
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        await saveToBlockchain(newNote);
      } else if (mode === "db") {
        const session = (await supabase.auth.getSession()).data.session;
        if (session) {
          const key = await deriveKey(session.access_token);
          const encTitle = await encryptData(note.title, key);
          const encContent = await encryptData(note.content, key);
          console.log("Saving note to Supabase:", {
            title: encTitle,
            content: encContent,
            template: note.template,
          });
          const { data, error } = await supabase
            .from("notes")
            .insert({
              user_id: session.user.id,
              title: JSON.stringify(encTitle),
              content: JSON.stringify(encContent),
              template: note.template,
            })
            .select()
            .single();
          if (error) {
            console.error("Supabase insert error:", error);
            alert("Failed to save note to database.");
            return;
          }
          console.log("Note saved to Supabase:", data);
          newNote = {
            id: data.id,
            title: note.title,
            content: note.content,
            template: note.template,
            isPermanent: false,
            completionTimestamps: {},
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            files: note.files,
          };
        } else {
          console.log("No session found during note creation");
          alert("Please log in to save a note.");
          return;
        }
      } else {
        newNote = {
          id: Date.now().toString(),
          title: note.title,
          content: note.content,
          template: note.template,
          isPermanent: false,
          completionTimestamps: {},
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          files: note.files,
        };
      }
      setNotes([...notes, newNote]);
      setFiles(note.files);
      setShowCreateModal(false);
      setActivePage("recent");
      if (mode === "cloud") {
        localStorage.setItem(
          `elysium_notes_${mode}`,
          JSON.stringify([...notes, newNote])
        );
      }
      setIsCloudButtonClicked(false);

      // Show notification for successful note creation
      showNotification(
        "Note Created",
        `"${note.title}" has been saved successfully`
      );
    } else if (mode === "web3") {
      alert("Please connect your wallet to create a note.");
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) setFiles(Array.from(e.target.files));
  };

  const handlePageChange = (
    page: "recent" | "create" | "settings" | "logout" | "search"
  ) => {
    setActivePage(page);
  };

  const saveToBlockchain = async (note: Note) => {
    if (mode !== "web3" || !publicKey || !sendTransaction || !anchorWallet) {
      return;
    }
    try {
      const provider = new AnchorProvider(connection, anchorWallet, {});
      const program = new Program(idlJson as Idl, provider);
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

  const loadFromBlockchain = async () => {
    if (!publicKey || !anchorWallet) return;
    const provider = new AnchorProvider(connection, anchorWallet, {});
    const program = new Program(idlJson as Idl, provider);
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
        const noteId = note.noteId.toString();
        if (note.arweaveHash) {
          try {
            const response = await fetch(
              `https://arweave.net/${note.arweaveHash}`
            );
            const data = await response.arrayBuffer();
            const buffer = new Uint8Array(data);
            const nonceLength = 24;
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
              createdAt: note.createdAt
                ? new Date(note.createdAt.toNumber() * 1000).toISOString()
                : new Date().toISOString(),
              updatedAt: note.updatedAt
                ? new Date(note.updatedAt.toNumber() * 1000).toISOString()
                : new Date().toISOString(),
              files: parsed.files || [],
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
            createdAt: note.createdAt
              ? new Date(note.createdAt.toNumber() * 1000).toISOString()
              : new Date().toISOString(),
            updatedAt: note.updatedAt
              ? new Date(note.updatedAt.toNumber() * 1000).toISOString()
              : new Date().toISOString(),
          });
        }
      }
      setNotes(fetchedNotes);
    } catch (error) {
      console.error("Failed to load notes from blockchain:", error);
    }
  };

  const handleLogin = async () => {
    if (!email) {
      alert("Please enter a valid email address.");
      return;
    }
    setIsLoggingIn(true);
    console.log("Attempting to send magic link to:", email);
    try {
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: {
          emailRedirectTo: "http://localhost:3000",
          shouldCreateUser: true,
        },
      });
      if (error) {
        console.error("Login error:", error);
        alert(
          `Failed to send magic link: ${error.message}. Please check your Supabase dashboard for Auth logs, ensure SMTP is configured, and verify your email isn't blocked.`
        );
      } else {
        console.log("Magic link sent successfully to:", email);
        alert(
          "Magic link sent! Check your email (including spam/junk folder). If not received, check Supabase Auth logs and ensure SMTP is configured."
        );
      }
    } catch (err) {
      console.error("Unexpected error during login:", err);
      alert(
        "An unexpected error occurred. Please check your Supabase configuration and try again."
      );
    } finally {
      setIsLoggingIn(false);
      setEmail("");
    }
  };

  const debounce = <F extends (...args: any[]) => any>(
    func: F,
    wait: number
  ) => {
    let timeout: NodeJS.Timeout;
    return (...args: Parameters<F>): Promise<ReturnType<F>> => {
      return new Promise((resolve) => {
        clearTimeout(timeout);
        timeout = setTimeout(() => resolve(func(...args)), wait);
      });
    };
  };

  const fetchNotes = useCallback(
    debounce(async () => {
      if (mode !== "db" || !user) return;
      setIsLoadingNotes(true);
      const session = (await supabase.auth.getSession()).data.session;
      if (session) {
        console.log("Fetching notes for user:", session.user.id);
        const key = await deriveKey(session.access_token);
        const { data, error } = await supabase
          .from("notes")
          .select("*")
          .eq("user_id", session.user.id);
        if (error) {
          console.error("Supabase fetch error:", error);
          return;
        }
        console.log("Raw notes from Supabase:", data);
        const decryptedNotes = await Promise.all(
          data.map(async (n: SupabaseNote): Promise<Note | null> => {
            try {
              const title = await decryptData(JSON.parse(n.title), key);
              const content = await decryptData(JSON.parse(n.content), key);
              if (title && content) {
                return {
                  id: n.id,
                  title,
                  content,
                  template: n.template || "To-Do List",
                  isPermanent: false,
                  completionTimestamps: {},
                  createdAt: n.created_at,
                  updatedAt: n.created_at,
                } as Note;
              } else {
                console.warn(
                  `Note ${n.id} failed to decrypt properly - title or content empty`
                );
                return null;
              }
            } catch (error) {
              console.error(`Failed to decrypt note ${n.id}:`, error);
              return null;
            }
          })
        );
        const validNotes = decryptedNotes.filter(
          (note): note is Note => note !== null
        );

        // Handle orphaned notes (encrypted with old method)
        const orphanedCount = decryptedNotes.filter(
          (note) => note === null
        ).length;
        if (orphanedCount > 0) {
          console.warn(
            `Found ${orphanedCount} orphaned notes that were encrypted with the old method. These cannot be recovered.`
          );
          // Show user notification about orphaned notes
          setTimeout(() => {
            alert(
              `Warning: ${orphanedCount} of your notes were encrypted with an old method and cannot be recovered. These notes will not appear in your list. New notes will work correctly.`
            );
          }, 1000);
        }

        console.log("Decrypted notes:", validNotes);
        setNotes(validNotes);
        setIsLoadingNotes(false);

        // Show notification for successful sync
        if (validNotes.length > 0) {
          showNotification(
            "Elysium Notes Synced",
            `Successfully synced ${validNotes.length} note${
              validNotes.length === 1 ? "" : "s"
            }`
          );
        }
      }
    }, 5000),
    [mode, user]
  );

  useEffect(() => {
    if (selectedMode) {
      console.log("Mode selected:", selectedMode);
      setMode(selectedMode);
      localStorage.setItem("elysium_selected_mode", selectedMode);
      setActivePage("recent");
      setNotes([]);
    }
  }, [selectedMode]);

  useEffect(() => {
    if (mode === "db" && user) {
      fetchNotes();
    } else if (mode === "cloud") {
      const stored = localStorage.getItem(`elysium_notes_${mode}`);
      console.log("Cloud notes from localStorage:", stored);
      setNotes(stored ? JSON.parse(stored) : getDefaultNotes(mode));
    } else if (mode === "web3") {
      setNotes(getDefaultNotes(mode));
      if (connected) loadFromBlockchain();
    }
  }, [mode, user, connected, fetchNotes]);

  useEffect(() => {
    if (mode !== "web3" && mode !== "db") {
      console.log("Saving cloud notes to localStorage:", notes);
      localStorage.setItem(`elysium_notes_${mode}`, JSON.stringify(notes));
    }
  }, [notes, mode]);

  useEffect(() => {
    if (connected && mode === "web3") {
      loadFromBlockchain();
      setHasBeenConnected(true);
      setWallet({} as any);
    } else if (hasBeenConnected && !connected && mode === "web3") {
      setSelectedMode(null);
      setMode("web3");
      setActivePage("recent");
      setNotes([]);
      localStorage.removeItem("elysium_selected_mode");
    }
  }, [connected, hasBeenConnected, mode, anchorWallet]);

  const shortenedAddress = publicKey
    ? `${publicKey.toBase58().slice(0, 4)}...${publicKey.toBase58().slice(-4)}`
    : "";

  const renderList = (
    noteId: string,
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

      // Handle different template types
      if (template === "List") {
        // For List template: just bullet points, no checkboxes
        if (trimmed.startsWith("-") || trimmed.startsWith(".")) {
          itemText = trimmed.slice(1).trim();
        }
      } else if (template === "To-Do List" || template === "Checklist") {
        // For To-Do List/ Checklist: handle checkboxes
        if (trimmed.startsWith("*")) {
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
        } else if (trimmed.startsWith("-") || trimmed.startsWith(".")) {
          // Also handle - [ ] and . [ ] format for backward compatibility
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
      }

      const handleToggleCheck = async () => {
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
                  updatedAt: new Date().toISOString(),
                  content: n.content
                    .split("\n")
                    .map((l, i) =>
                      i === index
                        ? `${
                            trimmed.startsWith("*")
                              ? "*"
                              : trimmed.startsWith("-")
                              ? "-"
                              : trimmed.startsWith(".")
                              ? "."
                              : "*"
                          } [x] ${itemText} (Done at ${newTimestamp})`
                        : l
                    )
                    .join("\n"),
                }
              : n
          );
          setNotes(updatedNotes);
          if (mode === "db" && user) {
            const session = (await supabase.auth.getSession()).data.session;
            if (session) {
              const key = await deriveKey(session.access_token);
              const encContent = await encryptData(
                updatedNotes.find((n) => n.id === noteId)!.content,
                key
              );
              console.log("Updating note content in Supabase:", encContent);
              const { error } = await supabase
                .from("notes")
                .update({ content: JSON.stringify(encContent) })
                .eq("id", noteId);
              if (error) console.error("Supabase update error:", error);
            }
          } else if (mode === "cloud") {
            localStorage.setItem(
              `elysium_notes_${mode}`,
              JSON.stringify(updatedNotes)
            );
          }
        }
      };

      const handleTimestampClick = async () => {
        if (isChecked && (mode !== "web3" || publicKey)) {
          // Ask for confirmation since changing timestamp is irreversible
          const confirmChange = window.confirm(
            "Are you sure you want to change the completion timestamp? This action cannot be undone."
          );

          if (!confirmChange) return;

          const newTimestamp = new Date().toISOString();
          const updatedNotes = notes.map((n) =>
            n.id === noteId
              ? {
                  ...n,
                  completionTimestamps: {
                    ...n.completionTimestamps,
                    [index]: newTimestamp,
                  },
                  updatedAt: new Date().toISOString(),
                  content: n.content
                    .split("\n")
                    .map((l, i) =>
                      i === index
                        ? `${
                            trimmed.startsWith("*")
                              ? "*"
                              : trimmed.startsWith("-")
                              ? "-"
                              : trimmed.startsWith(".")
                              ? "."
                              : "*"
                          } [x] ${itemText.replace(
                            /\(Done at .*\)/,
                            ""
                          )} (Done at ${newTimestamp})`
                        : l
                    )
                    .join("\n"),
                }
              : n
          );
          setNotes(updatedNotes);
          if (mode === "db" && user) {
            const session = (await supabase.auth.getSession()).data.session;
            if (session) {
              const key = await deriveKey(session.access_token);
              const encContent = await encryptData(
                updatedNotes.find((n) => n.id === noteId)!.content,
                key
              );
              console.log("Updating note content in Supabase:", encContent);
              const { error } = await supabase
                .from("notes")
                .update({ content: JSON.stringify(encContent) })
                .eq("id", noteId);
              if (error) console.error("Supabase update error:", error);
            }
          } else if (mode === "cloud") {
            localStorage.setItem(
              `elysium_notes_${mode}`,
              JSON.stringify(updatedNotes)
            );
          }
        }
      };

      const handleRemoveItem = async () => {
        if (template === "List") {
          // For List template: remove the item entirely
          const updatedNotes = notes.map((n) =>
            n.id === noteId
              ? {
                  ...n,
                  updatedAt: new Date().toISOString(),
                  content: n.content
                    .split("\n")
                    .filter((l, i) => i !== index)
                    .join("\n"),
                }
              : n
          );
          setNotes(updatedNotes);
          if (mode === "db" && user) {
            const session = (await supabase.auth.getSession()).data.session;
            if (session) {
              const key = await deriveKey(session.access_token);
              const encContent = await encryptData(
                updatedNotes.find((n) => n.id === noteId)!.content,
                key
              );
              console.log("Updating note content in Supabase:", encContent);
              const { error } = await supabase
                .from("notes")
                .update({ content: JSON.stringify(encContent) })
                .eq("id", noteId);
              if (error) console.error("Supabase update error:", error);
            }
          } else if (mode === "cloud") {
            localStorage.setItem(
              `elysium_notes_${mode}`,
              JSON.stringify(updatedNotes)
            );
          }
        }
      };

      return (
        <div key={index} className="flex items-center mb-2">
          {template === "List" ? (
            // List template: bullet points
            <>
              <span className="mr-2 text-indigo-400 text-lg">•</span>
              <span className="text-silver-200 flex-1 text-base md:text-sm">
                {itemText}
              </span>
              {!isPermanent && (
                <button
                  onClick={handleRemoveItem}
                  className="ml-2 text-red-400 hover:text-red-300 transition-colors duration-200 text-sm md:text-base"
                >
                  Remove
                </button>
              )}
            </>
          ) : (template === "To-Do List" || template === "Checklist") &&
            (itemText.trim() ||
              template === "To-Do List" ||
              template === "Checklist") ? (
            // To-Do List/ Checklist template: checkboxes
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
                {isChecked && (
                  <span
                    className="text-gray-500 text-xs md:text-sm ml-2 cursor-pointer hover:text-indigo-400 transition-colors bg-gray-800/50 px-2 py-1 rounded"
                    onClick={handleTimestampClick}
                    title="Click to update timestamp"
                  >
                    {timestamp
                      ? new Date(timestamp).toLocaleString()
                      : "Click to set timestamp"}
                  </span>
                )}
              </span>
            </>
          ) : (
            // Other templates or empty lines
            <span className="text-silver-200 flex-1 text-base md:text-sm">
              {itemText}
            </span>
          )}
        </div>
      );
    });
    return items;
  };

  const isLoggedIn =
    (mode === "db" && user) ||
    mode === "cloud" ||
    (mode === "web3" && connected);

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
                Database Version (Supabase)
              </h2>
              <p className="text-silver-200 text-sm sm:text-base">
                Secure, private notes with user authentication. Perfect for
                personal organization with reliable cloud backup and instant
                sync across devices.
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
                Fast, offline-capable note storage with seamless device
                synchronization. Ideal for quick notes and collaborative work
                with automatic backup.
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
                <strong>✨ PREMIUM:</strong> Eternal, censorship-resistant
                storage on Solana + Arweave. Your notes become immutable digital
                artifacts, preserved forever in the decentralized web. True
                ownership, zero data loss, maximum security.
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      {mode === "db" && !user ? (
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
            Enter your email to receive a magic link for login
          </animated.p>
          <animated.div style={buttonSpring} className="w-full max-w-md">
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Enter your email"
              className="w-full p-3 mb-4 bg-indigo-950/80 border border-indigo-700/50 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-indigo-400 transition-all duration-200"
              aria-required="true"
            />
            <button
              onClick={handleLogin}
              disabled={isLoggingIn}
              className="w-full bg-gradient-to-r from-blue-600 to-purple-700 hover:from-blue-700 hover:to-purple-800 text-white font-bold py-3 px-6 rounded-full shadow-xl transition-all duration-300 text-base sm:text-lg disabled:opacity-50"
            >
              {isLoggingIn ? "Sending..." : "Send Magic Link"}
            </button>
            <button
              onClick={handleExitToMainMenu}
              className="mt-4 w-full bg-gradient-to-r from-indigo-600 to-purple-700 hover:from-indigo-700 hover:to-purple-800 text-white font-bold py-3 px-6 rounded-full shadow-xl transition-all duration-300 text-base sm:text-lg"
            >
              Exit to Main Menu
            </button>
          </animated.div>
        </div>
      ) : mode === "web3" && !connected ? (
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
          <Drawer
            onNavigate={handlePageChange}
            onSearch={(query) => setSearchQuery(query)}
          />
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
          {showPopup && mode === "web3" && (
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
                    {mode === "db"
                      ? "🔒 Classic encrypted database: Simple, secure, and fully tied to your account with enterprise-grade protection."
                      : mode === "cloud"
                      ? "⚡️ Lightning-fast cloud storage: Encrypted, downloadable data access with advanced cloud security and instant offline access."
                      : "⛓️ Eternal blockchain vault: Immutable, censorship-resistant storage where your notes become permanent digital artifacts."}
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
                  {notes.filter((note) => mode !== "db" || !note.isPermanent)
                    .length > 0 ? (
                    <>
                      {mode === "db" && isLoadingNotes && (
                        <div className="mb-4 p-3 bg-red-900/20 border border-red-500/50 rounded-lg">
                          <p className="text-red-400 text-sm text-center">
                            <span className="font-semibold">
                              Free Database Version:
                            </span>{" "}
                            Notes may take a moment to load. Please wait while
                            we retrieve your data.
                          </p>
                        </div>
                      )}
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-6">
                        {notes
                          .filter((note) => mode !== "db" || !note.isPermanent)
                          .sort((a, b) => {
                            // Sort by updatedAt first, then by createdAt if updatedAt is not available
                            const aTime = new Date(
                              a.updatedAt || a.createdAt
                            ).getTime();
                            const bTime = new Date(
                              b.updatedAt || b.createdAt
                            ).getTime();
                            return bTime - aTime; // Most recent first
                          })
                          .map((note) => (
                            <animated.div
                              key={note.id}
                              style={noteSpring}
                              className="group bg-gradient-to-br from-indigo-800/90 to-indigo-700/90 backdrop-blur-sm p-3 sm:p-4 rounded-lg shadow-xl flex flex-col justify-between cursor-pointer hover:shadow-[0_0_15px_rgba(79,70,229,0.3)] hover:scale-105 transition-all duration-300 border border-indigo-600/30 h-48 sm:h-52"
                              onClick={() => setViewingNote(note)}
                            >
                              <div className="flex-1 overflow-hidden">
                                <h3 className="text-lg sm:text-xl font-semibold text-gold-100 mb-2 font-serif line-clamp-2 leading-tight">
                                  {note.title}
                                  {note.isPermanent && (
                                    <span className="text-xs text-amber-400 ml-1">
                                      ⛓️
                                    </span>
                                  )}
                                </h3>
                                <div className="text-gray-300 text-sm mb-2 line-clamp-3 leading-relaxed">
                                  {note.content
                                    .split("\n")[0]
                                    .substring(0, 120)}
                                  {note.content.length > 120 ? "..." : ""}
                                </div>
                                <div className="flex items-center justify-between text-xs text-gray-400">
                                  <span className="bg-indigo-900/50 px-2 py-1 rounded-full">
                                    {note.template}
                                  </span>
                                  <span className="text-gray-500">
                                    Click to view
                                  </span>
                                </div>
                              </div>
                              <div className="mt-3 flex justify-end">
                                <button
                                  onClick={async (e) => {
                                    e.stopPropagation(); // Prevent triggering the view
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
                                        if (mode === "db" && user) {
                                          console.log(
                                            "Deleting note from Supabase:",
                                            note.id
                                          );
                                          const { error } = await supabase
                                            .from("notes")
                                            .delete()
                                            .eq("id", note.id);
                                          if (error)
                                            console.error(
                                              "Supabase delete error:",
                                              error
                                            );
                                        } else if (mode === "cloud") {
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
                                      if (mode === "db" && user) {
                                        console.log(
                                          "Deleting note from Supabase:",
                                          note.id
                                        );
                                        const { error } = await supabase
                                          .from("notes")
                                          .delete()
                                          .eq("id", note.id);
                                        if (error)
                                          console.error(
                                            "Supabase delete error:",
                                            error
                                          );
                                      } else if (mode === "cloud") {
                                        localStorage.setItem(
                                          `elysium_notes_${mode}`,
                                          JSON.stringify(updatedNotes)
                                        );
                                      }
                                    }
                                  }}
                                  className="text-red-400 hover:text-red-300 transition-colors duration-200 text-sm opacity-0 group-hover:opacity-100"
                                  disabled={false}
                                >
                                  Delete
                                </button>
                              </div>
                            </animated.div>
                          ))}
                      </div>
                    </>
                  ) : (
                    <div className="text-center py-12">
                      {mode === "db" ? (
                        <div className="space-y-4">
                          <div className="p-4 bg-red-900/20 border border-red-500/50 rounded-lg">
                            <p className="text-red-400 text-sm">
                              <span className="font-semibold">
                                Free Database Version:
                              </span>{" "}
                              Notes may take a moment to load. Please wait while
                              we retrieve your data.
                            </p>
                          </div>
                          <p className="text-gray-400 text-sm">
                            No notes yet—create one to get started!
                          </p>
                        </div>
                      ) : (
                        <p className="text-gray-400 text-sm">
                          No notes yet—create one to get started!
                        </p>
                      )}
                    </div>
                  )}
                </>
              )}
              {activePage === "create" && (
                <CreateNote
                  onSave={handleCreateNote}
                  onCancel={() => {
                    setShowCreateModal(false);
                    setIsCloudButtonClicked(false);
                    setActivePage("recent");
                  }}
                  mode={mode}
                />
              )}
              {activePage === "settings" && (
                <Settings
                  onSave={handleSettingsSave}
                  onCleanupOrphanedNotes={cleanupOrphanedNotes}
                  initialTheme={settings.theme}
                  initialNotifications={settings.notifications}
                  initialSyncInterval={settings.syncInterval}
                />
              )}
              {activePage === "logout" && (
                <Logout
                  onConfirm={handleLogout}
                  onCancel={() => {
                    setShowPopup(false);
                    setIsCloudButtonClicked(false);
                    setActivePage("recent");
                  }}
                />
              )}
              {activePage === "search" && (
                <>
                  <h1 className="text-4xl sm:text-5xl font-extrabold mb-6 sm:mb-8 text-gold-100 font-serif">
                    Search Notes
                  </h1>
                  <div className="mb-6">
                    <input
                      type="text"
                      placeholder="Search notes by title or content..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full p-4 bg-indigo-950/80 border border-indigo-700/50 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-indigo-400 transition-all duration-200"
                    />
                  </div>
                  {(() => {
                    const filteredNotes = notes
                      .filter((note) => mode !== "db" || !note.isPermanent)
                      .filter(
                        (note) =>
                          note.title
                            .toLowerCase()
                            .includes(searchQuery.toLowerCase()) ||
                          note.content
                            .toLowerCase()
                            .includes(searchQuery.toLowerCase())
                      )
                      .sort((a, b) => {
                        // Sort by updatedAt first, then by createdAt if updatedAt is not available
                        const aTime = new Date(
                          a.updatedAt || a.createdAt
                        ).getTime();
                        const bTime = new Date(
                          b.updatedAt || b.createdAt
                        ).getTime();
                        return bTime - aTime; // Most recent first
                      });

                    return filteredNotes.length > 0 ? (
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-6">
                        {filteredNotes.map((note) => (
                          <animated.div
                            key={note.id}
                            style={noteSpring}
                            className="group bg-gradient-to-br from-indigo-800/90 to-indigo-700/90 backdrop-blur-sm p-3 sm:p-4 rounded-lg shadow-xl flex flex-col justify-between cursor-pointer hover:shadow-[0_0_15px_rgba(79,70,229,0.3)] hover:scale-105 transition-all duration-300 border border-indigo-600/30 h-48 sm:h-52"
                            onClick={() => setViewingNote(note)}
                          >
                            <div className="flex-1 overflow-hidden">
                              <h3 className="text-lg sm:text-xl font-semibold text-gold-100 mb-2 font-serif line-clamp-2 leading-tight">
                                {note.title}
                                {note.isPermanent && (
                                  <span className="text-xs text-amber-400 ml-1">
                                    ⛓️
                                  </span>
                                )}
                              </h3>
                              <div className="text-gray-300 text-sm mb-2 line-clamp-3 leading-relaxed">
                                {note.content.split("\n")[0].substring(0, 120)}
                                {note.content.length > 120 ? "..." : ""}
                              </div>
                              <div className="flex items-center justify-between text-xs text-gray-400">
                                <span className="bg-indigo-900/50 px-2 py-1 rounded-full">
                                  {note.template}
                                </span>
                                <span className="text-gray-500">
                                  Click to view
                                </span>
                              </div>
                            </div>
                            <div className="mt-3 flex justify-end">
                              <button
                                onClick={async (e) => {
                                  e.stopPropagation();
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
                                      if (mode === "db" && user) {
                                        console.log(
                                          "Deleting note from Supabase:",
                                          note.id
                                        );
                                        const { error } = await supabase
                                          .from("notes")
                                          .delete()
                                          .eq("id", note.id);
                                        if (error)
                                          console.error(
                                            "Supabase delete error:",
                                            error
                                          );
                                      } else if (mode === "cloud") {
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
                                    if (mode === "db" && user) {
                                      console.log(
                                        "Deleting note from Supabase:",
                                        note.id
                                      );
                                      const { error } = await supabase
                                        .from("notes")
                                        .delete()
                                        .eq("id", note.id);
                                      if (error)
                                        console.error(
                                          "Supabase delete error:",
                                          error
                                        );
                                    } else if (mode === "cloud") {
                                      localStorage.setItem(
                                        `elysium_notes_${mode}`,
                                        JSON.stringify(updatedNotes)
                                      );
                                    }
                                  }
                                }}
                                className="text-red-400 hover:text-red-300 transition-colors duration-200 text-sm opacity-0 group-hover:opacity-100"
                                disabled={false}
                              >
                                Delete
                              </button>
                            </div>
                          </animated.div>
                        ))}
                      </div>
                    ) : searchQuery ? (
                      <div className="text-center py-12">
                        <p className="text-gray-400 text-sm">
                          No notes found matching "{searchQuery}"
                        </p>
                      </div>
                    ) : (
                      <div className="text-center py-12">
                        <p className="text-gray-400 text-sm">
                          Enter a search term to find notes
                        </p>
                      </div>
                    );
                  })()}
                </>
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
                      setActivePage("recent");
                    }}
                    mode={mode}
                  />
                </div>
              </div>
            )}
          </div>

          {/* Note Viewing/Editing Modal */}
          {viewingNote && (
            <div className="fixed inset-0 bg-black bg-opacity-80 flex items-center justify-center z-50 p-4">
              <div className="w-full max-w-4xl max-h-[90vh] overflow-hidden">
                <div className="bg-gradient-to-br from-indigo-900/95 via-indigo-800/95 to-purple-700/95 backdrop-blur-lg border border-indigo-500/50 rounded-xl shadow-[0_0_30px_rgba(79,70,229,0.3)] overflow-hidden">
                  {editingNote ? (
                    // Edit Mode
                    <div className="p-6 space-y-6 max-h-[90vh] overflow-y-auto">
                      <div className="flex justify-between items-center">
                        <h2 className="text-2xl font-semibold text-gold-100">
                          Edit Note
                        </h2>
                        <button
                          onClick={() => {
                            setEditingNote(null);
                            setViewingNote(null);
                            setEditTitle("");
                            setEditContent("");
                            setEditTemplate("Auto");
                          }}
                          className="text-gray-400 hover:text-white transition-colors"
                        >
                          ✕
                        </button>
                      </div>

                      <div className="space-y-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-200 mb-2">
                            Note Title
                          </label>
                          <input
                            type="text"
                            value={editTitle}
                            onChange={(e) => setEditTitle(e.target.value)}
                            className="w-full p-3 bg-indigo-950/80 border border-indigo-700/50 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-400"
                          />
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-gray-200 mb-2">
                            Note Content
                          </label>
                          <textarea
                            value={editContent}
                            onChange={(e) => setEditContent(e.target.value)}
                            className="w-full p-4 bg-indigo-950/80 border border-indigo-700/50 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-400 h-64 resize-none"
                          />
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-gray-200 mb-2">
                            Template
                          </label>
                          <select
                            value={editTemplate}
                            onChange={(e) => setEditTemplate(e.target.value)}
                            className="p-3 bg-indigo-950/80 border border-indigo-700/50 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-indigo-400"
                          >
                            <option value="Auto">Auto</option>
                            <option value="To-Do List">To-Do List</option>
                            <option value="Checklist">Checklist</option>
                            <option value="List">List</option>
                            <option value="Canvas">Canvas</option>
                          </select>
                        </div>
                      </div>

                      <div className="flex justify-end space-x-4">
                        <button
                          onClick={() => {
                            setEditingNote(null);
                            setEditTitle("");
                            setEditContent("");
                            setEditTemplate("Auto");
                          }}
                          className="px-4 py-2 bg-gray-700/80 text-white rounded-lg hover:bg-gray-600/80 transition-colors"
                        >
                          Cancel
                        </button>
                        <button
                          onClick={async () => {
                            if (editTitle && editContent && editingNote) {
                              const updatedNote: Note = {
                                ...editingNote,
                                title: editTitle,
                                content: editContent,
                                template: editTemplate,
                                updatedAt: new Date().toISOString(),
                              };

                              const updatedNotes = notes.map((n) =>
                                n.id === editingNote.id ? updatedNote : n
                              );
                              setNotes(updatedNotes);

                              // Update in database if db mode
                              if (mode === "db" && user) {
                                const session = (
                                  await supabase.auth.getSession()
                                ).data.session;
                                if (session) {
                                  const key = await deriveKey(
                                    session.access_token
                                  );
                                  const encTitle = await encryptData(
                                    editTitle,
                                    key
                                  );
                                  const encContent = await encryptData(
                                    editContent,
                                    key
                                  );

                                  const { error } = await supabase
                                    .from("notes")
                                    .update({
                                      title: JSON.stringify(encTitle),
                                      content: JSON.stringify(encContent),
                                      template: editTemplate,
                                    })
                                    .eq("id", editingNote.id);

                                  if (error) {
                                    console.error(
                                      "Supabase update error:",
                                      error
                                    );
                                    alert("Failed to update note in database.");
                                  }
                                }
                              } else if (mode === "cloud") {
                                localStorage.setItem(
                                  `elysium_notes_${mode}`,
                                  JSON.stringify(updatedNotes)
                                );
                              }

                              setEditingNote(null);
                              setViewingNote(null);
                              setEditTitle("");
                              setEditContent("");
                              setEditTemplate("Auto");
                            }
                          }}
                          className="px-6 py-2 bg-gradient-to-r from-cyan-500 to-blue-700 text-white font-bold rounded-full hover:from-cyan-600 hover:to-blue-800 transition-all"
                        >
                          Save Changes
                        </button>
                      </div>
                    </div>
                  ) : (
                    // View Mode
                    <div className="max-h-[90vh] overflow-hidden flex flex-col">
                      <div className="p-6 border-b border-indigo-600/30">
                        <div className="flex justify-between items-start">
                          <div className="flex-1">
                            <h2 className="text-2xl sm:text-3xl font-semibold text-gold-100 font-serif mb-2 leading-tight">
                              {viewingNote.title}
                            </h2>
                            <div className="flex items-center space-x-4 text-sm text-gray-400">
                              <span className="bg-indigo-900/50 px-3 py-1 rounded-full">
                                {viewingNote.template}
                              </span>
                              {viewingNote.isPermanent && (
                                <span className="bg-amber-900/50 px-3 py-1 rounded-full text-amber-300">
                                  ⛓️ Blockchain Stored
                                </span>
                              )}
                            </div>
                          </div>
                          <div className="flex space-x-2 ml-4">
                            <button
                              onClick={() => {
                                setEditingNote(viewingNote);
                                setEditTitle(viewingNote.title);
                                setEditContent(viewingNote.content);
                                setEditTemplate(viewingNote.template);
                              }}
                              className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-500 transition-colors"
                            >
                              Edit
                            </button>
                            <button
                              onClick={() => {
                                setViewingNote(null);
                              }}
                              className="text-gray-400 hover:text-white transition-colors text-xl p-2"
                            >
                              ✕
                            </button>
                          </div>
                        </div>
                      </div>
                      <div className="flex-1 overflow-y-auto p-6">
                        <div className="text-white text-base leading-relaxed">
                          {viewingNote.template === "To-Do List" ||
                          viewingNote.template === "Checklist" ||
                          viewingNote.template === "List" ? (
                            <div className="space-y-1">
                              {renderList(
                                viewingNote.id,
                                viewingNote.content,
                                viewingNote.template,
                                notes,
                                (updatedNotes) => {
                                  // Update the viewing note when changes are made
                                  const notesArray = Array.isArray(updatedNotes)
                                    ? updatedNotes
                                    : updatedNotes(notes);
                                  const updatedViewingNote = notesArray.find(
                                    (n) => n.id === viewingNote.id
                                  );
                                  if (updatedViewingNote) {
                                    setViewingNote(updatedViewingNote);
                                  }
                                  setNotes(updatedNotes);
                                },
                                viewingNote.isPermanent || false
                              )}
                            </div>
                          ) : (
                            <div className="whitespace-pre-wrap">
                              {viewingNote.content}
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="flex justify-end">
                        <button
                          onClick={() => setViewingNote(null)}
                          className="px-6 py-2 bg-gradient-to-r from-indigo-600 to-purple-700 text-white rounded-full hover:from-indigo-700 hover:to-purple-800 transition-all"
                        >
                          Close
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </>
  );
}

export default App;
