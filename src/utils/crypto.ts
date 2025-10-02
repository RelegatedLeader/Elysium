import nacl from "tweetnacl";
import snappy from "snappyjs";

// Derive a key pair deterministically from the public key (simplified)
export const deriveKeyPair = (publicKey: Uint8Array): nacl.BoxKeyPair => {
  // Use a hash of the public key as a seed (simplified; in production, use wallet's private key)
  const seed = nacl.hash(publicKey).slice(0, 32); // 32 bytes for seed
  const keyPair = nacl.box.keyPair(); // Generate a new key pair
  // Overwrite secret key with a deterministic derivation (for demo; replace with secure method later)
  // Browser-compatible concatenation of Uint8Arrays
  const combined = new Uint8Array(seed.length + publicKey.length);
  combined.set(seed);
  combined.set(publicKey, seed.length);
  keyPair.secretKey = nacl.hash(combined).slice(0, 32);
  return keyPair;
};

// Encrypt note content
export const encryptNote = (
  content: string,
  publicKey: Uint8Array,
  nonce: Uint8Array
): Uint8Array => {
  const keyPair = deriveKeyPair(publicKey);
  const messageUint8 = new TextEncoder().encode(content);
  const encrypted = nacl.box(messageUint8, nonce, publicKey, keyPair.secretKey);
  if (!encrypted) throw new Error("Encryption failed");
  const compressed = snappy.compress(encrypted); // snappyjs compress returns Uint8Array directly
  return compressed;
};

// Decrypt note content
export const decryptNote = (
  encryptedContent: Uint8Array,
  publicKey: Uint8Array,
  nonce: Uint8Array
): string => {
  const keyPair = deriveKeyPair(publicKey);
  const decompressed = snappy.uncompress(encryptedContent); // snappyjs uncompress returns Uint8Array
  const decrypted = nacl.box.open(
    decompressed,
    nonce,
    publicKey,
    keyPair.secretKey
  );
  if (!decrypted) throw new Error("Decryption failed");
  return new TextDecoder().decode(decrypted);
};

// Generate a random nonce for encryption
export const generateNonce = (): Uint8Array =>
  nacl.randomBytes(nacl.box.nonceLength);

// Example usage (for testing)
export const encryptAndCompress = (
  content: string,
  publicKey: Uint8Array
): { encrypted: Uint8Array; nonce: Uint8Array } => {
  const nonce = generateNonce();
  const encrypted = encryptNote(content, publicKey, nonce);
  return { encrypted, nonce };
};
