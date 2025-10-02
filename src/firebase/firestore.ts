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
}

export class FirebaseFirestoreService {
  private notesCollection = 'notes';

  // Create a new note
  async createNote(note: Omit<CloudNote, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> {
    if (!db) throw new Error('Firebase not configured');
    const now = Timestamp.now();
    const noteData = {
      ...note,
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
    const updateData = {
      ...updates,
      updatedAt: Timestamp.now(),
    };

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
      return {
        id: noteSnap.id,
        ...noteSnap.data(),
      } as CloudNote;
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
    return querySnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
    } as CloudNote));
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
    return querySnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
    } as CloudNote));
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
      const notes = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
      } as CloudNote));
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