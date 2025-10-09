import {
  ref,
  uploadBytes,
  getDownloadURL,
  deleteObject,
  listAll,
  UploadResult,
  StorageReference,
} from "firebase/storage";
import { storage } from "./config";

export class FirebaseStorageService {
  private notesFolder = "notes/";

  // Upload a file to Firebase Storage
  async uploadFile(
    userId: string,
    file: File,
    fileName?: string
  ): Promise<{ url: string; path: string }> {
    if (!storage) throw new Error("Firebase not configured");
    const timestamp = Date.now();
    const safeFileName =
      fileName || `${timestamp}_${file.name.replace(/[^a-zA-Z0-9.]/g, "_")}`;
    const filePath = `${this.notesFolder}${userId}/${safeFileName}`;

    const storageRef = ref(storage, filePath);
    const uploadResult: UploadResult = await uploadBytes(storageRef, file);

    const downloadURL = await getDownloadURL(uploadResult.ref);

    return {
      url: downloadURL,
      path: filePath,
    };
  }

  // Download a file from Firebase Storage
  async downloadFile(filePath: string): Promise<string> {
    if (!storage) throw new Error("Firebase not configured");
    const storageRef = ref(storage, filePath);
    return await getDownloadURL(storageRef);
  }

  // Delete a file from Firebase Storage
  async deleteFile(filePath: string): Promise<void> {
    if (!storage) throw new Error("Firebase not configured");
    const storageRef = ref(storage, filePath);
    await deleteObject(storageRef);
  }

  // List all files for a user
  async listUserFiles(userId: string): Promise<StorageReference[]> {
    if (!storage) throw new Error("Firebase not configured");
    const userFolderRef = ref(storage, `${this.notesFolder}${userId}/`);
    const result = await listAll(userFolderRef);
    return result.items;
  }

  // Upload note as text file
  async uploadNoteAsFile(
    userId: string,
    noteTitle: string,
    noteContent: string,
    format: "txt" | "md" = "md"
  ): Promise<{ url: string; path: string }> {
    if (!storage) throw new Error("Firebase not configured");
    const timestamp = Date.now();
    const safeTitle = noteTitle.replace(/[^a-zA-Z0-9]/g, "_");
    const fileName = `${safeTitle}_${timestamp}.${format}`;

    // Create blob from content
    const blob = new Blob([noteContent], { type: "text/plain" });
    const file = new File([blob], fileName, { type: "text/plain" });

    return await this.uploadFile(userId, file, fileName);
  }

  // Get file metadata (size, type, etc.)
  async getFileMetadata(filePath: string): Promise<any> {
    if (!storage) throw new Error("Firebase not configured");
    // Note: Firebase Storage doesn't provide direct metadata access in web SDK
    // You might need to store metadata in Firestore alongside file references
    return {
      path: filePath,
      // Add custom metadata storage in Firestore if needed
    };
  }

  // Generate signed URL for temporary access (if needed)
  async generateSignedUrl(
    filePath: string,
    expirationTime: number = 3600
  ): Promise<string> {
    if (!storage) throw new Error("Firebase not configured");
    // Firebase Storage web SDK doesn't support signed URLs directly
    // Use download URL with security rules instead
    return await this.downloadFile(filePath);
  }
}

export const firebaseStorage = new FirebaseStorageService();
