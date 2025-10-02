import { firebaseAuth, FirebaseAuthService } from './auth';
import { firebaseFirestore, FirebaseFirestoreService, CloudNote } from './firestore';
import { firebaseStorage, FirebaseStorageService } from './storage';

export interface CloudNoteWithMetadata extends CloudNote {
  attachments?: string[]; // Array of storage paths
  downloadUrl?: string; // For public notes
}

export class FirebaseService {
  public auth: FirebaseAuthService;
  public firestore: FirebaseFirestoreService;
  public storage: FirebaseStorageService;

  constructor() {
    this.auth = firebaseAuth;
    this.firestore = firebaseFirestore;
    this.storage = firebaseStorage;
  }

  // Unified note operations with attachments
  async createNoteWithAttachments(
    note: Omit<CloudNote, 'id' | 'createdAt' | 'updatedAt'>,
    attachments?: File[]
  ): Promise<string> {
    if (!this.auth || !this.firestore || !this.storage) throw new Error('Firebase not configured');
    const user = this.auth.getCurrentUser();
    if (!user) throw new Error('User must be authenticated');

    // Create the note first
    const noteId = await this.firestore.createNote(note);

    // Upload attachments if provided
    if (attachments && attachments.length > 0) {
      const attachmentPaths: string[] = [];
      for (const file of attachments) {
        const uploadResult = await this.storage.uploadFile(user.uid, file);
        attachmentPaths.push(uploadResult.path);
      }

      // Update note with attachment references
      await this.firestore.updateNote(noteId, {
        // Store attachment paths in a custom field or extend the note interface
        // For now, we'll handle this in the component layer
      });
    }

    return noteId;
  }

  // Download note as file
  async downloadNoteAsFile(noteId: string, format: 'txt' | 'md' = 'md'): Promise<void> {
    if (!this.auth || !this.firestore || !this.storage) throw new Error('Firebase not configured');
    const note = await this.firestore.getNote(noteId);
    if (!note) throw new Error('Note not found');

    const user = this.auth.getCurrentUser();
    if (!user) throw new Error('User must be authenticated');

    // Increment download count for public notes
    if (note.isPublic) {
      await this.firestore.incrementDownloadCount(noteId);
    }

    // Create file content
    const fileContent = format === 'md'
      ? `# ${note.title}\n\n${note.content}`
      : `${note.title}\n\n${note.content}`;

    // Upload as file and get download URL
    const uploadResult = await this.storage.uploadNoteAsFile(
      user.uid,
      note.title,
      fileContent,
      format
    );

    // Trigger download
    const link = document.createElement('a');
    link.href = uploadResult.url;
    link.download = `${note.title}.${format}`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  // Get user's storage usage
  async getStorageUsage(userId: string): Promise<{ used: number; limit: number }> {
    if (!this.storage) throw new Error('Firebase not configured');
    try {
      const files = await this.storage.listUserFiles(userId);
      // Note: Firebase Storage doesn't provide direct size calculation in web SDK
      // You'd need to track sizes in Firestore or use Firebase Admin SDK on backend
      return {
        used: 0, // Placeholder - implement actual calculation
        limit: 5 * 1024 * 1024 * 1024, // 5GB free limit
      };
    } catch (error) {
      console.error('Error getting storage usage:', error);
      return { used: 0, limit: 5 * 1024 * 1024 * 1024 };
    }
  }

  // Check if user can upload more files
  async canUploadMore(userId: string, fileSize: number): Promise<boolean> {
    if (!this.storage) throw new Error('Firebase not configured');
    const usage = await this.getStorageUsage(userId);
    return (usage.used + fileSize) <= usage.limit;
  }

  // Clean up user's old files (for free tier management)
  async cleanupOldFiles(userId: string, keepLast: number = 100): Promise<void> {
    if (!this.storage) throw new Error('Firebase not configured');
    try {
      const files = await this.storage.listUserFiles(userId);
      if (files.length <= keepLast) return;

      // Sort by name (which includes timestamp) and delete oldest
      const sortedFiles = files.sort((a, b) => a.name.localeCompare(b.name));
      const filesToDelete = sortedFiles.slice(0, files.length - keepLast);

      for (const file of filesToDelete) {
        await this.storage.deleteFile(file.fullPath);
      }
    } catch (error) {
      console.error('Error cleaning up old files:', error);
    }
  }
}

export const firebaseService = new FirebaseService();
export type { CloudNote };