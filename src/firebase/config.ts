// Firebase configuration
import { initializeApp } from "firebase/app";
import {
  getAuth,
  setPersistence,
  browserLocalPersistence,
} from "firebase/auth";
import { getFirestore, enableIndexedDbPersistence } from "firebase/firestore";
import { getStorage } from "firebase/storage";

const firebaseConfig = {
  apiKey: "AIzaSyA_FZyRy_p1QNX0giy53UK3OzGKVXROEFE",
  authDomain: "elysium-ef45c.firebaseapp.com",
  projectId: "elysium-ef45c",
  storageBucket: "elysium-ef45c.firebasestorage.app",
  messagingSenderId: "438129451511",
  appId: "1:438129451511:web:2207b9e739b961682b4ef2"
};

// Validate Firebase configuration
const isFirebaseConfigured = () => {
  const hasValidApiKey = firebaseConfig.apiKey &&
    firebaseConfig.apiKey !== "demo-api-key" &&
    firebaseConfig.apiKey !== "your_firebase_api_key_here" &&
    firebaseConfig.apiKey.startsWith("AIzaSy");

  const hasValidDomain = firebaseConfig.authDomain &&
    firebaseConfig.authDomain !== "demo-project.firebaseapp.com" &&
    firebaseConfig.authDomain !== "your-project.firebaseapp.com" &&
    firebaseConfig.authDomain.includes("firebaseapp.com");

  const hasValidProject = firebaseConfig.projectId &&
    firebaseConfig.projectId !== "demo-project" &&
    firebaseConfig.projectId !== "your-project-id" &&
    firebaseConfig.projectId === "elysium-ef45c";

  return hasValidApiKey && hasValidDomain && hasValidProject;
};

// Initialize Firebase only if properly configured
let app: any = null;
let auth: any = null;
let db: any = null;
let storage: any = null;

if (isFirebaseConfigured()) {
  try {
    app = initializeApp(firebaseConfig);
    auth = getAuth(app);
    // Set persistence to maintain auth state across browser sessions
    setPersistence(auth, browserLocalPersistence);
    db = getFirestore(app);

    // Enable offline persistence for Firestore
    enableIndexedDbPersistence(db).catch((err) => {
      if (err.code === "failed-precondition") {
        console.warn(
          "Multiple tabs open, persistence can only be enabled in one tab at a time."
        );
      } else if (err.code === "unimplemented") {
        console.warn(
          "The current browser does not support all of the features required to enable persistence"
        );
      }
    });

    storage = getStorage(app);
    console.log("Firebase initialized successfully");
  } catch (error) {
    console.error("Firebase initialization failed:", error);
    // Reset services to null on failure
    auth = null;
    db = null;
    storage = null;
  }
} else {
  console.warn(
    "Firebase not configured properly. Please set up your Firebase project and update the environment variables in Netlify dashboard:"
  );
  console.warn("- REACT_APP_FIREBASE_API_KEY");
  console.warn("- REACT_APP_FIREBASE_AUTH_DOMAIN");
  console.warn("- REACT_APP_FIREBASE_PROJECT_ID");
  console.warn("- REACT_APP_FIREBASE_STORAGE_BUCKET");
  console.warn("- REACT_APP_FIREBASE_MESSAGING_SENDER_ID");
  console.warn("- REACT_APP_FIREBASE_APP_ID");
  console.warn("- REACT_APP_FIREBASE_MEASUREMENT_ID (optional)");
}

export { auth, db, storage };
export default app;
