import { useState, useEffect, useCallback } from "react";
import { firebaseService, CloudNote } from "../firebase";
import { User } from "firebase/auth";

// Check if Firebase is configured
const isFirebaseAvailable = () => {
  try {
    // Try to access Firebase services - if they're null, Firebase isn't configured
    return !!(
      firebaseService.auth &&
      firebaseService.firestore &&
      firebaseService.storage
    );
  } catch {
    return false;
  }
};

interface UseCloudStorageReturn {
  user: User | null;
  notes: CloudNote[];
  loading: boolean;
  error: string | null;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string) => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
  createNote: (
    note: Omit<CloudNote, "id" | "createdAt" | "updatedAt" | "userId">
  ) => Promise<void>;
  updateNote: (noteId: string, updates: Partial<CloudNote>) => Promise<void>;
  deleteNote: (noteId: string) => Promise<void>;
  downloadNote: (noteId: string, format?: "txt" | "md") => Promise<void>;
  getPublicNotes: () => Promise<CloudNote[]>;
  makeNotePublic: (noteId: string, isPublic: boolean) => Promise<void>;
}

export const useCloudStorage = (): UseCloudStorageReturn => {
  const [user, setUser] = useState<User | null>(null);
  const [notes, setNotes] = useState<CloudNote[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const firebaseAvailable = isFirebaseAvailable();

  // Initialize auth state listener only if Firebase is available
  useEffect(() => {
    if (!firebaseAvailable) {
      setLoading(false);
      setError("Firebase not configured. Please set up your Firebase project and configure environment variables in Netlify dashboard.");
      return;
    }

    const unsubscribe = firebaseService.auth.onAuthStateChange(
      (firebaseUser) => {
        setUser(firebaseUser);
        setLoading(false);
      }
    );

    return unsubscribe;
  }, [firebaseAvailable]);

  // Load user notes when user changes
  useEffect(() => {
    if (!user) {
      console.log("useCloudStorage: No user, clearing notes");
      setNotes([]);
      return;
    }

    console.log("useCloudStorage: Loading notes for user:", user.uid);

    const loadNotes = async () => {
      try {
        setLoading(true);
        const userNotes = await firebaseService.firestore.getUserNotes(
          user.uid
        );
        console.log(
          "useCloudStorage: Loaded notes from Firebase:",
          userNotes.length
        );
        setNotes(userNotes);
      } catch (err) {
        console.error("useCloudStorage: Failed to load notes:", err);
        setError(err instanceof Error ? err.message : "Failed to load notes");
      } finally {
        setLoading(false);
      }
    };

    loadNotes();

    // Set up real-time listener
    const unsubscribe = firebaseService.firestore.onUserNotesChange(
      user.uid,
      (updatedNotes) => {
        console.log(
          "useCloudStorage: Real-time update, notes count:",
          updatedNotes.length
        );
        setNotes(updatedNotes);
      }
    );

    return unsubscribe;
  }, [user]);

  const signIn = useCallback(
    async (email: string, password: string) => {
      if (!firebaseAvailable) {
        throw new Error(
          "Firebase not configured. Please set up your Firebase project."
        );
      }
      try {
        setError(null);
        await firebaseService.auth.signIn(email, password);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Sign in failed");
        throw err;
      }
    },
    [firebaseAvailable]
  );

  const signUp = useCallback(
    async (email: string, password: string) => {
      if (!firebaseAvailable) {
        throw new Error(
          "Firebase not configured. Please set up your Firebase project."
        );
      }
      try {
        setError(null);
        await firebaseService.auth.signUp(email, password);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Sign up failed");
        throw err;
      }
    },
    [firebaseAvailable]
  );

  const signInWithGoogle = useCallback(async () => {
    if (!firebaseAvailable) {
      throw new Error(
        "Firebase not configured. Please set up your Firebase project."
      );
    }
    try {
      setError(null);
      await firebaseService.auth.signInWithGoogle();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Google sign in failed");
      throw err;
    }
  }, [firebaseAvailable]);

  const signOut = useCallback(async () => {
    if (!firebaseAvailable) {
      throw new Error(
        "Firebase not configured. Please set up your Firebase project."
      );
    }
    try {
      setError(null);
      await firebaseService.auth.signOut();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sign out failed");
      throw err;
    }
  }, [firebaseAvailable]);

  const createNote = useCallback(
    async (
      noteData: Omit<CloudNote, "id" | "createdAt" | "updatedAt" | "userId">
    ) => {
      if (!firebaseAvailable) {
        throw new Error(
          "Firebase not configured. Please set up your Firebase project."
        );
      }
      if (!user) throw new Error("User must be authenticated");

      console.log("useCloudStorage: Creating note for user:", user.uid);

      try {
        setError(null);
        await firebaseService.firestore.createNote({
          ...noteData,
          userId: user.uid,
        } as Omit<CloudNote, "id" | "createdAt" | "updatedAt">);
        console.log("useCloudStorage: Note created successfully");
      } catch (err) {
        console.error("useCloudStorage: Failed to create note:", err);
        setError(err instanceof Error ? err.message : "Failed to create note");
        throw err;
      }
    },
    [user, firebaseAvailable]
  );

  const updateNote = useCallback(
    async (noteId: string, updates: Partial<CloudNote>) => {
      if (!firebaseAvailable) {
        throw new Error(
          "Firebase not configured. Please set up your Firebase project."
        );
      }
      try {
        setError(null);
        await firebaseService.firestore.updateNote(noteId, updates);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to update note");
        throw err;
      }
    },
    [firebaseAvailable]
  );

  const deleteNote = useCallback(
    async (noteId: string) => {
      if (!firebaseAvailable) {
        throw new Error(
          "Firebase not configured. Please set up your Firebase project."
        );
      }
      try {
        setError(null);
        await firebaseService.firestore.deleteNote(noteId);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to delete note");
        throw err;
      }
    },
    [firebaseAvailable]
  );

  const downloadNote = useCallback(
    async (noteId: string, format: "txt" | "md" = "md") => {
      if (!firebaseAvailable) {
        throw new Error(
          "Firebase not configured. Please set up your Firebase project."
        );
      }
      try {
        setError(null);
        await firebaseService.downloadNoteAsFile(noteId, format);
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Failed to download note"
        );
        throw err;
      }
    },
    [firebaseAvailable]
  );

  const getPublicNotes = useCallback(async (): Promise<CloudNote[]> => {
    if (!firebaseAvailable) {
      throw new Error(
        "Firebase not configured. Please set up your Firebase project."
      );
    }
    try {
      setError(null);
      return await firebaseService.firestore.getPublicNotes();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to load public notes"
      );
      throw err;
    }
  }, [firebaseAvailable]);

  const makeNotePublic = useCallback(
    async (noteId: string, isPublic: boolean) => {
      if (!firebaseAvailable) {
        throw new Error(
          "Firebase not configured. Please set up your Firebase project."
        );
      }
      try {
        setError(null);
        await firebaseService.firestore.updateNote(noteId, { isPublic });
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : "Failed to update note visibility"
        );
        throw err;
      }
    },
    [firebaseAvailable]
  );

  return {
    user,
    notes,
    loading,
    error,
    signIn,
    signUp,
    signInWithGoogle,
    signOut,
    createNote,
    updateNote,
    deleteNote,
    downloadNote,
    getPublicNotes,
    makeNotePublic,
  };
};
