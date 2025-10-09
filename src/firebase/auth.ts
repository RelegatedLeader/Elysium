import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signInWithPopup,
  GoogleAuthProvider,
  signOut,
  onAuthStateChanged,
  User,
  UserCredential,
} from "firebase/auth";
import { auth } from "./config";

export class FirebaseAuthService {
  private googleProvider = new GoogleAuthProvider();

  // Email/Password Authentication
  async signUp(email: string, password: string): Promise<UserCredential> {
    if (!auth) throw new Error("Firebase not configured");
    return await createUserWithEmailAndPassword(auth, email, password);
  }

  async signIn(email: string, password: string): Promise<UserCredential> {
    if (!auth) throw new Error("Firebase not configured");
    return await signInWithEmailAndPassword(auth, email, password);
  }

  // Google Authentication
  async signInWithGoogle(): Promise<UserCredential> {
    if (!auth) throw new Error("Firebase not configured");
    return await signInWithPopup(auth, this.googleProvider);
  }

  // Sign Out
  async signOut(): Promise<void> {
    if (!auth) throw new Error("Firebase not configured");
    return await signOut(auth);
  }

  // Auth State Observer
  onAuthStateChange(callback: (user: User | null) => void): () => void {
    if (!auth) {
      // Return a no-op function if auth is not available
      console.warn("Firebase auth not available, returning no-op listener");
      return () => {};
    }
    return onAuthStateChanged(auth, callback);
  }

  // Get current user
  getCurrentUser(): User | null {
    if (!auth) return null;
    return auth.currentUser;
  }
}

export const firebaseAuth = new FirebaseAuthService();
