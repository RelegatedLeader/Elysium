import {
  collection,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  getDoc,
  getDocs,
  query,
  where,
  orderBy,
  limit,
  Timestamp,
  onSnapshot,
  QuerySnapshot,
  DocumentData
} from 'firebase/firestore';
import { db } from './config';
import { encryptAndCompress, decryptNote, encryptNote } from '../utils/crypto';

export interface CloudNote {
  id?: string;
  title: string;
  content: string;
  template?: string;
  tags?: string[];
  createdAt: Timestamp;
  updatedAt: Timestamp;
  userId: string;
  isPublic?: boolean;
  downloadCount?: number;
  // Encrypted fields stored in Firestore
  encryptedTitle?: string;
  encryptedContent?: string;
  encryptedTemplate?: string;
  encryptedTags?: string;
  nonce?: string; // Base64 encoded nonce
}

export class FirebaseFirestoreService {
  private notesCollection = 'notes';

  // Helper method to get deterministic public key from user ID
  private getUserPublicKey(userId: string): Uint8Array {
    // Use the user ID as a deterministic seed for encryption
    const encoder = new TextEncoder();
    const data = encoder.encode(userId);
    const hash = new Uint8Array(32); // 32 bytes for public key

    // Simple hash function (in production, use a proper crypto hash)
    for (let i = 0; i < data.length; i++) {
      hash[i % 32] ^= data[i];
    }

    return hash;
  }

  // Encrypt note data before storing
  private encryptNoteData(note: Omit<CloudNote, 'id' | 'createdAt' | 'updatedAt'>): {
    encryptedTitle: string;
    encryptedContent: string;
    encryptedTemplate?: string;
    encryptedTags?: string;
    nonce: string;
  } {
    const publicKey = this.getUserPublicKey(note.userId);

    // Generate one nonce for all fields
    const nonce = crypto.getRandomValues(new Uint8Array(24)); // 24 bytes for NaCl nonce

    // Encrypt each field using the same nonce
    const titleResult = encryptNote(note.title, publicKey, nonce);
    const contentResult = encryptNote(note.content, publicKey, nonce);
    const templateResult = note.template ? encryptNote(note.template, publicKey, nonce) : null;
    const tagsResult = note.tags && note.tags.length > 0 ? encryptNote(JSON.stringify(note.tags), publicKey, nonce) : null;

    const result: any = {
      encryptedTitle: btoa(String.fromCharCode.apply(null, Array.from(titleResult))),
      encryptedContent: btoa(String.fromCharCode.apply(null, Array.from(contentResult))),
      nonce: btoa(String.fromCharCode.apply(null, Array.from(nonce)))
    };

    // Only include optional encrypted fields if they exist
    if (templateResult) {
      result.encryptedTemplate = btoa(String.fromCharCode.apply(null, Array.from(templateResult)));
    }
    if (tagsResult) {
      result.encryptedTags = btoa(String.fromCharCode.apply(null, Array.from(tagsResult)));
    }

    return result;
  }

  // Decrypt note data after retrieving
  private decryptNoteData(encryptedNote: any): CloudNote {
    const publicKey = this.getUserPublicKey(encryptedNote.userId);
    const nonce = new Uint8Array(Array.from(atob(encryptedNote.nonce)).map(c => c.charCodeAt(0)));

    // Decrypt each field
    const title = decryptNote(
      new Uint8Array(Array.from(atob(encryptedNote.encryptedTitle)).map(c => c.charCodeAt(0))),
      publicKey,
      nonce
    );
    const content = decryptNote(
      new Uint8Array(Array.from(atob(encryptedNote.encryptedContent)).map(c => c.charCodeAt(0))),
      publicKey,
      nonce
    );
    const template = encryptedNote.encryptedTemplate ? decryptNote(
      new Uint8Array(Array.from(atob(encryptedNote.encryptedTemplate)).map(c => c.charCodeAt(0))),
      publicKey,
      nonce
    ) : undefined;
    const tags = encryptedNote.encryptedTags ? JSON.parse(decryptNote(
      new Uint8Array(Array.from(atob(encryptedNote.encryptedTags)).map(c => c.charCodeAt(0))),
      publicKey,
      nonce
    )) : undefined;

    return {
      id: encryptedNote.id,
      title,
      content,
      template,
      tags,
      createdAt: encryptedNote.createdAt,
      updatedAt: encryptedNote.updatedAt,
      userId: encryptedNote.userId,
      isPublic: encryptedNote.isPublic,
      downloadCount: encryptedNote.downloadCount
    };
  }

  // Create a new note
  async createNote(note: Omit<CloudNote, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> {
    if (!db) throw new Error('Firebase not configured');
    const now = Timestamp.now();

    // Encrypt the note data
    const encryptedData = this.encryptNoteData(note);

    const noteData = {
      ...encryptedData,
      userId: note.userId,
      isPublic: note.isPublic || false,
      downloadCount: note.downloadCount || 0,
      createdAt: now,
      updatedAt: now,
    };

    const docRef = await addDoc(collection(db, this.notesCollection), noteData);
    return docRef.id;
  }

  // Update an existing note
  async updateNote(noteId: string, updates: Partial<Omit<CloudNote, 'id' | 'createdAt'>>): Promise<void> {
    if (!db) throw new Error('Firebase not configured');
    const noteRef = doc(db, this.notesCollection, noteId);

    // Get the current note to access the nonce
    const currentNote = await this.getNote(noteId);
    if (!currentNote) throw new Error('Note not found');

    const updateData: any = {
      updatedAt: Timestamp.now(),
    };

    // Encrypt fields that need encryption
    if (updates.title !== undefined) {
      const publicKey = this.getUserPublicKey(currentNote.userId);
      const nonce = new Uint8Array(Array.from(atob((await getDoc(noteRef)).data()?.nonce || '')).map(c => c.charCodeAt(0)));
      const { encrypted } = encryptAndCompress(updates.title, publicKey);
      updateData.encryptedTitle = btoa(String.fromCharCode.apply(null, Array.from(encrypted)));
    }

    if (updates.content !== undefined) {
      const publicKey = this.getUserPublicKey(currentNote.userId);
      const nonce = new Uint8Array(Array.from(atob((await getDoc(noteRef)).data()?.nonce || '')).map(c => c.charCodeAt(0)));
      const { encrypted } = encryptAndCompress(updates.content, publicKey);
      updateData.encryptedContent = btoa(String.fromCharCode.apply(null, Array.from(encrypted)));
    }

    if (updates.template !== undefined) {
      if (updates.template) {
        const publicKey = this.getUserPublicKey(currentNote.userId);
        const nonce = new Uint8Array(Array.from(atob((await getDoc(noteRef)).data()?.nonce || '')).map(c => c.charCodeAt(0)));
        const { encrypted } = encryptAndCompress(updates.template, publicKey);
        updateData.encryptedTemplate = btoa(String.fromCharCode.apply(null, Array.from(encrypted)));
      } else {
        updateData.encryptedTemplate = null;
      }
    }

    if (updates.tags !== undefined) {
      if (updates.tags) {
        const publicKey = this.getUserPublicKey(currentNote.userId);
        const nonce = new Uint8Array(Array.from(atob((await getDoc(noteRef)).data()?.nonce || '')).map(c => c.charCodeAt(0)));
        const { encrypted } = encryptAndCompress(JSON.stringify(updates.tags), publicKey);
        updateData.encryptedTags = btoa(String.fromCharCode.apply(null, Array.from(encrypted)));
      } else {
        updateData.encryptedTags = null;
      }
    }

    // Add non-encrypted fields
    if (updates.isPublic !== undefined) updateData.isPublic = updates.isPublic;
    if (updates.downloadCount !== undefined) updateData.downloadCount = updates.downloadCount;

    await updateDoc(noteRef, updateData);
  }

  // Delete a note
  async deleteNote(noteId: string): Promise<void> {
    if (!db) throw new Error('Firebase not configured');
    const noteRef = doc(db, this.notesCollection, noteId);
    await deleteDoc(noteRef);
  }

  // Get a single note
  async getNote(noteId: string): Promise<CloudNote | null> {
    if (!db) throw new Error('Firebase not configured');
    const noteRef = doc(db, this.notesCollection, noteId);
    const noteSnap = await getDoc(noteRef);

    if (noteSnap.exists()) {
      const data = noteSnap.data();
      // Decrypt the note data
      return this.decryptNoteData({
        id: noteSnap.id,
        ...data,
      });
    }

    return null;
  }

  // Get all notes for a user
  async getUserNotes(userId: string): Promise<CloudNote[]> {
    if (!db) throw new Error('Firebase not configured');
    const q = query(
      collection(db, this.notesCollection),
      where('userId', '==', userId),
      orderBy('updatedAt', 'desc')
    );

    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(doc => {
      const data = doc.data();
      // Decrypt the note data
      return this.decryptNoteData({
        id: doc.id,
        ...data,
      });
    });
  }

  // Get public notes (for free downloads)
  async getPublicNotes(limitCount: number = 20): Promise<CloudNote[]> {
    if (!db) throw new Error('Firebase not configured');
    const q = query(
      collection(db, this.notesCollection),
      where('isPublic', '==', true),
      orderBy('downloadCount', 'desc'),
      orderBy('updatedAt', 'desc'),
      limit(limitCount)
    );

    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(doc => {
      const data = doc.data();
      // Decrypt the note data
      return this.decryptNoteData({
        id: doc.id,
        ...data,
      });
    });
  }

  // Increment download count
  async incrementDownloadCount(noteId: string): Promise<void> {
    if (!db) throw new Error('Firebase not configured');
    const noteRef = doc(db, this.notesCollection, noteId);
    const noteSnap = await getDoc(noteRef);

    if (noteSnap.exists()) {
      const currentCount = noteSnap.data().downloadCount || 0;
      await updateDoc(noteRef, {
        downloadCount: currentCount + 1,
        updatedAt: Timestamp.now(),
      });
    }
  }

  // Real-time listener for user notes
  onUserNotesChange(userId: string, callback: (notes: CloudNote[]) => void): () => void {
    if (!db) {
      console.warn('Firebase db not available, returning no-op listener');
      return () => {};
    }
    const q = query(
      collection(db, this.notesCollection),
      where('userId', '==', userId),
      orderBy('updatedAt', 'desc')
    );

    return onSnapshot(q, (querySnapshot: QuerySnapshot<DocumentData>) => {
      const notes = querySnapshot.docs.map(doc => {
        const data = doc.data();
        // Decrypt the note data
        return this.decryptNoteData({
          id: doc.id,
          ...data,
        });
      });
      callback(notes);
    });
  }

  // Search notes by title or content
  async searchNotes(userId: string, searchTerm: string): Promise<CloudNote[]> {
    if (!db) throw new Error('Firebase not configured');
    // Note: Firestore doesn't support full-text search natively
    // This is a basic implementation - you might want to use Algolia or ElasticSearch for better search
    const userNotes = await this.getUserNotes(userId);

    const lowerSearchTerm = searchTerm.toLowerCase();
    return userNotes.filter(note =>
      note.title.toLowerCase().includes(lowerSearchTerm) ||
      note.content.toLowerCase().includes(lowerSearchTerm) ||
      note.tags?.some(tag => tag.toLowerCase().includes(lowerSearchTerm))
    );
  }
}

export const firebaseFirestore = new FirebaseFirestoreService();