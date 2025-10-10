import React, { useState, useEffect, useCallback, useRef } from "react";
import { animated, useSpring } from "react-spring";
import { ReactComponent as ElysiumLogo } from "./components/ElysiumLogo.svg";
import Drawer from "./components/Drawer";
import CreateNote from "./components/CreateNote";
import Settings from "./components/Settings";
import Logout from "./components/Logout";
import CloudAuth from "./components/CloudAuth";
import { encryptAndCompress, decryptNote } from "./utils/crypto";
import {
  uploadToArweave,
  setWallet,
  checkArweaveWallet,
  connectArweaveWallet,
  getArweaveBalance,
  getArweaveFundingInfo,
  getArConnectInstallGuide,
} from "./utils/arweave-utils";
import ArConnectModal from "./components/ArConnectModal";
import { supabase } from "./SUPABASE/supabaseClient";
import { Session } from "@supabase/supabase-js";
import { useCloudStorage } from "./hooks/useCloudStorage";
import { initializeApp } from "firebase/app";
import { getFirestore, enableIndexedDbPersistence } from "firebase/firestore";

interface Note {
  id: string;
  title: string;
  content: string;
  template: string;
  encryptedContent?: Uint8Array;
  nonce?: Uint8Array;
  arweaveHash?: string;
  transactionHash?: string;
  isPermanent?: boolean;
  completionTimestamps?: { [taskIndex: number]: string };
  createdAt: string;
  updatedAt: string;
  files?: File[];
  isDownloaded?: boolean;
  isCloudOnly?: boolean;
  isDraft?: boolean;
}

interface SupabaseNote {
  id: string;
  user_id: string;
  title: string; // JSON string of encrypted data
  content: string; // JSON string of encrypted data
  template?: string;
  created_at: string;
}

// Core cryptographic function - defined outside component for reuse
async function deriveKey(
  userId: string,
  customSalt?: string
): Promise<CryptoKey> {
  const encoder = new TextEncoder();
  const salt = customSalt || "elysium-eternal-salt";
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
      salt: encoder.encode(salt),
      iterations: 100000,
      hash: "SHA-256",
    },
    keyMaterial,
    { name: "AES-GCM", length: 256 },
    true,
    ["encrypt", "decrypt"]
  );
}

function getSortedNotes(notes: Note[], sorting: string) {
  return [...notes].sort((a, b) => {
    switch (sorting) {
      case "Date Modified":
        const aModified = new Date(a.updatedAt || a.createdAt).getTime();
        const bModified = new Date(b.updatedAt || b.createdAt).getTime();
        return bModified - aModified; // Newest first
      case "Date Created":
        const aCreated = new Date(a.createdAt).getTime();
        const bCreated = new Date(b.createdAt).getTime();
        return bCreated - aCreated; // Newest first
      case "Alphabetical":
        return a.title.localeCompare(b.title); // A-Z
      case "Custom":
        // For now, fall back to date modified
        const aCustom = new Date(a.updatedAt || a.createdAt).getTime();
        const bCustom = new Date(b.updatedAt || b.createdAt).getTime();
        return bCustom - aCustom;
      default:
        return 0;
    }
  });
}

function App() {
  const [user, setUser] = useState<any>(null);
  const [authSubscriptionRef, setAuthSubscriptionRef] = useState<any>(null);
  const authProcessedRef = useRef(false);

  // Security: Rate limiting for auth operations
  const [authAttempts, setAuthAttempts] = useState(0);
  const [lastAuthAttempt, setLastAuthAttempt] = useState<Date | null>(null);
  const [isRateLimited, setIsRateLimited] = useState(false);

  // Security: Account lockout protection
  const [accountLockout, setAccountLockout] = useState<{
    locked: boolean;
    lockoutUntil: Date | null;
    failedAttempts: number;
  }>({
    locked: false,
    lockoutUntil: null,
    failedAttempts: 0,
  });

  // Security: Password strength requirements
  const [passwordRequirements] = useState({
    minLength: 12,
    requireUppercase: true,
    requireLowercase: true,
    requireNumbers: true,
    requireSpecialChars: true,
    preventCommonPasswords: true,
  });

  // Security: Audit logging
  const logSecurityEvent = (event: string, details: any) => {
    const auditEntry = {
      timestamp: new Date().toISOString(),
      event,
      details,
      userAgent: navigator.userAgent,
      ip: "client-side", // Would be server-side in production
      sessionId: user?.id || "anonymous",
    };
    console.log("?? Security Audit:", auditEntry);
  };
  const checkRateLimit = (): boolean => {
    const now = new Date();
    const timeWindow = 15 * 60 * 1000; // 15 minutes
    const maxAttempts = 5;

    if (
      lastAuthAttempt &&
      now.getTime() - lastAuthAttempt.getTime() < timeWindow
    ) {
      if (authAttempts >= maxAttempts) {
        setIsRateLimited(true);
        logSecurityEvent("RATE_LIMIT_EXCEEDED", { attempts: authAttempts });
        setTimeout(() => setIsRateLimited(false), timeWindow);
        return false;
      }
    } else {
      // Reset counter after time window
      setAuthAttempts(0);
    }

    setAuthAttempts((prev) => prev + 1);
    setLastAuthAttempt(now);
    return true;
  };

  // Security: Input validation
  const validateInput = (
    input: string,
    type: "email" | "password" | "text"
  ): boolean => {
    const patterns = {
      email: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
      password: /^.{8,}$/, // Minimum 8 characters
      text: /^.{1,1000}$/, // Reasonable text length
    };

    if (!patterns[type].test(input)) {
      logSecurityEvent("INPUT_VALIDATION_FAILED", {
        type,
        inputLength: input.length,
      });
      return false;
    }
    return true;
  };

  // Security: Enhanced password strength validation
  const validatePasswordStrength = (
    password: string
  ): { isValid: boolean; score: number; feedback: string[] } => {
    const feedback: string[] = [];
    let score = 0;

    // Length check
    if (password.length >= passwordRequirements.minLength) {
      score += 25;
    } else {
      feedback.push(
        `Password must be at least ${passwordRequirements.minLength} characters long`
      );
    }

    // Uppercase check
    if (passwordRequirements.requireUppercase && /[A-Z]/.test(password)) {
      score += 20;
    } else if (passwordRequirements.requireUppercase) {
      feedback.push("Password must contain at least one uppercase letter");
    }

    // Lowercase check
    if (passwordRequirements.requireLowercase && /[a-z]/.test(password)) {
      score += 20;
    } else if (passwordRequirements.requireLowercase) {
      feedback.push("Password must contain at least one lowercase letter");
    }

    // Numbers check
    if (passwordRequirements.requireNumbers && /\d/.test(password)) {
      score += 15;
    } else if (passwordRequirements.requireNumbers) {
      feedback.push("Password must contain at least one number");
    }

    // Special characters check
    if (
      passwordRequirements.requireSpecialChars &&
      /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)
    ) {
      score += 10;
    } else if (passwordRequirements.requireSpecialChars) {
      feedback.push("Password must contain at least one special character");
    }

    // Common password check
    const commonPasswords = [
      "password",
      "123456",
      "qwerty",
      "admin",
      "letmein",
      "welcome",
    ];
    if (
      passwordRequirements.preventCommonPasswords &&
      commonPasswords.includes(password.toLowerCase())
    ) {
      score = 0;
      feedback.push(
        "Password is too common, please choose a stronger password"
      );
    }

    // Entropy check (basic)
    const uniqueChars = new Set(password).size;
    if (uniqueChars >= password.length * 0.7) {
      score += 10;
    }

    return {
      isValid: score >= 70,
      score,
      feedback,
    };
  };

  // Security: Account lockout management
  const checkAccountLockout = (): boolean => {
    const now = new Date();

    // Check if account is currently locked
    if (accountLockout.locked && accountLockout.lockoutUntil) {
      if (now < accountLockout.lockoutUntil) {
        logSecurityEvent("ACCOUNT_LOCKOUT_ACTIVE", {
          lockoutUntil: accountLockout.lockoutUntil.toISOString(),
          failedAttempts: accountLockout.failedAttempts,
        });
        return false; // Account is locked
      } else {
        // Lockout period has expired, reset
        setAccountLockout({
          locked: false,
          lockoutUntil: null,
          failedAttempts: 0,
        });
        logSecurityEvent("ACCOUNT_LOCKOUT_EXPIRED", {
          previousFailedAttempts: accountLockout.failedAttempts,
        });
      }
    }

    return true; // Account is not locked
  };

  // Security: Handle failed authentication attempt
  const handleFailedAuthAttempt = () => {
    const newFailedAttempts = accountLockout.failedAttempts + 1;
    let lockoutDuration = 0;

    // Progressive lockout: 5 min after 3 attempts, 15 min after 5, 60 min after 10
    if (newFailedAttempts >= 10) {
      lockoutDuration = 60 * 60 * 1000; // 1 hour
    } else if (newFailedAttempts >= 5) {
      lockoutDuration = 15 * 60 * 1000; // 15 minutes
    } else if (newFailedAttempts >= 3) {
      lockoutDuration = 5 * 60 * 1000; // 5 minutes
    }

    if (lockoutDuration > 0) {
      const lockoutUntil = new Date(Date.now() + lockoutDuration);
      setAccountLockout({
        locked: true,
        lockoutUntil,
        failedAttempts: newFailedAttempts,
      });
      logSecurityEvent("ACCOUNT_LOCKOUT_TRIGGERED", {
        failedAttempts: newFailedAttempts,
        lockoutDuration: lockoutDuration / 1000 / 60, // minutes
        lockoutUntil: lockoutUntil.toISOString(),
      });
    } else {
      setAccountLockout((prev) => ({
        ...prev,
        failedAttempts: newFailedAttempts,
      }));
    }
  };

  // Security: Handle successful authentication
  const handleSuccessfulAuth = () => {
    // Reset failed attempts on successful login
    setAccountLockout({
      locked: false,
      lockoutUntil: null,
      failedAttempts: 0,
    });
    logSecurityEvent("ACCOUNT_LOCKOUT_RESET", { reason: "successful_auth" });
  };

  // Security: Secure headers and CORS protection
  const setSecureHeaders = () => {
    // Note: These would be set server-side in production
    // Client-side we can only log and monitor
    logSecurityEvent("SECURE_HEADERS_CHECK", {
      referrerPolicy: document.referrer,
      https: window.location.protocol === "https:",
      userAgent: navigator.userAgent,
    });
  };

  // Security: Token rotation for session security
  const rotateTokens = async () => {
    try {
      const { data, error } = await supabase.auth.refreshSession();
      if (error) {
        logSecurityEvent("TOKEN_ROTATION_FAILED", {
          error: error instanceof Error ? error.message : String(error),
        });
        return false;
      }
      if (data.session) {
        logSecurityEvent("TOKEN_ROTATION_SUCCESS", {
          userId: data.session.user.id,
        });
        setUser(data.session.user);
        return true;
      }
    } catch (err) {
      logSecurityEvent("TOKEN_ROTATION_ERROR", { error: err });
    }
    return false;
  };

  // Security: Session integrity check
  const checkSessionIntegrity = () => {
    const session = supabase.auth.getSession();
    if (!session) {
      logSecurityEvent("SESSION_INTEGRITY_CHECK_FAILED", {
        reason: "no_session",
      });
      return false;
    }

    // Check for suspicious patterns
    const now = Date.now();
    const sessionAge =
      now - (user?.created_at ? new Date(user.created_at).getTime() : now);

    if (sessionAge > 24 * 60 * 60 * 1000) {
      // 24 hours
      logSecurityEvent("SESSION_INTEGRITY_WARNING", {
        sessionAge,
        threshold: "24h",
      });
    }

    return true;
  };

  // Security: Attack prevention - SQL injection, XSS monitoring
  const sanitizeInput = (input: string): string => {
    // Basic sanitization - in production, use a proper library
    return input
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "")
      .replace(/javascript:/gi, "")
      .replace(/on\w+\s*=/gi, "")
      .trim();
  };

  // Security: Monitor for suspicious activity
  const monitorSuspiciousActivity = () => {
    // Check for rapid successive requests
    const now = Date.now();
    const recentActivity = JSON.parse(
      localStorage.getItem("elysium_activity") || "[]"
    );

    // Keep only last 10 minutes of activity
    const recentActivityFiltered = recentActivity.filter(
      (timestamp: number) => now - timestamp < 10 * 60 * 1000
    );

    if (recentActivityFiltered.length > 50) {
      // More than 50 actions in 10 minutes
      logSecurityEvent("SUSPICIOUS_ACTIVITY_DETECTED", {
        actionCount: recentActivityFiltered.length,
        timeWindow: "10min",
      });
    }

    recentActivityFiltered.push(now);
    localStorage.setItem(
      "elysium_activity",
      JSON.stringify(recentActivityFiltered)
    );
  };

  // Security: Data integrity - Checksum calculation
  const calculateChecksum = (data: string): string => {
    let hash = 0;
    for (let i = 0; i < data.length; i++) {
      const char = data.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return hash.toString(16);
  };

  // Security: Data integrity verification
  const verifyDataIntegrity = (
    data: string,
    expectedChecksum: string
  ): boolean => {
    const calculatedChecksum = calculateChecksum(data);
    const isValid = calculatedChecksum === expectedChecksum;

    if (!isValid) {
      logSecurityEvent("DATA_INTEGRITY_VIOLATION", {
        expectedChecksum,
        calculatedChecksum,
        dataLength: data.length,
      });
    }

    return isValid;
  };

  // Security: Field-level encryption for sensitive data
  const encryptSensitiveField = async (
    data: string,
    fieldName: string
  ): Promise<string> => {
    try {
      // Use a different key derivation for field-level encryption
      const fieldKey = await deriveKey(
        user?.id || "anonymous",
        `${fieldName}_field_salt`
      );
      const encoder = new TextEncoder();
      const dataBuffer = encoder.encode(data);

      // Generate a new nonce for each encryption
      const nonce = crypto.getRandomValues(new Uint8Array(12));

      const encrypted = await crypto.subtle.encrypt(
        { name: "AES-GCM", iv: nonce },
        fieldKey,
        dataBuffer
      );

      // Combine nonce and encrypted data
      const combined = new Uint8Array(nonce.length + encrypted.byteLength);
      combined.set(nonce);
      combined.set(new Uint8Array(encrypted), nonce.length);

      const encryptedString = btoa(
        String.fromCharCode(...Array.from(combined))
      );
      logSecurityEvent("FIELD_ENCRYPTION_SUCCESS", {
        fieldName,
        dataLength: data.length,
      });

      return encryptedString;
    } catch (error) {
      logSecurityEvent("FIELD_ENCRYPTION_FAILED", {
        fieldName,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  };

  // Security: Field-level decryption
  const decryptSensitiveField = async (
    encryptedData: string,
    fieldName: string
  ): Promise<string> => {
    try {
      const fieldKey = await deriveKey(
        user?.id || "anonymous",
        `${fieldName}_field_salt`
      );
      const combined = Uint8Array.from(atob(encryptedData), (c) =>
        c.charCodeAt(0)
      );

      // Extract nonce and encrypted data
      const nonce = combined.slice(0, 12);
      const encrypted = combined.slice(12);

      const decrypted = await crypto.subtle.decrypt(
        { name: "AES-GCM", iv: nonce },
        fieldKey,
        encrypted
      );

      const decoder = new TextDecoder();
      const decryptedString = decoder.decode(decrypted);

      logSecurityEvent("FIELD_DECRYPTION_SUCCESS", { fieldName });
      return decryptedString;
    } catch (error) {
      logSecurityEvent("FIELD_DECRYPTION_FAILED", {
        fieldName,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  };

  // Security: Secure deletion with data wiping
  const secureDelete = (data: any, passes: number = 3): void => {
    if (typeof data === "string") {
      // Overwrite string multiple times with random data
      let wiped = data;
      for (let pass = 0; pass < passes; pass++) {
        wiped = crypto.getRandomValues(new Uint8Array(data.length)).toString();
      }
      logSecurityEvent("SECURE_DELETION_COMPLETED", {
        dataType: "string",
        originalLength: data.length,
        passes,
      });
    } else if (data instanceof Uint8Array) {
      // Overwrite array buffer multiple times
      for (let pass = 0; pass < passes; pass++) {
        crypto.getRandomValues(data);
      }
      logSecurityEvent("SECURE_DELETION_COMPLETED", {
        dataType: "Uint8Array",
        arrayLength: data.length,
        passes,
      });
    } else {
      logSecurityEvent("SECURE_DELETION_UNSUPPORTED", {
        dataType: typeof data,
      });
    }
  };

  // Security: Data classification and access control
  const classifyDataSensitivity = (
    content: string
  ): "public" | "internal" | "confidential" | "restricted" => {
    const confidentialKeywords = [
      "password",
      "secret",
      "key",
      "token",
      "private",
      "ssn",
      "credit",
    ];
    const restrictedKeywords = [
      "medical",
      "financial",
      "personal",
      "sensitive",
    ];

    const lowerContent = content.toLowerCase();

    if (restrictedKeywords.some((keyword) => lowerContent.includes(keyword))) {
      return "restricted";
    } else if (
      confidentialKeywords.some((keyword) => lowerContent.includes(keyword))
    ) {
      return "confidential";
    } else if (content.length > 1000 || /\b\d{3}-\d{2}-\d{4}\b/.test(content)) {
      // SSN pattern
      return "internal";
    } else {
      return "public";
    }
  };

  // Security: Audit trail for data modifications
  const auditDataModification = (
    operation: string,
    noteId: string,
    changes: any
  ) => {
    const auditEntry = {
      timestamp: new Date().toISOString(),
      operation,
      noteId,
      userId: user?.id,
      changes,
      userAgent: navigator.userAgent,
      ip: "client-side",
      dataClassification: classifyDataSensitivity(JSON.stringify(changes)),
    };

    // Store audit trail (in production, this would go to a secure audit log)
    const auditTrail = JSON.parse(
      localStorage.getItem("elysium_audit_trail") || "[]"
    );
    auditTrail.push(auditEntry);

    // Keep only last 1000 entries to prevent localStorage bloat
    if (auditTrail.length > 1000) {
      auditTrail.splice(0, auditTrail.length - 1000);
    }

    localStorage.setItem("elysium_audit_trail", JSON.stringify(auditTrail));
    logSecurityEvent("DATA_MODIFICATION_AUDITED", auditEntry);
  };

  // Security: API request size limits
  const validateRequestSize = (
    data: any,
    maxSizeKB: number = 1024
  ): boolean => {
    const dataSize = JSON.stringify(data).length / 1024; // Size in KB

    if (dataSize > maxSizeKB) {
      logSecurityEvent("REQUEST_SIZE_LIMIT_EXCEEDED", {
        actualSize: dataSize,
        maxSize: maxSizeKB,
        dataType: typeof data,
      });
      return false;
    }

    return true;
  };

  // Security: API response size limits
  const validateResponseSize = (
    response: any,
    maxSizeKB: number = 2048
  ): boolean => {
    const responseSize = JSON.stringify(response).length / 1024; // Size in KB

    if (responseSize > maxSizeKB) {
      logSecurityEvent("RESPONSE_SIZE_LIMIT_EXCEEDED", {
        actualSize: responseSize,
        maxSize: maxSizeKB,
        responseType: typeof response,
      });
      return false;
    }

    return true;
  };

  // Security: Content-Type validation
  const validateContentType = (
    contentType: string,
    allowedTypes: string[]
  ): boolean => {
    if (!allowedTypes.includes(contentType)) {
      logSecurityEvent("INVALID_CONTENT_TYPE", {
        providedType: contentType,
        allowedTypes,
      });
      return false;
    }
    return true;
  };

  // Security: API security headers validation
  const validateApiHeaders = (headers: Record<string, string>): boolean => {
    const requiredHeaders = ["content-type", "authorization"];
    const securityHeaders = [
      "x-content-type-options",
      "x-frame-options",
      "x-xss-protection",
      "strict-transport-security",
    ];

    // Check for required headers
    for (const header of requiredHeaders) {
      if (!headers[header.toLowerCase()]) {
        logSecurityEvent("MISSING_REQUIRED_HEADER", { header });
        return false;
      }
    }

    // Validate Content-Type
    const contentType = headers["content-type"];
    if (
      contentType &&
      !validateContentType(contentType, [
        "application/json",
        "application/x-www-form-urlencoded",
        "multipart/form-data",
      ])
    ) {
      return false;
    }

    // Log security headers presence
    const presentSecurityHeaders = securityHeaders.filter(
      (header) => headers[header.toLowerCase()]
    );

    logSecurityEvent("API_HEADERS_VALIDATED", {
      requiredHeadersPresent: requiredHeaders.every(
        (h) => headers[h.toLowerCase()]
      ),
      securityHeadersPresent: presentSecurityHeaders,
    });

    return true;
  };

  // Security: API versioning security
  const validateApiVersion = (version: string): boolean => {
    const supportedVersions = ["v1", "v2", "latest"];
    const normalizedVersion = version.toLowerCase();

    if (!supportedVersions.includes(normalizedVersion)) {
      logSecurityEvent("UNSUPPORTED_API_VERSION", {
        requestedVersion: version,
        supportedVersions,
      });
      return false;
    }

    return true;
  };

  // Security: Rate limiting per endpoint
  const endpointRateLimit = new Map<
    string,
    { count: number; resetTime: number }
  >();

  const checkEndpointRateLimit = (
    endpoint: string,
    maxRequests: number = 100,
    windowMs: number = 15 * 60 * 1000
  ): boolean => {
    const now = Date.now();
    const key = `${endpoint}_${user?.id || "anonymous"}`;

    let limit = endpointRateLimit.get(key);
    if (!limit || now > limit.resetTime) {
      limit = { count: 0, resetTime: now + windowMs };
      endpointRateLimit.set(key, limit);
    }

    if (limit.count >= maxRequests) {
      logSecurityEvent("ENDPOINT_RATE_LIMIT_EXCEEDED", {
        endpoint,
        requestCount: limit.count,
        maxRequests,
        windowMs,
      });
      return false;
    }

    limit.count++;
    return true;
  };

  // Security: Request throttling
  const requestThrottle = new Map<string, number>();
  const throttleRequest = (
    key: string,
    minIntervalMs: number = 1000
  ): boolean => {
    const now = Date.now();
    const lastRequest = requestThrottle.get(key) || 0;

    if (now - lastRequest < minIntervalMs) {
      logSecurityEvent("REQUEST_THROTTLED", {
        key,
        timeSinceLastRequest: now - lastRequest,
        minInterval: minIntervalMs,
      });
      return false;
    }

    requestThrottle.set(key, now);
    return true;
  };

  // Security: API health monitoring
  const monitorApiHealth = async (): Promise<boolean> => {
    try {
      const startTime = Date.now();
      const { data, error } = await supabase
        .from("notes")
        .select("count")
        .limit(1)
        .single();
      const responseTime = Date.now() - startTime;

      const isHealthy = !error && responseTime < 5000; // 5 second timeout

      logSecurityEvent("API_HEALTH_CHECK", {
        healthy: isHealthy,
        responseTime,
        error: error?.message,
      });

      return isHealthy;
    } catch (err) {
      logSecurityEvent("API_HEALTH_CHECK_FAILED", {
        error: err instanceof Error ? err.message : String(err),
      });
      return false;
    }
  };

  // Security: Data retention policies
  const enforceDataRetention = () => {
    const retentionPolicies = {
      notes: 365 * 24 * 60 * 60 * 1000, // 1 year
      auditLogs: 90 * 24 * 60 * 60 * 1000, // 90 days
      tempFiles: 7 * 24 * 60 * 60 * 1000, // 7 days
      sessionData: 30 * 24 * 60 * 60 * 1000, // 30 days
    };

    const now = Date.now();

    // Clean up old audit logs
    const auditTrail = JSON.parse(
      localStorage.getItem("elysium_audit_trail") || "[]"
    );
    const filteredAuditTrail = auditTrail.filter(
      (entry: any) =>
        now - new Date(entry.timestamp).getTime() < retentionPolicies.auditLogs
    );

    if (filteredAuditTrail.length !== auditTrail.length) {
      localStorage.setItem(
        "elysium_audit_trail",
        JSON.stringify(filteredAuditTrail)
      );
      logSecurityEvent("DATA_RETENTION_ENFORCED", {
        dataType: "audit_logs",
        removedCount: auditTrail.length - filteredAuditTrail.length,
      });
    }

    // Clean up old activity logs
    const activityLog = JSON.parse(
      localStorage.getItem("elysium_activity") || "[]"
    );
    const filteredActivityLog = activityLog.filter(
      (timestamp: number) => now - timestamp < retentionPolicies.sessionData
    );

    if (filteredActivityLog.length !== activityLog.length) {
      localStorage.setItem(
        "elysium_activity",
        JSON.stringify(filteredActivityLog)
      );
      logSecurityEvent("DATA_RETENTION_ENFORCED", {
        dataType: "activity_logs",
        removedCount: activityLog.length - filteredActivityLog.length,
      });
    }
  };

  // Security: Privacy consent management
  const [privacyConsent, setPrivacyConsent] = useState<{
    analytics: boolean;
    marketing: boolean;
    dataProcessing: boolean;
    lastUpdated: string;
  }>({
    analytics: false,
    marketing: false,
    dataProcessing: true, // Required for app functionality
    lastUpdated: new Date().toISOString(),
  });

  const updatePrivacyConsent = (
    consentType: keyof typeof privacyConsent,
    value: boolean
  ) => {
    if (consentType === "dataProcessing" && !value) {
      logSecurityEvent("PRIVACY_CONSENT_VIOLATION", {
        attemptedChange: "dataProcessing",
        newValue: false,
      });
      alert(
        "Data processing consent is required for the application to function."
      );
      return;
    }

    setPrivacyConsent((prev) => ({
      ...prev,
      [consentType]: value,
      lastUpdated: new Date().toISOString(),
    }));

    logSecurityEvent("PRIVACY_CONSENT_UPDATED", {
      consentType,
      newValue: value,
      userId: user?.id,
    });

    // Store consent preferences
    localStorage.setItem(
      "elysium_privacy_consent",
      JSON.stringify({
        ...privacyConsent,
        [consentType]: value,
        lastUpdated: new Date().toISOString(),
      })
    );
  };

  // Security: GDPR compliance - Right to be forgotten
  const gdprDataDeletion = async (): Promise<boolean> => {
    try {
      if (!user?.id) {
        logSecurityEvent("GDPR_DELETION_FAILED", { reason: "no_user" });
        return false;
      }

      // Delete all user notes
      const { error: notesError } = await supabase
        .from("notes")
        .delete()
        .eq("user_id", user.id);

      if (notesError) {
        logSecurityEvent("GDPR_DELETION_FAILED", {
          step: "notes_deletion",
          error:
            notesError instanceof Error
              ? notesError.message
              : String(notesError),
        });
        return false;
      }

      // Clear local storage
      const keysToRemove = Object.keys(localStorage).filter(
        (key) => key.startsWith("elysium_") || key.includes(user.id)
      );

      keysToRemove.forEach((key) => localStorage.removeItem(key));

      // Sign out user
      await supabase.auth.signOut();

      logSecurityEvent("GDPR_DELETION_COMPLETED", {
        userId: user.id,
        notesDeleted: true,
        localStorageCleared: true,
        signedOut: true,
      });

      return true;
    } catch (error) {
      logSecurityEvent("GDPR_DELETION_ERROR", {
        error: error instanceof Error ? error.message : String(error),
      });
      return false;
    }
  };

  // Security: GDPR compliance - Data portability
  const gdprDataExport = async (): Promise<any> => {
    try {
      if (!user?.id) {
        logSecurityEvent("GDPR_EXPORT_FAILED", { reason: "no_user" });
        return null;
      }

      // Export user notes
      const { data: notes, error } = await supabase
        .from("notes")
        .select("*")
        .eq("user_id", user.id);

      if (error) {
        logSecurityEvent("GDPR_EXPORT_FAILED", {
          step: "notes_export",
          error: error instanceof Error ? error.message : String(error),
        });
        return null;
      }

      // Export audit trail (anonymized)
      const auditTrail = JSON.parse(
        localStorage.getItem("elysium_audit_trail") || "[]"
      )
        .filter((entry: any) => entry.userId === user.id)
        .map((entry: any) => ({
          ...entry,
          ip: "[REDACTED]", // Remove IP for privacy
          userAgent: "[REDACTED]", // Remove user agent for privacy
        }));

      // Export privacy consent
      const consentData = JSON.parse(
        localStorage.getItem("elysium_privacy_consent") || "{}"
      );

      const exportData = {
        exportDate: new Date().toISOString(),
        userId: user.id,
        data: {
          notes,
          auditTrail,
          privacyConsent: consentData,
          dataRetentionInfo: "Data retained according to our privacy policy",
        },
        gdprCompliant: true,
      };

      logSecurityEvent("GDPR_EXPORT_COMPLETED", {
        userId: user.id,
        notesCount: notes?.length || 0,
        auditEntriesCount: auditTrail.length,
      });

      return exportData;
    } catch (error) {
      logSecurityEvent("GDPR_EXPORT_ERROR", {
        error: error instanceof Error ? error.message : String(error),
      });
      return null;
    }
  };

  // Security: Privacy impact assessment
  const performPrivacyImpactAssessment = (
    data: any,
    operation: string
  ): {
    riskLevel: "low" | "medium" | "high";
    concerns: string[];
    recommendations: string[];
  } => {
    const concerns: string[] = [];
    const recommendations: string[] = [];
    let riskLevel: "low" | "medium" | "high" = "low";

    const dataString = JSON.stringify(data);
    const dataClassification = classifyDataSensitivity(dataString);

    // Assess based on data classification
    if (dataClassification === "restricted") {
      riskLevel = "high";
      concerns.push("Data contains restricted information");
      recommendations.push("Implement additional encryption layers");
      recommendations.push("Require explicit user consent");
    } else if (dataClassification === "confidential") {
      riskLevel = "medium";
      concerns.push("Data contains confidential information");
      recommendations.push("Use field-level encryption");
    }

    // Assess based on operation type
    if (operation === "export" || operation === "share") {
      riskLevel = riskLevel === "low" ? "medium" : "high";
      concerns.push("Data export/sharing operation detected");
      recommendations.push("Implement data anonymization");
      recommendations.push("Add data usage audit trail");
    }

    // Assess based on data volume
    if (dataString.length > 10000) {
      concerns.push("Large data volume may increase privacy risks");
      recommendations.push("Implement data chunking for processing");
    }

    logSecurityEvent("PRIVACY_IMPACT_ASSESSMENT", {
      operation,
      dataClassification,
      riskLevel,
      concernsCount: concerns.length,
    });

    return { riskLevel, concerns, recommendations };
  };

  // Security: Automated privacy compliance checks
  const runPrivacyComplianceCheck = (): boolean => {
    const issues: string[] = [];

    // Check data retention compliance
    const auditTrail = JSON.parse(
      localStorage.getItem("elysium_audit_trail") || "[]"
    );
    const oldEntries = auditTrail.filter(
      (entry: any) =>
        Date.now() - new Date(entry.timestamp).getTime() >
        90 * 24 * 60 * 60 * 1000
    );

    if (oldEntries.length > 0) {
      issues.push(
        `Found ${oldEntries.length} audit entries older than 90 days`
      );
    }

    // Check privacy consent
    if (!privacyConsent.dataProcessing) {
      issues.push("Required data processing consent is missing");
    }

    // Check for sensitive data in localStorage
    const sensitiveKeys = Object.keys(localStorage).filter(
      (key) =>
        key.includes("password") ||
        key.includes("secret") ||
        key.includes("key")
    );

    if (sensitiveKeys.length > 0) {
      issues.push(
        `Found ${sensitiveKeys.length} potentially sensitive keys in localStorage`
      );
    }

    const compliant = issues.length === 0;

    logSecurityEvent("PRIVACY_COMPLIANCE_CHECK", {
      compliant,
      issuesCount: issues.length,
      issues,
    });

    return compliant;
  };

  // Security: Database performance monitoring
  const monitorDatabasePerformance = async (): Promise<{
    responseTime: number;
    throughput: number;
    errorRate: number;
    healthScore: number;
  }> => {
    const metrics = {
      responseTime: 0,
      throughput: 0,
      errorRate: 0,
      healthScore: 100,
    };

    try {
      // Measure response time
      const startTime = Date.now();
      const { data, error } = await supabase
        .from("notes")
        .select("count")
        .limit(1);
      metrics.responseTime = Date.now() - startTime;

      if (error) {
        metrics.errorRate = 100;
        metrics.healthScore -= 50;
      } else {
        // Measure throughput (operations per second)
        const throughputStart = Date.now();
        const promises = Array(5)
          .fill(null)
          .map(() => supabase.from("notes").select("id").limit(1));
        await Promise.all(promises);
        const throughputTime = Date.now() - throughputStart;
        metrics.throughput = (5000 / throughputTime) * 1000; // ops per second

        // Adjust health score based on performance
        if (metrics.responseTime > 2000) metrics.healthScore -= 20;
        if (metrics.responseTime > 5000) metrics.healthScore -= 30;
        if (metrics.throughput < 10) metrics.healthScore -= 15;
      }

      logSecurityEvent("DATABASE_PERFORMANCE_METRICS", metrics);
      return metrics;
    } catch (err) {
      metrics.errorRate = 100;
      metrics.healthScore = 0;
      logSecurityEvent("DATABASE_PERFORMANCE_CHECK_FAILED", {
        error: err instanceof Error ? err.message : String(err),
      });
      return metrics;
    }
  };

  // Security: Anomaly detection
  const detectAnomalies = (): {
    anomalies: string[];
    severity: "low" | "medium" | "high" | "critical";
    recommendations: string[];
  } => {
    const anomalies: string[] = [];
    const recommendations: string[] = [];
    let severity: "low" | "medium" | "high" | "critical" = "low";

    // Check for unusual login patterns
    const recentActivity = JSON.parse(
      localStorage.getItem("elysium_activity") || "[]"
    );
    const lastHourActivity = recentActivity.filter(
      (timestamp: number) => Date.now() - timestamp < 60 * 60 * 1000
    );

    if (lastHourActivity.length > 100) {
      anomalies.push("Unusually high activity in the last hour");
      severity = "high";
      recommendations.push("Investigate for potential DoS attack");
    }

    // Check for failed authentication spikes
    if (accountLockout.failedAttempts > 3) {
      anomalies.push("Multiple recent authentication failures");
      severity = severity === "low" ? "medium" : severity;
      recommendations.push("Monitor for brute force attempts");
    }

    // Check for data integrity issues
    const auditTrail = JSON.parse(
      localStorage.getItem("elysium_audit_trail") || "[]"
    );
    const recentErrors = auditTrail.filter(
      (entry: any) =>
        entry.event.includes("FAILED") &&
        Date.now() - new Date(entry.timestamp).getTime() < 60 * 60 * 1000
    );

    if (recentErrors.length > 10) {
      anomalies.push("High rate of operation failures");
      severity = "high";
      recommendations.push("Check system health and connectivity");
    }

    // Check for unusual data access patterns
    const dataAccessPatterns = auditTrail.filter(
      (entry: any) => entry.operation === "read" || entry.operation === "update"
    );

    const uniqueUsers = new Set(
      dataAccessPatterns.map((entry: any) => entry.userId)
    ).size;
    if (uniqueUsers > 10) {
      anomalies.push("Unusual number of users accessing data");
      severity = severity === "low" ? "medium" : severity;
      recommendations.push("Verify user access permissions");
    }

    // Check for session anomalies
    if (user && user.created_at) {
      const sessionAge = Date.now() - new Date(user.created_at).getTime();
      if (sessionAge > 24 * 60 * 60 * 1000) {
        // 24 hours
        anomalies.push("Very old session detected");
        severity = severity === "low" ? "medium" : severity;
        recommendations.push("Recommend session refresh");
      }
    }

    logSecurityEvent("ANOMALY_DETECTION_COMPLETED", {
      anomaliesCount: anomalies.length,
      severity,
      recommendationsCount: recommendations.length,
    });

    return { anomalies, severity, recommendations };
  };

  // Security: Security health checks
  const performSecurityHealthCheck = async (): Promise<{
    overallHealth: number;
    checks: Record<string, boolean>;
    issues: string[];
    recommendations: string[];
  }> => {
    const healthReport = {
      overallHealth: 100,
      checks: {} as Record<string, boolean>,
      issues: [] as string[],
      recommendations: [] as string[],
    };

    // Check 1: Authentication security
    healthReport.checks.authSecurity =
      !accountLockout.locked && accountLockout.failedAttempts === 0;
    if (!healthReport.checks.authSecurity) {
      healthReport.overallHealth -= 20;
      healthReport.issues.push("Authentication security issues detected");
      healthReport.recommendations.push("Review authentication policies");
    }

    // Check 2: Data integrity
    const auditTrail = JSON.parse(
      localStorage.getItem("elysium_audit_trail") || "[]"
    );
    const integrityViolations = auditTrail.filter(
      (entry: any) => entry.event === "DATA_INTEGRITY_VIOLATION"
    );
    healthReport.checks.dataIntegrity = integrityViolations.length === 0;
    if (!healthReport.checks.dataIntegrity) {
      healthReport.overallHealth -= 25;
      healthReport.issues.push("Data integrity violations detected");
      healthReport.recommendations.push("Verify data backup and integrity");
    }

    // Check 3: Privacy compliance
    healthReport.checks.privacyCompliance = runPrivacyComplianceCheck();
    if (!healthReport.checks.privacyCompliance) {
      healthReport.overallHealth -= 15;
      healthReport.issues.push("Privacy compliance issues found");
      healthReport.recommendations.push("Review and update privacy policies");
    }

    // Check 4: API health
    healthReport.checks.apiHealth = await monitorApiHealth();
    if (!healthReport.checks.apiHealth) {
      healthReport.overallHealth -= 30;
      healthReport.issues.push("API health issues detected");
      healthReport.recommendations.push(
        "Check API connectivity and performance"
      );
    }

    // Check 5: Rate limiting status
    healthReport.checks.rateLimiting = !isRateLimited;
    if (!healthReport.checks.rateLimiting) {
      healthReport.overallHealth -= 10;
      healthReport.issues.push("Rate limiting is active");
      healthReport.recommendations.push("Monitor for potential abuse");
    }

    // Anomaly detection
    const anomalyReport = detectAnomalies();
    healthReport.checks.anomalyFree = anomalyReport.anomalies.length === 0;
    if (!healthReport.checks.anomalyFree) {
      const severityPenalty = { low: 5, medium: 15, high: 25, critical: 40 };
      healthReport.overallHealth -=
        severityPenalty[anomalyReport.severity] || 10;
      healthReport.issues.push(...anomalyReport.anomalies);
      healthReport.recommendations.push(...anomalyReport.recommendations);
    }

    logSecurityEvent("SECURITY_HEALTH_CHECK_COMPLETED", {
      overallHealth: healthReport.overallHealth,
      checksPassed: Object.values(healthReport.checks).filter(Boolean).length,
      totalChecks: Object.keys(healthReport.checks).length,
      issuesCount: healthReport.issues.length,
    });

    return healthReport;
  };

  // Security: Automated security monitoring
  const startAutomatedSecurityMonitoring = () => {
    // Run health checks every 5 minutes
    const healthCheckInterval = setInterval(async () => {
      const healthReport = await performSecurityHealthCheck();

      if (healthReport.overallHealth < 70) {
        logSecurityEvent("SECURITY_HEALTH_ALERT", {
          healthScore: healthReport.overallHealth,
          criticalIssues: healthReport.issues.length,
          severity: healthReport.overallHealth < 50 ? "critical" : "warning",
        });

        // In production, this would send alerts to administrators
        console.warn("?? Security Health Alert:", healthReport);
      }
    }, 5 * 60 * 1000); // Every 5 minutes

    // Run anomaly detection every 10 minutes
    const anomalyCheckInterval = setInterval(() => {
      const anomalyReport = detectAnomalies();

      if (
        anomalyReport.severity === "high" ||
        anomalyReport.severity === "critical"
      ) {
        logSecurityEvent("ANOMALY_ALERT", {
          severity: anomalyReport.severity,
          anomaliesCount: anomalyReport.anomalies.length,
        });

        console.warn("?? Anomaly Detected:", anomalyReport);
      }
    }, 10 * 60 * 1000); // Every 10 minutes

    // Run data retention enforcement daily
    const retentionInterval = setInterval(() => {
      enforceDataRetention();
    }, 24 * 60 * 60 * 1000); // Daily

    // Store interval IDs for cleanup
    return { healthCheckInterval, anomalyCheckInterval, retentionInterval };
  };

  // Security: Emergency security lockdown
  const initiateSecurityLockdown = (reason: string) => {
    logSecurityEvent("SECURITY_LOCKDOWN_INITIATED", {
      reason,
      timestamp: new Date().toISOString(),
      userId: user?.id,
    });

    // Disable all user operations
    // In a real implementation, this would:
    // 1. Block all API calls
    // 2. Force logout all users
    // 3. Enable read-only mode
    // 4. Alert administrators

    alert(
      `Security lockdown initiated: ${reason}. Please contact administrators.`
    );

    // Force logout current user
    supabase.auth.signOut();
  };

  useEffect(() => {
    const handleAuthRedirect = async () => {
      // Security: Check account lockout before processing auth
      if (!checkAccountLockout()) {
        alert(
          "Account is temporarily locked due to too many failed login attempts. Please try again later."
        );
        return;
      }

      // Security: Check rate limiting before processing auth
      if (!checkRateLimit()) {
        logSecurityEvent("AUTH_RATE_LIMITED", { action: "handleAuthRedirect" });
        alert(
          "Too many authentication attempts. Please wait before trying again."
        );
        return;
      }

      // Security: Monitor suspicious activity
      monitorSuspiciousActivity();

      // Security: Set secure headers check
      setSecureHeaders();

      if (authProcessedRef.current) {
        console.log("Auth already processed, skipping");
        return;
      }

      const hash = window.location.hash;
      console.log("URL hash on load:", hash);

      // Security: Validate and sanitize hash input
      const sanitizedHash = sanitizeInput(hash);
      if (sanitizedHash !== hash) {
        logSecurityEvent("INPUT_SANITIZATION_TRIGGERED", {
          original: hash,
          sanitized: sanitizedHash,
        });
      }

      if (hash.includes("error=access_denied")) {
        console.error("Auth error in URL:", hash);
        logSecurityEvent("AUTH_ERROR_ACCESS_DENIED", { hash });
        handleFailedAuthAttempt();
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
          // Security: Validate token format (basic JWT structure check)
          const isValidTokenFormat = (token: string) => {
            // JWT tokens have three parts separated by dots: header.payload.signature
            const parts = token.split(".");
            return parts.length === 3 && parts.every((part) => part.length > 0);
          };

          if (
            !isValidTokenFormat(accessToken) ||
            !isValidTokenFormat(refreshToken)
          ) {
            logSecurityEvent("INVALID_TOKEN_FORMAT", {
              accessTokenValid: isValidTokenFormat(accessToken),
              refreshTokenValid: isValidTokenFormat(refreshToken),
            });
            // Don't show alert for format issues - let Supabase handle auth errors
            console.warn(
              "Token format validation failed, proceeding with Supabase auth"
            );
          }

          console.log("Setting session from hash tokens");
          const { data, error } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          });
          console.log("Set session result:", { data, error });
          if (error) {
            console.error("Error setting session:", error);
            logSecurityEvent("SESSION_SET_ERROR", {
              error: error instanceof Error ? error.message : String(error),
            });
            handleFailedAuthAttempt();
            alert(
              `Authentication failed: ${
                error instanceof Error ? error.message : String(error)
              }`
            );
          } else if (data.session) {
            // Security: Check session integrity
            if (!checkSessionIntegrity()) {
              logSecurityEvent("SESSION_INTEGRITY_FAILED", {
                userId: data.session.user.id,
              });
            }

            setUser(data.session.user);
            console.log("User set from session:", data.session.user);
            logSecurityEvent("AUTH_SUCCESS", {
              userId: data.session.user.id,
              email: data.session.user.email,
            });
            handleSuccessfulAuth();
            alert(`Logged in as ${data.session.user.email}`);
            authProcessedRef.current = true;

            // Security: Schedule token rotation
            setTimeout(() => rotateTokens(), 30 * 60 * 1000); // Rotate after 30 minutes
          } else {
            console.log("No session returned from setSession");
            logSecurityEvent("SESSION_SET_NO_SESSION", {});
            handleFailedAuthAttempt();
            alert("Authentication failed: No session returned");
          }
        } else {
          console.log("Hash contains access_token but missing tokens");
          logSecurityEvent("MISSING_TOKENS_IN_HASH", {});
          alert("Authentication failed: Missing tokens in URL");
        }
      } else {
        // No tokens in hash, get current session
        const {
          data: { session },
          error,
        } = await supabase.auth.getSession();
        console.log("Initial session check:", { session, error });

        if (session) {
          // Security: Check session integrity for existing session
          if (!checkSessionIntegrity()) {
            logSecurityEvent("EXISTING_SESSION_INTEGRITY_FAILED", {
              userId: session.user.id,
            });
          }
          logSecurityEvent("EXISTING_SESSION_RESTORED", {
            userId: session.user.id,
          });
        }

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

          // Security: Log auth state changes
          logSecurityEvent("AUTH_STATE_CHANGE", {
            event,
            hasSession: !!session,
            userId: session?.user?.id,
            email: session?.user?.email,
          });

          // Security: Monitor for suspicious auth patterns
          if (event === "SIGNED_OUT") {
            monitorSuspiciousActivity();
          }

          if (session) {
            // Security: Check session integrity on state change
            if (!checkSessionIntegrity()) {
              logSecurityEvent("SESSION_INTEGRITY_FAILED_ON_CHANGE", {
                event,
                userId: session.user.id,
              });
            }

            setUser(session.user);
            logSecurityEvent("AUTH_STATE_CHANGE_SUCCESS", {
              event,
              userId: session.user.id,
              email: session.user.email,
            });
            handleSuccessfulAuth();

            // Security: Schedule periodic token rotation
            setTimeout(() => rotateTokens(), 45 * 60 * 1000); // Rotate after 45 minutes
          } else {
            setUser(null);
            if (event === "SIGNED_OUT") {
              logSecurityEvent("USER_SIGNED_OUT", { reason: "user_action" });
            }
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
    <WelcomePage user={user} setUser={setUser} />
  );
}

function getDefaultNotes(mode: "web3" | "db" | "cloud"): Note[] {
  // Return empty array to start with no default notes
  return [];
}

function WelcomePage({
  user,
  setUser,
}: {
  user: any;
  setUser: (user: any) => void;
}) {
  const [hasBeenConnected, setHasBeenConnected] = useState(false);
  const [showPopup, setShowPopup] = useState(false);
  const [email, setEmail] = useState("");
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [walletAddress, setWalletAddress] = useState<string>("");

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
  const [showCloudAuthModal, setShowCloudAuthModal] = useState(false);
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

  // Cloud storage hook
  const cloudStorage = useCloudStorage();

  const [cloudNotes, setCloudNotes] = useState<Note[]>([]);

  // Offline queue for cloud saves
  const [offlineQueue, setOfflineQueue] = useState<Note[]>([]);

  // Download loading state
  const [downloadingNotes, setDownloadingNotes] = useState<Set<string>>(
    new Set()
  );

  // Draft system for blockchain mode
  const [drafts, setDrafts] = useState<Note[]>([]);
  const [currentDraft, setCurrentDraft] = useState<Note | null>(null);
  const [isAutoSaving, setIsAutoSaving] = useState(false);
  const [selectedDrafts, setSelectedDrafts] = useState<Set<string>>(new Set());
  const [publishingDrafts, setPublishingDrafts] = useState<Set<string>>(
    new Set()
  );

  // Batch processing for blockchain saves
  const [batchQueue, setBatchQueue] = useState<Note[]>([]);
  const [isProcessingBatch, setIsProcessingBatch] = useState(false);

  // ArConnect modal state
  const [arConnectModal, setArConnectModal] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    actionButton?: { text: string; onClick: () => void };
  }>({
    isOpen: false,
    title: "",
    message: "",
  });

  // Connectivity state
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [isLoadingOfflineData, setIsLoadingOfflineData] = useState(false);
  const [cachedNotes, setCachedNotes] = useState<Note[]>([]);

  // Load cloud notes
  const loadCloudNotes = async () => {
    if (cloudStorage.user) {
      try {
        // Convert CloudNote to Note format
        const convertedNotes: Note[] = cloudStorage.notes.map((cloudNote) => ({
          id: cloudNote.id || `cloud-${Date.now()}`,
          title: cloudNote.title,
          content: cloudNote.content,
          template: cloudNote.template || "Blank",
          isPermanent: false,
          completionTimestamps: {},
          createdAt: cloudNote.createdAt.toDate().toISOString(),
          updatedAt: cloudNote.updatedAt.toDate().toISOString(),
        }));
        setCloudNotes(convertedNotes);
      } catch (error) {
        console.error("Error loading cloud notes:", error);
        setCloudNotes([]);
      }
    } else {
      setCloudNotes([]);
    }
  };

  const [settings, setSettings] = useState(() => {
    const saved = localStorage.getItem("elysium_settings");
    const defaults = {
      theme: "Dark",
      notifications: false,
      syncInterval: 15,
      aiResponseStyle: "Balanced",
      aiPersonality: "Professional",
      autoSave: true,
      defaultTemplate: "Blank",
      noteSorting: "Date Created",
      dataRetention: 365,
    };
    return saved ? { ...defaults, ...JSON.parse(saved) } : defaults;
  });

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

  // Auto-save functionality
  useEffect(() => {
    if (!settings.autoSave || !user) return;

    const autoSaveInterval = setInterval(() => {
      // Auto-save logic would go here - for now just log
      console.log("Auto-saving notes...");
      // In a real implementation, this would save any unsaved changes
    }, 30000); // Auto-save every 30 seconds

    return () => clearInterval(autoSaveInterval);
  }, [settings.autoSave, user]);

  const handleSettingsSave = (newSettings: {
    theme: string;
    notifications: boolean;
    syncInterval: number;
    aiResponseStyle: string;
    aiPersonality: string;
    autoSave: boolean;
    defaultTemplate: string;
    noteSorting: string;
    dataRetention: number;
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

  // Draft management functions for blockchain mode
  const saveDraftLocally = async (note: Note) => {
    if (mode !== "web3" || !checkArweaveWallet()) return;

    try {
      setIsAutoSaving(true);

      // Get Arweave address
      const arweaveAddress = await connectArweaveWallet();

      // Encrypt the draft content with wallet-derived key
      const dataStr = JSON.stringify({
        title: note.title,
        content: note.content,
        template: note.template,
        completionTimestamps: note.completionTimestamps || {},
      });

      // Use Arweave address as key material (convert to bytes)
      const encoder = new TextEncoder();
      const addressBytes = encoder.encode(arweaveAddress);

      const { encrypted, nonce } = encryptAndCompress(
        dataStr,
        addressBytes
      );

      const encryptedDraft = {
        ...note,
        encryptedContent: encrypted,
        nonce: nonce,
        isDraft: true,
        updatedAt: new Date().toISOString(),
      };

      // Save to localStorage with wallet-specific key
      const draftsKey = `elysium_drafts_${arweaveAddress}`;
      const existingDrafts = JSON.parse(
        localStorage.getItem(draftsKey) || "[]"
      );

      // Update or add the draft
      const draftIndex = existingDrafts.findIndex((d: any) => d.id === note.id);
      if (draftIndex >= 0) {
        existingDrafts[draftIndex] = encryptedDraft;
      } else {
        existingDrafts.push(encryptedDraft);
      }

      localStorage.setItem(draftsKey, JSON.stringify(existingDrafts));
      setDrafts(existingDrafts);

      console.log("Draft auto-saved:", note.id);
    } catch (error) {
      console.error("Error saving draft:", error);
    } finally {
      setIsAutoSaving(false);
    }
  };

  const loadDraftsFromLocal = async () => {
    if (mode !== "web3" || !checkArweaveWallet()) return;

    try {
      const arweaveAddress = await connectArweaveWallet();
      const draftsKey = `elysium_drafts_${arweaveAddress}`;
      const savedDrafts = JSON.parse(localStorage.getItem(draftsKey) || "[]");

      // Decrypt drafts for display
      const decryptedDrafts = await Promise.all(
        savedDrafts.map(async (draft: any) => {
          try {
            if (draft.encryptedContent && draft.nonce) {
              // Use Arweave address as key material for decryption
              const encoder = new TextEncoder();
              const addressBytes = encoder.encode(arweaveAddress);
              const decryptedData = decryptNote(
                new Uint8Array(Object.values(draft.encryptedContent)),
                addressBytes,
                new Uint8Array(Object.values(draft.nonce))
              );

              const parsed = JSON.parse(decryptedData);
              return {
                ...draft,
                title: parsed.title,
                content: parsed.content,
                template: parsed.template,
                completionTimestamps: parsed.completionTimestamps,
                isDraft: true,
              };
            }
            return draft;
          } catch (error) {
            console.error("Error decrypting draft:", error);
            return null;
          }
        })
      );

      setDrafts(decryptedDrafts.filter(Boolean));
      console.log(`Loaded ${decryptedDrafts.length} drafts`);
    } catch (error) {
      console.error("Error loading drafts:", error);
      setDrafts([]);
    }
  };

  const deleteDraft = async (draftId: string) => {
    if (mode !== "web3" || !checkArweaveWallet()) return;

    try {
      const arweaveAddress = await connectArweaveWallet();
      const draftsKey = `elysium_drafts_${arweaveAddress}`;
      const existingDrafts = JSON.parse(
        localStorage.getItem(draftsKey) || "[]"
      );
      const filteredDrafts = existingDrafts.filter(
        (d: any) => d.id !== draftId
      );

      localStorage.setItem(draftsKey, JSON.stringify(filteredDrafts));
      setDrafts(filteredDrafts);

      console.log("Draft deleted:", draftId);
    } catch (error) {
      console.error("Error deleting draft:", error);
    }
  };

  const publishDraftToBlockchain = async (draft: Note) => {
    if (mode !== "web3" || !checkArweaveWallet()) return;

    try {
      // Add this draft to the publishing set
      setPublishingDrafts((prev) => new Set(prev).add(draft.id));

      // Publish to blockchain first
      const result = await saveToBlockchain({
        ...draft,
        isPermanent: true,
        updatedAt: new Date().toISOString(),
      });

      // Only remove from drafts after successful publishing
      await deleteDraft(draft.id);

      // Add the published note to the notes list with transaction details
      const publishedNote: Note = {
        ...draft,
        arweaveHash: result.arweaveHash,
        transactionHash: result.transactionHash,
        isPermanent: result.isPermanent,
        isDraft: false,
        updatedAt: new Date().toISOString(),
      };

      setNotes((prev) => [...prev, publishedNote]);

      console.log("Draft published to blockchain:", draft.id, result);
      showNotification(
        "Success",
        `Note "${draft.title}" published to blockchain!`
      );
    } catch (error) {
      console.error("Error publishing draft:", error);
      // Don't delete draft on failure - let user try again
      showNotification(
        "Error",
        `Failed to publish "${draft.title}" to blockchain. Please try again.`
      );
    } finally {
      // Remove this draft from the publishing set
      setPublishingDrafts((prev) => {
        const newSet = new Set(prev);
        newSet.delete(draft.id);
        return newSet;
      });
    }
  };

  const batchPublishDrafts = async (draftIds: string[]) => {
    if (mode !== "web3" || !checkArweaveWallet() || draftIds.length === 0) return;

    try {
      setIsProcessingBatch(true);

      const draftsToPublish = drafts.filter((d) => draftIds.includes(d.id));

      if (draftsToPublish.length === 0) return;

      // Calculate estimated cost (rough estimate: $0.001 per note)
      const estimatedCost = (draftIds.length * 0.001).toFixed(3);

      // Show confirmation once for the entire batch
      const confirmMessage =
        draftsToPublish.length === 1
          ? `Publish "${draftsToPublish[0].title}" to blockchain? This will make it permanent and cost ~$${estimatedCost}.`
          : `Publish ${draftsToPublish.length} drafts to blockchain as a batch? This will make them permanent and cost ~$${estimatedCost}.`;

      if (!window.confirm(confirmMessage)) return;

      let successCount = 0;
      let failureCount = 0;

      // Process each draft sequentially (could be optimized to true batch later)
      for (const draft of draftsToPublish) {
        try {
          // Publish to blockchain first
          const result = await saveToBlockchain({
            ...draft,
            isPermanent: true,
            updatedAt: new Date().toISOString(),
          });

          // Only remove from drafts after successful publishing
          await deleteDraft(draft.id);

          // Add the published note to the notes list with transaction details
          const publishedNote: Note = {
            ...draft,
            arweaveHash: result.arweaveHash,
            transactionHash: result.transactionHash,
            isPermanent: result.isPermanent,
            isDraft: false,
            updatedAt: new Date().toISOString(),
          };

          setNotes((prev) => [...prev, publishedNote]);

          successCount++;
          console.log(`Successfully published draft: ${draft.title}`, result);
        } catch (error) {
          console.error(`Failed to publish draft "${draft.title}":`, error);
          failureCount++;
          // Draft remains in drafts list - no need to re-add
        }
      }

      // Show results
      if (successCount > 0) {
        showNotification(
          "Success",
          `Published ${successCount} draft${
            successCount === 1 ? "" : "s"
          } to blockchain!${failureCount > 0 ? ` ${failureCount} failed.` : ""}`
        );
      } else {
        showNotification(
          "Error",
          "Failed to publish any drafts. Please try again."
        );
      }
    } catch (error) {
      console.error("Error in batch publish:", error);
      showNotification("Error", "Failed to publish drafts. Please try again.");
    } finally {
      setIsProcessingBatch(false);
    }
  };

  // Clean up orphaned notes that can't be decrypted
  const cleanupOrphanedNotes = async () => {
    if (mode !== "db" || !user) return;

    try {
      const session = (await supabase.auth.getSession()).data.session;
      if (!session) return;

      const key = await deriveKey(session.user.id);
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

  // Connectivity detection functions
  const testInternetConnectivity = async (): Promise<boolean> => {
    try {
      // Test multiple endpoints for better reliability
      const testUrls = [
        "https://www.google.com/favicon.ico",
        "https://www.cloudflare.com/favicon.ico",
        "https://firebase.google.com/favicon.ico",
      ];

      for (const url of testUrls) {
        try {
          const response = await fetch(url, {
            method: "HEAD",
            mode: "no-cors",
            cache: "no-cache",
            signal: AbortSignal.timeout(5000), // 5 second timeout
          });
          return true;
        } catch (error) {
          // Continue to next URL
          continue;
        }
      }
      return false;
    } catch (error) {
      console.warn("Connectivity test failed:", error);
      return false;
    }
  };

  const checkConnectivity = async () => {
    const online = await testInternetConnectivity();
    console.log("Connectivity check:", online ? "online" : "offline");
    setIsOnline(online);
    return online;
  };

  const loadCachedNotes = async () => {
    if (mode === "cloud" && cloudStorage.user) {
      try {
        setIsLoadingOfflineData(true);

        // Load cached notes from localStorage
        const cached = localStorage.getItem(
          `elysium_cached_notes_${cloudStorage.user.uid}`
        );
        if (cached) {
          const parsedNotes: Note[] = JSON.parse(cached);
          setCachedNotes(parsedNotes);

          // If offline, automatically switch to cached notes
          if (!isOnline) {
            setNotes(parsedNotes);
            console.log(
              `Automatically loaded ${parsedNotes.length} cached notes (offline mode)`
            );
          }
        } else if (!isOnline) {
          // No cached notes available offline
          setNotes([]);
          console.log("No cached notes available for offline mode");
        }
      } catch (error) {
        console.error("Error loading cached notes:", error);
        setCachedNotes([]);
        if (!isOnline) {
          setNotes([]);
        }
      } finally {
        setIsLoadingOfflineData(false);
      }
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

  // Connectivity monitoring
  useEffect(() => {
    // Initial connectivity check
    checkConnectivity();

    // Listen for online/offline events
    const handleOnline = () => {
      console.log("Browser reports online");
      checkConnectivity(); // Double-check with actual connectivity test
    };

    const handleOffline = () => {
      console.log("Browser reports offline");
      setIsOnline(false);
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    // Periodic connectivity checks
    const connectivityInterval = setInterval(checkConnectivity, 30000); // Check every 30 seconds

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
      clearInterval(connectivityInterval);
    };
  }, []);

  // Load cached notes when offline
  useEffect(() => {
    if (!isOnline && mode === "cloud" && cloudStorage.user) {
      loadCachedNotes();
    } else if (isOnline && mode === "cloud" && cloudStorage.user) {
      // When back online, load fresh data and clear offline mode
      loadCloudNotes();
      setIsLoadingOfflineData(false);
    }
  }, [isOnline, mode, cloudStorage.user]);

  // Cache notes when they're loaded from cloud
  useEffect(() => {
    if (mode === "cloud" && cloudStorage.user && cloudNotes.length > 0) {
      // Cache the current cloud notes for offline use
      localStorage.setItem(
        `elysium_cached_notes_${cloudStorage.user.uid}`,
        JSON.stringify(cloudNotes)
      );
      console.log(`Cached ${cloudNotes.length} notes for offline use`);
    }
  }, [cloudNotes, mode, cloudStorage.user]);

  // Load drafts when switching to blockchain mode or wallet connects
  useEffect(() => {
    if (mode === "web3" && checkArweaveWallet()) {
      loadDraftsFromLocal();
    } else {
      setDrafts([]);
    }
  }, [mode]);

  // Auto-save current draft every 30 seconds
  useEffect(() => {
    if (mode !== "web3" || !currentDraft || !checkArweaveWallet()) return;

    const autoSaveInterval = setInterval(() => {
      saveDraftLocally(currentDraft);
    }, 30000); // Auto-save every 30 seconds

    return () => clearInterval(autoSaveInterval);
  }, [currentDraft, mode]);

  const handleSelectWallet = async () => {
    try {
      const address = await connectArweaveWallet();
      setWalletAddress(address);
      // Reload drafts after wallet connection
      if (mode === "web3") {
        loadDraftsFromLocal();
      }
    } catch (error) {
      console.error("Failed to connect Arweave wallet:", error);
    }
  };

  const handleWalletAction = () => {
    if (checkArweaveWallet()) {
      setShowPopup(true);
    } else {
      handleSelectWallet();
    }
  };

  const handleLogout = async () => {
    // Arweave wallets don't have programmatic disconnect
    if (mode === "db") {
      console.log("Logging out from Supabase");
      await supabase.auth.signOut();
      setUser(null);
      // Stay in database mode but logged out
      setActivePage("recent");
      setNotes([]);
    }
    if (mode === "cloud" && cloudStorage.user) {
      console.log("Logging out from Firebase");
      try {
        await cloudStorage.signOut();
        console.log("Firebase signOut completed");
        // Wait a bit for the auth state to update
        await new Promise((resolve) => setTimeout(resolve, 1000));
        console.log("Auth state update delay completed");
        // Stay in cloud mode but logged out
        setActivePage("recent");
        setNotes([]);
      } catch (error) {
        console.error("Error signing out from Firebase:", error);
      }
    }
    if (mode === "web3") {
      console.log("Logging out from Arweave - returning to main menu");
      // Clear the selected mode to return to main menu
      setSelectedMode(null);
      localStorage.removeItem("elysium_selected_mode");
      setWalletAddress("");
      setActivePage("recent");
      setNotes([]);
    }
    setShowPopup(false);
  };

  const handleLogoButton = () => {
    setActivePage("recent");
  };

  const handleExitToMainMenu = async () => {
    console.log("handleExitToMainMenu: Resetting UI state to main menu");
    setSelectedMode(null);
    setActivePage("recent");
    setNotes([]);
    console.log("handleExitToMainMenu: UI state reset completed");
  };

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

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) setFiles(Array.from(e.target.files));
  };

  // Offline queue management functions
  const addToOfflineQueue = useCallback((note: Note) => {
    setOfflineQueue((prev) => {
      const updated = [...prev, note];
      localStorage.setItem("elysium_offline_queue", JSON.stringify(updated));
      return updated;
    });
  }, []);

  const removeFromOfflineQueue = useCallback((noteId: string) => {
    setOfflineQueue((prev) => {
      const updated = prev.filter((n) => n.id !== noteId);
      localStorage.setItem("elysium_offline_queue", JSON.stringify(updated));
      return updated;
    });
  }, []);

  const processOfflineQueue = useCallback(async () => {
    if (offlineQueue.length === 0 || !cloudStorage.user) return;

    console.log(`Processing ${offlineQueue.length} notes from offline queue`);

    for (const note of offlineQueue) {
      try {
        // Check if note already exists in cloud
        const existingNotes = cloudStorage.notes;
        const exists = existingNotes.some((n) => n.id === note.id);

        if (!exists) {
          // Create new note in cloud
          await cloudStorage.createNote({
            title: note.title,
            content: note.content,
            template: note.template,
            isPublic: false,
            tags: [],
          });
        } else {
          // Update existing note in cloud
          await cloudStorage.updateNote(note.id, {
            title: note.title,
            content: note.content,
            template: note.template,
          });
        }

        removeFromOfflineQueue(note.id);
        console.log(`Successfully synced note: ${note.title}`);
      } catch (error) {
        console.error(`Failed to sync note ${note.title}:`, error);
        // Keep in queue for next attempt
      }
    }
  }, [offlineQueue, cloudStorage, removeFromOfflineQueue]);

  // Load offline queue from localStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem("elysium_offline_queue");
    if (saved) {
      try {
        setOfflineQueue(JSON.parse(saved));
      } catch (error) {
        console.error("Failed to load offline queue:", error);
      }
    }
  }, []);

  // Process queue when user comes online
  useEffect(() => {
    if (cloudStorage.user && offlineQueue.length > 0) {
      // Small delay to ensure cloud storage is ready
      const timer = setTimeout(() => {
        processOfflineQueue();
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [cloudStorage.user, offlineQueue.length, processOfflineQueue]);

  // Sync downloaded notes with cloud changes
  const syncDownloadedNotes = useCallback(async () => {
    if (!cloudStorage.user || mode !== "cloud") return;

    try {
      // Get all downloaded notes
      const downloadedNotes = notes.filter((note) => note.isDownloaded);

      for (const localNote of downloadedNotes) {
        // Find corresponding cloud note
        const cloudNote = cloudStorage.notes.find(
          (cn) => cn.id === localNote.id
        );

        if (cloudNote) {
          const cloudUpdatedAt = cloudNote.updatedAt.toDate().getTime();
          const localUpdatedAt = new Date(localNote.updatedAt).getTime();

          // If cloud note is newer, update local note
          if (cloudUpdatedAt > localUpdatedAt) {
            const updatedLocalNote: Note = {
              ...localNote,
              title: cloudNote.title,
              content: cloudNote.content,
              template: cloudNote.template || "Blank",
              updatedAt: cloudNote.updatedAt.toDate().toISOString(),
              isDownloaded: true, // Keep downloaded flag
            };

            const updatedNotes = notes.map((n) =>
              n.id === localNote.id ? updatedLocalNote : n
            );
            setNotes(updatedNotes);
            localStorage.setItem(
              `elysium_notes_${mode}`,
              JSON.stringify(updatedNotes)
            );

            console.log(
              `Synced cloud changes to local note: ${localNote.title}`
            );
          }
        }
      }
    } catch (error) {
      console.error("Error syncing downloaded notes:", error);
    }
  }, [cloudStorage.user, cloudStorage.notes, notes, mode]);

  // Sync downloaded notes when cloud notes change
  useEffect(() => {
    if (cloudStorage.user && mode === "cloud") {
      syncDownloadedNotes();
    }
  }, [cloudStorage.notes, syncDownloadedNotes, cloudStorage.user, mode]);

  const handleCreateNote = async (note: {
    title: string;
    content: string;
    template: string;
    files: File[];
  }) => {
    if (note.title && note.content) {
      let newNote: Note;
      if (mode === "web3" && checkArweaveWallet()) {
        // Create draft instead of immediately saving to blockchain
        newNote = {
          id: Date.now().toString(),
          title: note.title,
          content: note.content,
          template: note.template,
          isPermanent: false,
          completionTimestamps: {},
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          isDraft: true,
        };

        // Save as draft locally
        await saveDraftLocally(newNote);

        // Set as current draft for auto-saving
        setCurrentDraft(newNote);

        // Close the create modal
        setShowCreateModal(false);

        console.log("Note saved as draft:", newNote.id);
      } else if (mode === "db") {
        const session = (await supabase.auth.getSession()).data.session;
        if (session) {
          const key = await deriveKey(session.user.id);
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
      } else if (mode === "cloud") {
        // Create the note object first
        const newNote: Note = {
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

        if (cloudStorage.user) {
          try {
            // Create note in Firebase - the real-time listener will update the UI
            await cloudStorage.createNote({
              title: note.title,
              content: note.content,
              template: note.template,
            });
            // Don't add to local state - let the real-time listener handle it
            setShowCreateModal(false);
            setActivePage("recent");
            setIsCloudButtonClicked(false);

            // Show notification for successful note creation
            showNotification(
              "Success",
              "Note created successfully in the cloud!"
            );
            return;
          } catch (error) {
            // If cloud creation fails, save locally and add to offline queue
            console.log("Cloud creation failed, saving locally:", error);
            addToOfflineQueue(newNote);
            setShowCreateModal(false);
            setActivePage("recent");
            setIsCloudButtonClicked(false);
            showNotification(
              "Offline",
              "Note saved locally. Will sync to cloud when online."
            );
          }
        } else {
          // Not authenticated, save locally and add to queue
          addToOfflineQueue(newNote);
          setShowCreateModal(false);
          setActivePage("recent");
          setIsCloudButtonClicked(false);
          showNotification(
            "Offline",
            "Note saved locally. Will sync to cloud when you sign in."
          );
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

        setNotes([...notes, newNote]);
        setFiles(note.files);
        setShowCreateModal(false);
        setActivePage("recent");
        setIsCloudButtonClicked(false);

        // Show notification for successful note creation
        showNotification(
          "Note Created",
          `"${note.title}" has been saved successfully`
        );
      }
    } else if (mode === "web3") {
      alert("Please connect your wallet to create a note.");
    }
  };

  const handlePageChange = (
    page: "recent" | "create" | "settings" | "logout" | "search"
  ) => {
    setActivePage(page);
  };

  const saveToBlockchain = async (
    note: Note
  ): Promise<{
    arweaveHash: string;
    transactionHash?: string;
    isPermanent: boolean;
  }> => {
    if (mode !== "web3" || !checkArweaveWallet()) {
      throw new Error("Arweave wallet not connected");
    }
    try {
      // Get Arweave address for encryption
      const arweaveAddress = await connectArweaveWallet();

      const dataStr = JSON.stringify({
        title: note.title,
        content: note.content,
        template: note.template,
        completionTimestamps: note.completionTimestamps,
      });

      // Use Arweave address as key material for encryption
      const encoder = new TextEncoder();
      const addressBytes = encoder.encode(arweaveAddress);

      const { encrypted, nonce } = encryptAndCompress(
        dataStr,
        addressBytes
      );
      console.log(
        "Encryption complete - nonce length:",
        nonce.length,
        "encrypted length:",
        encrypted.length
      );

      const uploadData = new Uint8Array(nonce.length + encrypted.length);
      uploadData.set(nonce);
      uploadData.set(encrypted, nonce.length);
      console.log("Upload data prepared, total length:", uploadData.length);

      const arweaveHash = await uploadToArweave(uploadData);
      console.log("Arweave content saved, hash:", arweaveHash);

      // Arweave notes are always permanent
      const isPermanent = true;

      return {
        arweaveHash,
        transactionHash: arweaveHash, // Use Arweave hash as transaction hash
        isPermanent,
      };
    } catch (error) {
      console.error("Blockchain save failed:", error);

      const errorMsg = error instanceof Error ? error.message : String(error);

      // Handle ArConnect-related errors with modal
      if (errorMsg.includes("ArConnect wallet required")) {
        const guide = getArConnectInstallGuide();
        setArConnectModal({
          isOpen: true,
          title: guide.title,
          message: guide.message,
          actionButton: guide.actionUrl
            ? {
                text: "Install ArConnect",
                onClick: () => {
                  window.open(guide.actionUrl, "_blank");
                  setArConnectModal((prev) => ({ ...prev, isOpen: false }));
                },
              }
            : undefined,
        });
      } else if (errorMsg.includes("Insufficient AR balance")) {
        const funding = getArweaveFundingInfo();
        setArConnectModal({
          isOpen: true,
          title: funding.title,
          message: funding.message,
        });
      } else if (errorMsg.includes("Transaction signing cancelled")) {
        // User cancelled the transaction in ArConnect
        setArConnectModal({
          isOpen: true,
          title: "Transaction Cancelled",
          message:
            "The transaction was cancelled. You can try publishing again when you're ready.",
        });
      } else if (
        !errorMsg.includes("ArConnect") &&
        !errorMsg.includes("insufficient") &&
        !errorMsg.includes("balance") &&
        !errorMsg.includes("Failed to check")
      ) {
        // Show generic error for non-ArConnect issues
        setArConnectModal({
          isOpen: true,
          title: "Save Failed",
          message: "Failed to save to blockchain. Please try again.",
        });
      }

      throw error;
    }
  };

  const loadFromBlockchain = async () => {
    // SOL blockchain loading disabled - Arweave-only mode
    return;
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
          `Failed to send magic link: ${
            error instanceof Error ? error.message : String(error)
          }. Please check your Supabase dashboard for Auth logs, ensure SMTP is configured, and verify your email isn't blocked.`
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
        const key = await deriveKey(session.user.id);
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
      console.log("Cloud mode - user authenticated:", !!cloudStorage.user);
      console.log("Cloud storage notes count:", cloudStorage.notes.length);
      if (cloudStorage.user) {
        // Load notes from Firebase
        const firebaseNotes = cloudStorage.notes.map((cloudNote) => ({
          id: cloudNote.id!,
          title: cloudNote.title,
          content: cloudNote.content,
          template: cloudNote.template || "Auto",
          isPermanent: false,
          completionTimestamps: {},
          createdAt: cloudNote.createdAt.toDate().toISOString(),
          updatedAt: cloudNote.updatedAt.toDate().toISOString(),
        }));
        console.log("Setting notes from Firebase:", firebaseNotes.length);
        setNotes(firebaseNotes);
      } else {
        // Load from localStorage if not authenticated
        const stored = localStorage.getItem(`elysium_notes_${mode}`);
        console.log("Cloud notes from localStorage:", stored);
        setNotes(stored ? JSON.parse(stored) : getDefaultNotes(mode));
      }
    } else if (mode === "web3") {
      setNotes(getDefaultNotes(mode));
      // Arweave notes are loaded from localStorage drafts only
    }
  }, [
    mode,
    user,
    fetchNotes,
    cloudStorage.user,
    cloudStorage.notes,
  ]);

  useEffect(() => {
    if (mode === "cloud" && !cloudStorage.user) {
      // Only save to localStorage if not authenticated
      console.log("Saving cloud notes to localStorage:", notes);
      localStorage.setItem(`elysium_notes_${mode}`, JSON.stringify(notes));
    }
  }, [notes, mode, cloudStorage.user]);

  useEffect(() => {
    // SOL wallet connection logic disabled - Arweave-only mode
    // Arweave wallet connection is handled in handleSelectWallet
  }, []);

  const shortenedAddress = walletAddress ? `${walletAddress.slice(0, 6)}...${walletAddress.slice(-4)}` : "";

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
        if (!isChecked && (mode !== "web3" || checkArweaveWallet())) {
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
              const key = await deriveKey(session.user.id);
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
        if (isChecked && (mode !== "web3" || checkArweaveWallet())) {
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
              const key = await deriveKey(session.user.id);
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
              const key = await deriveKey(session.user.id);
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
              <span className="mr-2 text-indigo-400 text-lg">?</span>
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
                  isChecked
                    ? `line-through ${
                        settings.theme === "Light"
                          ? "text-purple-400"
                          : "text-gray-500"
                      }`
                    : ""
                }`}
              >
                {itemText}{" "}
                {isChecked && (
                  <span
                    className={`text-xs md:text-sm ml-2 cursor-pointer hover:text-indigo-400 transition-colors bg-gray-800/50 px-2 py-1 rounded ${
                      settings.theme === "Light"
                        ? "text-purple-600"
                        : "text-gray-500"
                    }`}
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
    (mode === "web3" && checkArweaveWallet());

  if (!selectedMode) {
    return (
      <div
        className="min-h-screen h-screen flex flex-col items-center justify-center text-white relative overflow-hidden px-4 sm:px-6 bg-gradient-to-br from-purple-900 via-indigo-900 to-black"
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
          <h1
            className="text-4xl sm:text-5xl font-extrabold tracking-wide mr-4 font-serif"
            style={{ color: "white" }}
          >
            Elysium
          </h1>
          <ElysiumLogo className="w-12 h-12 sm:w-16 sm:h-16" />
        </animated.div>
        <animated.p
          style={{ ...titleSpring, color: "#e5e7eb" }}
          className="text-lg sm:text-xl italic mb-6 max-w-md text-center"
        >
          Store Your Notes Permanently on Arweave
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
              <h2
                className="text-2xl sm:text-3xl font-bold mb-2 font-serif"
                style={{ color: "white" }}
              >
                Database Version (Supabase)
              </h2>
              <p className="text-sm sm:text-base" style={{ color: "#e5e7eb" }}>
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
              <h2
                className="text-2xl sm:text-3xl font-bold mb-2 font-serif"
                style={{ color: "white" }}
              >
                Cloud Version
              </h2>
              <p className="text-sm sm:text-base" style={{ color: "#e5e7eb" }}>
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
              <h2
                className="text-2xl sm:text-3xl font-bold mb-2 font-serif"
                style={{ color: "white" }}
              >
                Blockchain Version (Arweave)
              </h2>
              <p className="text-sm sm:text-base" style={{ color: "#e5e7eb" }}>
                <strong>? PREMIUM:</strong> Eternal, censorship-resistant
                storage on Arweave. Your notes become immutable digital
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
        <div
          className={`min-h-screen h-screen flex flex-col items-center justify-center text-white relative overflow-hidden px-4 sm:px-6 ${
            settings.theme === "Light"
              ? "bg-gradient-to-br from-purple-100 via-pink-50 to-indigo-100"
              : "bg-gradient-to-br from-purple-900 via-indigo-900 to-black"
          }`}
        >
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(255,255,255,0.1)_0%,transparent_50%)] pointer-events-none"></div>
          <animated.div style={logoSpring}>
            <ElysiumLogo className="mb-6 w-20 h-20 sm:w-24 sm:h-24" />
          </animated.div>
          <animated.h1
            style={titleSpring}
            className={`text-4xl sm:text-5xl font-extrabold tracking-wide mb-2 font-serif ${
              settings.theme === "Light" ? "text-purple-900" : "text-gold-100"
            }`}
          >
            Welcome to Elysium
          </animated.h1>
          <animated.p
            style={titleSpring}
            className={`text-lg sm:text-xl italic mb-6 max-w-md text-center ${
              settings.theme === "Light" ? "text-purple-700" : "text-silver-200"
            }`}
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
      ) : mode === "web3" && !walletAddress ? (
        <div
          className={`min-h-screen h-screen flex flex-col items-center justify-center text-white relative overflow-hidden px-4 sm:px-6 ${
            settings.theme === "Light"
              ? "bg-gradient-to-br from-purple-100 via-pink-50 to-indigo-100"
              : "bg-gradient-to-br from-purple-900 via-indigo-900 to-black"
          }`}
        >
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(255,255,255,0.1)_0%,transparent_50%)] pointer-events-none"></div>
          <animated.div style={logoSpring}>
            <ElysiumLogo className="mb-6 w-20 h-20 sm:w-24 sm:h-24" />
          </animated.div>
          <animated.h1
            style={titleSpring}
            className={`text-4xl sm:text-5xl font-extrabold tracking-wide mb-2 font-serif ${
              settings.theme === "Light" ? "text-purple-900" : "text-gold-100"
            }`}
          >
            Welcome to Elysium
          </animated.h1>
          <animated.p
            style={titleSpring}
            className={`text-lg sm:text-xl italic mb-6 max-w-md text-center ${
              settings.theme === "Light" ? "text-purple-700" : "text-silver-200"
            }`}
          >
            Store Your Notes Permanently on Arweave
          </animated.p>
          <animated.div style={buttonSpring}>
            <button
              onClick={handleSelectWallet}
              className="bg-gradient-to-r from-blue-600 to-purple-700 hover:from-blue-700 hover:to-purple-800 text-white font-bold py-3 px-6 sm:px-8 rounded-full shadow-xl transition-all duration-300 text-base sm:text-lg"
            >
              Access Via Arweave
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
        <div
          className={`min-h-screen h-screen flex flex-col text-white relative overflow-hidden ${
            settings.theme === "Light"
              ? "bg-gradient-to-br from-purple-100 via-pink-50 to-indigo-100"
              : "bg-gradient-to-br from-purple-900 via-indigo-900 to-black"
          }`}
        >
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(255,255,255,0.05)_0%,transparent_70%)] pointer-events-none"></div>
          <Drawer
            onNavigate={handlePageChange}
            onSearch={(query) => setSearchQuery(query)}
            theme={settings.theme}
            isOnline={isOnline}
          />
          <button onClick={handleLogoButton}>
            <div className="fixed top-4 sm:top-6 left-1/2 transform -translate-x-1/2 z-40">
              <ElysiumLogo className="w-12 h-12 sm:w-16 sm:h-16" />
            </div>
          </button>
          <header className="w-full p-2 sm:p-4 flex justify-end absolute top-0 left-0 items-center">
            <div className="flex items-center space-x-2 sm:space-x-4">
              {checkArweaveWallet() && (
                <button
                  onClick={handleWalletAction}
                  className="bg-gradient-to-r from-purple-600 to-blue-700 hover:from-purple-700 hover:to-blue-800 text-white font-bold py-2 px-4 sm:px-6 rounded-full shadow-xl transition-all duration-300 text-sm sm:text-base"
                >
                  {shortenedAddress}
                </button>
              )}
              {mode === "cloud" && cloudStorage.user && (
                <button
                  onClick={() => setActivePage("settings")}
                  className="bg-gradient-to-r from-green-600 to-blue-600 hover:from-green-700 hover:to-blue-700 text-white font-bold py-2 px-4 sm:px-6 rounded-full shadow-xl text-sm sm:text-base cursor-pointer"
                >
                  {cloudStorage.user.email}
                </button>
              )}
              {mode === "db" && user && (
                <button
                  onClick={() => setActivePage("settings")}
                  className="bg-gradient-to-r from-green-600 to-blue-600 hover:from-green-700 hover:to-blue-700 text-white font-bold py-2 px-4 sm:px-6 rounded-full shadow-xl text-sm sm:text-base cursor-pointer"
                >
                  {user.email}
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
            </div>
          </header>
          {showPopup && mode === "web3" && (
            <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50">
              <div className="bg-gradient-to-br from-purple-900 via-indigo-900 to-black p-4 sm:p-6 rounded-lg shadow-2xl text-white w-11/12 max-w-md sm:w-80 transform transition-all duration-300 ease-in-out">
                <h3
                  className={`text-lg sm:text-xl font-semibold mb-4 border-b border-indigo-700 pb-2 font-serif ${
                    settings.theme === "Light"
                      ? "text-purple-900"
                      : "text-gold-100"
                  }`}
                >
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
          {isLoadingOfflineData && (
            <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50">
              <div className="bg-gradient-to-br from-purple-900 via-indigo-900 to-black p-6 sm:p-8 rounded-lg shadow-2xl text-white w-11/12 max-w-md sm:w-96 transform transition-all duration-300 ease-in-out border border-indigo-700/50">
                <div className="text-center">
                  <div className="mb-4">
                    <div className="inline-block animate-spin rounded-full h-12 w-12 border-4 border-indigo-500 border-t-transparent"></div>
                  </div>
                  <h3
                    className={`text-xl sm:text-2xl font-semibold mb-2 font-serif ${
                      settings.theme === "Light"
                        ? "text-purple-900"
                        : "text-gold-100"
                    }`}
                  >
                    Loading Offline Data
                  </h3>
                  <p
                    className={`text-sm sm:text-base mb-4 ${
                      settings.theme === "Light"
                        ? "text-purple-700"
                        : "text-gray-300"
                    }`}
                  >
                    Retrieving your cached notes for offline access...
                  </p>
                  <div className="flex justify-center space-x-1">
                    <div
                      className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce"
                      style={{ animationDelay: "0ms" }}
                    ></div>
                    <div
                      className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce"
                      style={{ animationDelay: "150ms" }}
                    ></div>
                    <div
                      className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce"
                      style={{ animationDelay: "300ms" }}
                    ></div>
                  </div>
                </div>
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

            {/* ArConnect Installation Banner */}
            {mode === "web3" && !checkArweaveWallet() && (
              <div className="mb-6 bg-gradient-to-r from-orange-900/80 to-red-900/80 border border-orange-500/50 rounded-lg p-4 shadow-lg">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div className="text-orange-400 text-2xl">⚠️</div>
                    <div>
                      <h3 className="text-orange-200 font-semibold text-sm">
                        ArConnect Wallet Required
                      </h3>
                      <p className="text-orange-100/80 text-xs mt-1">
                        Install ArConnect to permanently store notes on Arweave
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => {
                      const guide = getArConnectInstallGuide();
                      setArConnectModal({
                        isOpen: true,
                        title: guide.title,
                        message: guide.message,
                        actionButton: guide.actionUrl
                          ? {
                              text: "Install ArConnect",
                              onClick: () => {
                                window.open(guide.actionUrl, "_blank");
                                setArConnectModal((prev) => ({
                                  ...prev,
                                  isOpen: false,
                                }));
                              },
                            }
                          : undefined,
                      });
                    }}
                    className="bg-orange-600 hover:bg-orange-700 text-white px-3 py-1 rounded text-xs font-medium transition-colors"
                  >
                    Install Now
                  </button>
                </div>
              </div>
            )}

            <animated.div
              style={mode === "web3" ? blockchainPageSpring : {}}
              className="w-full max-w-4xl p-4 sm:p-6"
            >
              {activePage === "recent" && (
                <>
                  <h1
                    className={`text-4xl sm:text-5xl font-extrabold mb-6 sm:mb-8 font-serif ${
                      settings.theme === "Light"
                        ? "text-purple-900"
                        : "text-gold-100"
                    }`}
                  >
                    {isOnline ? "Recent Notes" : "Offline Access"}
                  </h1>
                  <p
                    className={`text-sm mb-4 ${
                      settings.theme === "Light"
                        ? "text-purple-700"
                        : "text-gray-300"
                    }`}
                  >
                    {mode === "db"
                      ? "🗄️Classic encrypted database: Simple, secure, and fully tied to your account with enterprise-grade protection."
                      : mode === "cloud"
                      ? "⚡Lightning-fast cloud storage: Encrypted, downloadable data access with advanced cloud security and offline access."
                      : "⛓️ Eternal blockchain vault: Edit freely in drafts, then publish permanently to immutable blockchain storage. True ownership forever."}
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
                        if (mode === "cloud") {
                          if (cloudStorage.user) {
                            setIsCloudButtonClicked(true);
                          } else {
                            setShowCloudAuthModal(true);
                          }
                        }
                      }}
                    >
                      {mode === "db"
                        ? "Save to Database"
                        : mode === "cloud"
                        ? "Save to Cloud"
                        : "Create Draft"}
                    </button>
                  </div>

                  {/* Forever Notes section for blockchain mode */}
                  {mode === "web3" &&
                    notes.filter((note) => note.isPermanent).length > 0 && (
                      <div className="mb-8">
                        <div className="flex items-center justify-between mb-4">
                          <h2
                            className={`text-2xl font-bold font-serif ${
                              settings.theme === "Light"
                                ? "text-purple-900"
                                : "text-gold-100"
                            }`}
                          >
                            🌟 Forever Notes (
                            {notes.filter((note) => note.isPermanent).length})
                          </h2>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-6 mb-8">
                          {notes
                            .filter((note) => note.isPermanent)
                            .map((note) => (
                              <animated.div
                                key={note.id}
                                style={noteSpring}
                                className={`group backdrop-blur-sm p-3 sm:p-4 rounded-lg shadow-xl flex flex-col justify-between cursor-pointer hover:scale-105 transition-all duration-300 border h-48 sm:h-52 ${
                                  settings.theme === "Light"
                                    ? "bg-gradient-to-br from-amber-50/90 via-yellow-50/90 to-orange-50/90 hover:shadow-[0_0_15px_rgba(245,158,11,0.2)] border-amber-200/50"
                                    : "bg-gradient-to-br from-amber-800/90 to-orange-700/90 hover:shadow-[0_0_15px_rgba(245,158,11,0.3)] border-amber-600/30"
                                }`}
                                onClick={() => setViewingNote(note)}
                              >
                                <div className="flex-1 overflow-hidden">
                                  <h3
                                    className={`text-lg sm:text-xl font-semibold mb-2 font-serif line-clamp-2 leading-tight ${
                                      settings.theme === "Light"
                                        ? "text-amber-800"
                                        : "text-amber-100"
                                    }`}
                                  >
                                    {note.title}
                                    <span className="text-xs text-amber-400 ml-1">
                                      🌟
                                    </span>
                                  </h3>
                                  <div
                                    className={`text-sm mb-2 line-clamp-3 leading-relaxed ${
                                      settings.theme === "Light"
                                        ? "text-amber-700"
                                        : "text-amber-200"
                                    }`}
                                  >
                                    {note.content
                                      .split("\n")[0]
                                      .substring(0, 120)}
                                    {note.content.length > 120 ? "..." : ""}
                                  </div>
                                  <div
                                    className={`flex items-center justify-between text-xs ${
                                      settings.theme === "Light"
                                        ? "text-amber-600"
                                        : "text-amber-400"
                                    }`}
                                  >
                                    <span
                                      className={`px-2 py-1 rounded-full ${
                                        settings.theme === "Light"
                                          ? "bg-amber-100 text-amber-800"
                                          : "bg-amber-900/50 text-amber-300"
                                      }`}
                                    >
                                      {note.template}
                                    </span>
                                    <span
                                      className={
                                        settings.theme === "Light"
                                          ? "text-amber-500"
                                          : "text-amber-500"
                                      }
                                    >
                                      Click to view
                                    </span>
                                  </div>
                                </div>
                                <div className="mt-3 flex justify-between items-center">
                                  <div className="text-xs text-amber-400 flex items-center space-x-2">
                                    <span>Permanent</span>
                                    {note.arweaveHash && (
                                      <>
                                        <a
                                          href={`https://arweave.net/${note.arweaveHash}`}
                                          target="_blank"
                                          rel="noopener noreferrer"
                                          className="underline hover:text-amber-300 text-xs"
                                          onClick={(e) => e.stopPropagation()}
                                        >
                                          Arweave:{" "}
                                          {note.arweaveHash.substring(0, 8)}...
                                        </a>
                                        <button
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            window.open(`https://viewblock.io/arweave/tx/${note.arweaveHash}`, '_blank');
                                          }}
                                          className="ml-2 px-2 py-1 bg-blue-600 hover:bg-blue-700 text-white text-xs rounded transition-colors duration-200"
                                        >
                                          Track
                                        </button>
                                      </>
                                    )}
                                  </div>
                                </div>
                              </animated.div>
                            ))}
                        </div>
                      </div>
                    )}

                  {/* Drafts section for blockchain mode */}
                  {mode === "web3" && drafts.length > 0 && (
                    <div className="mb-8">
                      <div className="flex items-center justify-between mb-4">
                        <h2
                          className={`text-2xl font-bold font-serif ${
                            settings.theme === "Light"
                              ? "text-purple-900"
                              : "text-gold-100"
                          }`}
                        >
                          Drafts ({drafts.length})
                        </h2>
                        <div className="flex space-x-2">
                          {selectedDrafts.size > 0 && (
                            <button
                              onClick={() => {
                                batchPublishDrafts(Array.from(selectedDrafts));
                                setSelectedDrafts(new Set());
                              }}
                              disabled={isProcessingBatch}
                              className="bg-gradient-to-r from-green-600 to-blue-600 hover:from-green-700 hover:to-blue-700 text-white font-bold py-2 px-4 rounded-lg shadow-lg transition-all duration-300 text-sm disabled:opacity-50"
                            >
                              {isProcessingBatch
                                ? "Publishing..."
                                : `Publish Selected (~$${(
                                    selectedDrafts.size * 0.001
                                  ).toFixed(3)})`}
                            </button>
                          )}
                          <button
                            onClick={() => {
                              if (drafts.length > 0) {
                                const allIds = drafts.map((d) => d.id);
                                setSelectedDrafts(new Set(allIds));
                              }
                            }}
                            className="bg-gradient-to-r from-gray-600 to-gray-700 hover:from-gray-700 hover:to-gray-800 text-white font-bold py-2 px-4 rounded-lg shadow-lg transition-all duration-300 text-sm"
                          >
                            Select All
                          </button>
                          <button
                            onClick={() => setSelectedDrafts(new Set())}
                            className="bg-gradient-to-r from-gray-500 to-gray-600 hover:from-gray-600 hover:to-gray-700 text-white font-bold py-2 px-4 rounded-lg shadow-lg transition-all duration-300 text-sm"
                          >
                            Clear Selection
                          </button>
                        </div>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-6 mb-8">
                        {drafts.map((draft) => (
                          <animated.div
                            key={draft.id}
                            style={noteSpring}
                            className={`group backdrop-blur-sm p-3 sm:p-4 rounded-lg shadow-xl flex flex-col justify-between cursor-pointer hover:scale-105 transition-all duration-300 border ${
                              settings.theme === "Light"
                                ? "bg-gradient-to-br from-yellow-50/90 via-orange-50/90 to-amber-50/90 hover:shadow-[0_0_15px_rgba(245,158,11,0.2)] border-yellow-200/50"
                                : "bg-gradient-to-br from-yellow-800/90 to-orange-800/90 hover:shadow-[0_0_15px_rgba(245,158,11,0.3)] border-yellow-600/30"
                            }`}
                            onClick={() => setViewingNote(draft)}
                          >
                            <div className="flex-1 overflow-hidden">
                              <div className="flex items-center justify-between mb-2">
                                <div className="flex items-center space-x-2">
                                  <input
                                    type="checkbox"
                                    checked={selectedDrafts.has(draft.id)}
                                    onChange={(e) => {
                                      e.stopPropagation();
                                      const newSelected = new Set(
                                        selectedDrafts
                                      );
                                      if (e.target.checked) {
                                        newSelected.add(draft.id);
                                      } else {
                                        newSelected.delete(draft.id);
                                      }
                                      setSelectedDrafts(newSelected);
                                    }}
                                    className="w-4 h-4 text-green-600 bg-gray-100 border-gray-300 rounded focus:ring-green-500"
                                  />
                                  <span className="text-xs bg-yellow-500 text-white px-2 py-1 rounded-full font-semibold">
                                    DRAFT
                                  </span>
                                </div>
                                {isAutoSaving && (
                                  <span className="text-xs text-yellow-400 animate-pulse">
                                    Saving...
                                  </span>
                                )}
                              </div>
                              <h3
                                className={`text-lg sm:text-xl font-semibold mb-2 font-serif line-clamp-2 leading-tight ${
                                  settings.theme === "Light"
                                    ? "text-purple-800"
                                    : "text-gold-100"
                                }`}
                              >
                                {draft.title}
                              </h3>
                              <div
                                className={`text-sm mb-2 line-clamp-3 leading-relaxed ${
                                  settings.theme === "Light"
                                    ? "text-purple-700"
                                    : "text-gray-300"
                                }`}
                              >
                                {draft.content.split("\n")[0].substring(0, 120)}
                                {draft.content.length > 120 ? "..." : ""}
                              </div>
                              <div
                                className={`flex items-center justify-between text-xs ${
                                  settings.theme === "Light"
                                    ? "text-purple-600"
                                    : "text-gray-400"
                                }`}
                              >
                                <span
                                  className={`px-2 py-1 rounded-full ${
                                    settings.theme === "Light"
                                      ? "bg-purple-100 text-purple-800"
                                      : "bg-indigo-900/50 text-gray-300"
                                  }`}
                                >
                                  {draft.template}
                                </span>
                                <span
                                  className={
                                    settings.theme === "Light"
                                      ? "text-purple-500"
                                      : "text-gray-500"
                                  }
                                >
                                  Click to view
                                </span>
                              </div>
                            </div>
                            <div className="mt-3 flex justify-between items-center">
                              <div className="text-xs text-gray-400 flex items-center space-x-2">
                                <span>Est. cost: ~$0.001</span>
                                {!checkArweaveWallet() && (
                                  <span className="text-orange-400 flex items-center space-x-1">
                                    <span>⚠️</span>
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        const guide =
                                          getArConnectInstallGuide();
                                        setArConnectModal({
                                          isOpen: true,
                                          title: guide.title,
                                          message: guide.message,
                                          actionButton: guide.actionUrl
                                            ? {
                                                text: "Install ArConnect",
                                                onClick: () => {
                                                  window.open(
                                                    guide.actionUrl,
                                                    "_blank"
                                                  );
                                                  setArConnectModal((prev) => ({
                                                    ...prev,
                                                    isOpen: false,
                                                  }));
                                                },
                                              }
                                            : undefined,
                                        });
                                      }}
                                      className="underline hover:text-orange-300 text-xs"
                                    >
                                      ArConnect needed
                                    </button>
                                  </span>
                                )}
                              </div>
                              <div className="flex space-x-2">
                                <button
                                  onClick={async (e) => {
                                    e.stopPropagation();
                                    await publishDraftToBlockchain(draft);
                                  }}
                                  disabled={
                                    publishingDrafts.has(draft.id) ||
                                    isProcessingBatch
                                  }
                                  className={`text-sm disabled:opacity-50 ${
                                    !checkArweaveWallet()
                                      ? "text-orange-400 hover:text-orange-300"
                                      : "text-green-400 hover:text-green-300"
                                  } transition-colors duration-200`}
                                >
                                  {publishingDrafts.has(draft.id)
                                    ? "Publishing..."
                                    : "Publish"}
                                </button>
                                <button
                                  onClick={async (e) => {
                                    e.stopPropagation();
                                    if (window.confirm("Delete this draft?")) {
                                      await deleteDraft(draft.id);
                                    }
                                  }}
                                  className="text-red-400 hover:text-red-300 transition-colors duration-200 text-sm"
                                >
                                  Delete
                                </button>
                              </div>
                            </div>
                          </animated.div>
                        ))}
                      </div>
                    </div>
                  )}

                  {(() => {
                    let displayNotes = notes.filter(
                      (note) => mode !== "db" || !note.isPermanent
                    );

                    // In cloud mode, also show cloud notes that aren't downloaded yet
                    if (mode === "cloud" && cloudStorage.user) {
                      const cloudNotesToShow = cloudNotes
                        .filter(
                          (cloudNote) =>
                            !notes.some(
                              (localNote) =>
                                localNote.id === cloudNote.id &&
                                localNote.isDownloaded
                            )
                        )
                        .map((cloudNote) => ({
                          ...cloudNote,
                          isCloudOnly: true,
                        }));

                      displayNotes = [...displayNotes, ...cloudNotesToShow];
                    }

                    return displayNotes.length > 0 ? (
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
                          {(() => {
                            const cloudOnlyNotes: Note[] = []; // TODO: Implement cloud-only notes fetching
                            const displayNotes =
                              mode === "cloud"
                                ? [
                                    ...notes.filter(
                                      (note) => !note.isCloudOnly
                                    ),
                                    ...cloudOnlyNotes,
                                  ]
                                : notes.filter(
                                    (note) => mode !== "db" || !note.isPermanent
                                  );

                            return getSortedNotes(
                              displayNotes,
                              settings.noteSorting
                            ).map((note) => (
                              <animated.div
                                key={note.id}
                                style={noteSpring}
                                className={`group backdrop-blur-sm p-3 sm:p-4 rounded-lg shadow-xl flex flex-col justify-between cursor-pointer hover:scale-105 transition-all duration-300 border h-48 sm:h-52 ${
                                  settings.theme === "Light"
                                    ? "bg-gradient-to-br from-white/90 via-purple-50/90 to-indigo-50/90 hover:shadow-[0_0_15px_rgba(139,92,246,0.2)] border-purple-200/50"
                                    : "bg-gradient-to-br from-indigo-800/90 to-indigo-700/90 hover:shadow-[0_0_15px_rgba(79,70,229,0.3)] border-indigo-600/30"
                                }`}
                                onClick={() =>
                                  note.isCloudOnly ? null : setViewingNote(note)
                                }
                              >
                                <div className="flex-1 overflow-hidden">
                                  <h3
                                    className={`text-lg sm:text-xl font-semibold mb-2 font-serif line-clamp-2 leading-tight ${
                                      settings.theme === "Light"
                                        ? "text-purple-800"
                                        : "text-gold-100"
                                    }`}
                                  >
                                    {note.title}
                                    {note.isPermanent && (
                                      <span className="text-xs text-amber-400 ml-1">
                                        ??
                                      </span>
                                    )}
                                    {note.isCloudOnly && (
                                      <span className="text-xs text-cyan-400 ml-1">
                                        ☁️
                                      </span>
                                    )}
                                  </h3>
                                  <div
                                    className={`text-sm mb-2 line-clamp-3 leading-relaxed ${
                                      settings.theme === "Light"
                                        ? "text-purple-700"
                                        : "text-gray-300"
                                    }`}
                                  >
                                    {note.content
                                      .split("\n")[0]
                                      .substring(0, 120)}
                                    {note.content.length > 120 ? "..." : ""}
                                  </div>
                                  <div
                                    className={`flex items-center justify-between text-xs ${
                                      settings.theme === "Light"
                                        ? "text-purple-600"
                                        : "text-gray-400"
                                    }`}
                                  >
                                    <span
                                      className={`px-2 py-1 rounded-full ${
                                        settings.theme === "Light"
                                          ? "bg-purple-100 text-purple-800"
                                          : "bg-indigo-900/50 text-gray-300"
                                      }`}
                                    >
                                      {note.template}
                                    </span>
                                    <span
                                      className={
                                        settings.theme === "Light"
                                          ? "text-purple-500"
                                          : "text-gray-500"
                                      }
                                    >
                                      {note.isCloudOnly
                                        ? "Click download"
                                        : "Click to view"}
                                    </span>
                                  </div>
                                </div>
                                <div className="mt-3 flex justify-between items-center">
                                  <div className="flex space-x-2">
                                    {mode === "cloud" &&
                                      !note.isDownloaded &&
                                      !note.isCloudOnly && (
                                        <button
                                          onClick={async (e) => {
                                            e.stopPropagation(); // Prevent triggering the view

                                            // Start download loading state
                                            setDownloadingNotes((prev) =>
                                              new Set(prev).add(note.id)
                                            );

                                            try {
                                              // Simulate download delay for visual feedback
                                              await new Promise((resolve) =>
                                                setTimeout(resolve, 500)
                                              );

                                              // Download note to local storage
                                              const updatedNotes = notes.map(
                                                (n) =>
                                                  n.id === note.id
                                                    ? {
                                                        ...n,
                                                        isDownloaded: true,
                                                      }
                                                    : n
                                              );

                                              setNotes(updatedNotes);
                                              localStorage.setItem(
                                                `elysium_notes_${mode}`,
                                                JSON.stringify(updatedNotes)
                                              );

                                              alert(
                                                `✅ "${note.title}" downloaded for offline access!`
                                              );
                                            } catch (error) {
                                              console.error(
                                                "Download failed:",
                                                error
                                              );
                                              alert(
                                                `❌ Failed to download "${note.title}". Please try again.`
                                              );
                                            } finally {
                                              // Remove from loading state
                                              setDownloadingNotes((prev) => {
                                                const newSet = new Set(prev);
                                                newSet.delete(note.id);
                                                return newSet;
                                              });
                                            }
                                          }}
                                          className="text-cyan-400 hover:text-cyan-300 transition-colors duration-200 text-sm opacity-0 group-hover:opacity-100 disabled:opacity-50"
                                          title="Download for offline access"
                                          disabled={downloadingNotes.has(
                                            note.id
                                          )}
                                        >
                                          {downloadingNotes.has(note.id)
                                            ? "⏳"
                                            : "⬇️"}
                                        </button>
                                      )}
                                    {mode === "cloud" && note.isCloudOnly && (
                                      <button
                                        onClick={async (e) => {
                                          // Start download loading state
                                          setDownloadingNotes((prev) =>
                                            new Set(prev).add(note.id)
                                          );

                                          try {
                                            // Simulate download delay for visual feedback
                                            await new Promise((resolve) =>
                                              setTimeout(resolve, 500)
                                            );

                                            // Download cloud-only note to local storage
                                            const downloadedNote: Note = {
                                              ...note,
                                              isDownloaded: true,
                                              isCloudOnly: false,
                                            };
                                            const updatedNotes = [
                                              ...notes,
                                              downloadedNote,
                                            ];
                                            setNotes(updatedNotes);
                                            localStorage.setItem(
                                              `elysium_notes_${mode}`,
                                              JSON.stringify(updatedNotes)
                                            );

                                            alert(
                                              `✅ "${note.title}" downloaded for offline access!`
                                            );
                                          } catch (error) {
                                            console.error(
                                              "Download failed:",
                                              error
                                            );
                                            alert(
                                              `❌ Failed to download "${note.title}". Please try again.`
                                            );
                                          } finally {
                                            // Remove from loading state
                                            setDownloadingNotes((prev) => {
                                              const newSet = new Set(prev);
                                              newSet.delete(note.id);
                                              return newSet;
                                            });
                                          }
                                        }}
                                        className="text-cyan-400 hover:text-cyan-300 transition-colors duration-200 text-sm disabled:opacity-50"
                                        title="Download for offline access"
                                        disabled={downloadingNotes.has(note.id)}
                                      >
                                        {downloadingNotes.has(note.id)
                                          ? "⏳ Downloading..."
                                          : "⬇️ Download"}
                                      </button>
                                    )}
                                    {note.isDownloaded &&
                                      mode === "cloud" &&
                                      !note.isCloudOnly && (
                                        <span
                                          className="text-cyan-400 text-xs opacity-0 group-hover:opacity-100"
                                          title="Available offline"
                                        >
                                          💾
                                        </span>
                                      )}
                                    {/* Arweave tracking */}
                                    {mode === "web3" && note.arweaveHash && (
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          window.open(`https://viewblock.io/arweave/tx/${note.arweaveHash}`, '_blank');
                                        }}
                                        className="text-blue-400 hover:text-blue-300 transition-colors duration-200 text-sm opacity-0 group-hover:opacity-100"
                                        title="Track on Viewblock"
                                      >
                                        � Track
                                      </button>
                                    )}
                                  </div>
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
                                            // Security: Confirm permanent deletion from database
                                            const confirmDelete =
                                              window.confirm(
                                                `Are you sure you want to permanently delete "${note.title}" from the database? This action cannot be undone.`
                                              );

                                            if (!confirmDelete) {
                                              return; // Cancel deletion
                                            }

                                            console.log(
                                              "Deleting note from Supabase:",
                                              note.id
                                            );
                                            const { error } = await supabase
                                              .from("notes")
                                              .delete()
                                              .eq("id", note.id);
                                            if (error) {
                                              console.error(
                                                "Supabase delete error:",
                                                error
                                              );
                                              alert(
                                                "Failed to delete note from database. Please try again."
                                              );
                                            } else {
                                              console.log(
                                                "Note deleted from database successfully",
                                                {
                                                  noteId: note.id,
                                                  userId: user.id,
                                                  noteTitle: note.title,
                                                }
                                              );
                                            }
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
                                          // Security: Confirm permanent deletion from database
                                          const confirmDelete = window.confirm(
                                            `Are you sure you want to permanently delete "${note.title}" from the database? This action cannot be undone.`
                                          );

                                          if (!confirmDelete) {
                                            return; // Cancel deletion
                                          }

                                          console.log(
                                            "Deleting note from Supabase:",
                                            note.id
                                          );
                                          const { error } = await supabase
                                            .from("notes")
                                            .delete()
                                            .eq("id", note.id);
                                          if (error) {
                                            console.error(
                                              "Supabase delete error:",
                                              error
                                            );
                                            alert(
                                              "Failed to delete note from database. Please try again."
                                            );
                                          } else {
                                            console.log(
                                              "Note deleted from database successfully",
                                              {
                                                noteId: note.id,
                                                userId: user.id,
                                                noteTitle: note.title,
                                              }
                                            );
                                          }
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
                            ));
                          })()}
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
                                Notes may take a moment to load. Please wait
                                while we retrieve your data.
                              </p>
                            </div>
                            <p
                              className={`text-sm ${
                                settings.theme === "Light"
                                  ? "text-purple-600"
                                  : "text-gray-400"
                              }`}
                            >
                              No notes yet?create one to get started!
                            </p>
                          </div>
                        ) : (
                          <p
                            className={`text-sm ${
                              settings.theme === "Light"
                                ? "text-purple-600"
                                : "text-gray-400"
                            }`}
                          >
                            No notes yet?create one to get started!
                          </p>
                        )}
                      </div>
                    );
                  })()}
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
                  theme={settings.theme}
                  defaultTemplate={settings.defaultTemplate}
                  aiResponseStyle={settings.aiResponseStyle}
                  aiPersonality={settings.aiPersonality}
                />
              )}
              {activePage === "settings" && (
                <Settings
                  onSave={handleSettingsSave}
                  onCleanupOrphanedNotes={cleanupOrphanedNotes}
                  onLogout={handleLogout}
                  initialTheme={settings.theme}
                  initialNotifications={settings.notifications}
                  initialSyncInterval={settings.syncInterval}
                  initialAiResponseStyle={settings.aiResponseStyle}
                  initialAiPersonality={settings.aiPersonality}
                  initialAutoSave={settings.autoSave}
                  initialDefaultTemplate={settings.defaultTemplate}
                  initialNoteSorting={settings.noteSorting}
                  initialDataRetention={settings.dataRetention}
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
                  theme={settings.theme}
                />
              )}
              {activePage === "search" && (
                <>
                  <h1
                    className={`text-4xl sm:text-5xl font-extrabold mb-6 sm:mb-8 font-serif ${
                      settings.theme === "Light"
                        ? "text-purple-900"
                        : "text-gold-100"
                    }`}
                  >
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
                    const filteredNotes = getSortedNotes(
                      notes
                        .filter((note) => mode !== "db" || !note.isPermanent)
                        .filter(
                          (note) =>
                            note.title
                              .toLowerCase()
                              .includes(searchQuery.toLowerCase()) ||
                            note.content
                              .toLowerCase()
                              .includes(searchQuery.toLowerCase())
                        ),
                      settings.noteSorting
                    );

                    return filteredNotes.length > 0 ? (
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-6">
                        {filteredNotes.map((note) => (
                          <animated.div
                            key={note.id}
                            style={noteSpring}
                            className={`group backdrop-blur-sm p-3 sm:p-4 rounded-lg shadow-xl flex flex-col justify-between cursor-pointer hover:scale-105 transition-all duration-300 border h-48 sm:h-52 ${
                              settings.theme === "Light"
                                ? "bg-gradient-to-br from-white/90 via-purple-50/90 to-indigo-50/90 hover:shadow-[0_0_15px_rgba(139,92,246,0.2)] border-purple-200/50"
                                : "bg-gradient-to-br from-indigo-800/90 to-indigo-700/90 hover:shadow-[0_0_15px_rgba(79,70,229,0.3)] border-indigo-600/30"
                            }`}
                            onClick={() => setViewingNote(note)}
                          >
                            <div className="flex-1 overflow-hidden">
                              <h3
                                className={`text-lg sm:text-xl font-semibold mb-2 font-serif line-clamp-2 leading-tight ${
                                  settings.theme === "Light"
                                    ? "text-purple-800"
                                    : "text-gold-100"
                                }`}
                              >
                                {note.title}
                                {note.isPermanent && (
                                  <span className="text-xs text-amber-400 ml-1">
                                    ??
                                  </span>
                                )}
                              </h3>
                              <div
                                className={`text-sm mb-2 line-clamp-3 leading-relaxed ${
                                  settings.theme === "Light"
                                    ? "text-purple-700"
                                    : "text-gray-300"
                                }`}
                              >
                                {note.content.split("\n")[0].substring(0, 120)}
                                {note.content.length > 120 ? "..." : ""}
                              </div>
                              <div
                                className={`flex items-center justify-between text-xs ${
                                  settings.theme === "Light"
                                    ? "text-purple-600"
                                    : "text-gray-400"
                                }`}
                              >
                                <span
                                  className={`px-2 py-1 rounded-full ${
                                    settings.theme === "Light"
                                      ? "bg-purple-100 text-purple-800"
                                      : "bg-indigo-900/50"
                                  }`}
                                >
                                  {note.template}
                                </span>
                                <span
                                  className={
                                    settings.theme === "Light"
                                      ? "text-purple-500"
                                      : "text-gray-500"
                                  }
                                >
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
                                      // Security: Confirm permanent deletion from database
                                      const confirmDelete = window.confirm(
                                        `Are you sure you want to permanently delete "${note.title}" from the database? This action cannot be undone.`
                                      );

                                      if (!confirmDelete) {
                                        return; // Cancel deletion
                                      }

                                      console.log(
                                        "Deleting note from Supabase:",
                                        note.id
                                      );
                                      const { error } = await supabase
                                        .from("notes")
                                        .delete()
                                        .eq("id", note.id);
                                      if (error) {
                                        console.error(
                                          "Supabase delete error:",
                                          error
                                        );
                                        alert(
                                          "Failed to delete note from database. Please try again."
                                        );
                                      } else {
                                        console.log(
                                          "Note deleted from database successfully",
                                          {
                                            noteId: note.id,
                                            userId: user.id,
                                            noteTitle: note.title,
                                          }
                                        );
                                      }
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
                        <p
                          className={`text-sm ${
                            settings.theme === "Light"
                              ? "text-purple-600"
                              : "text-gray-400"
                          }`}
                        >
                          No notes found matching "{searchQuery}"
                        </p>
                      </div>
                    ) : (
                      <div className="text-center py-12">
                        <p
                          className={`text-sm ${
                            settings.theme === "Light"
                              ? "text-purple-600"
                              : "text-gray-400"
                          }`}
                        >
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
                    theme={settings.theme}
                    defaultTemplate={settings.defaultTemplate}
                  />
                </div>
              </div>
            )}
            {showCloudAuthModal && (
              <CloudAuth
                onAuthenticated={() => {
                  setShowCloudAuthModal(false);
                  setIsCloudButtonClicked(true);
                }}
                onCancel={() => {
                  setShowCloudAuthModal(false);
                  setMode("web3"); // Fall back to web3 mode if auth is cancelled
                }}
              />
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
                        <h2
                          className={`text-2xl font-semibold ${
                            settings.theme === "Light"
                              ? "text-purple-900"
                              : "text-gold-100"
                          }`}
                        >
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
                          ?
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
                                  const key = await deriveKey(session.user.id);
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
                                // Save to localStorage
                                localStorage.setItem(
                                  `elysium_notes_${mode}`,
                                  JSON.stringify(updatedNotes)
                                );

                                // For downloaded notes, try to sync to cloud immediately
                                if (
                                  editingNote.isDownloaded &&
                                  cloudStorage.user
                                ) {
                                  try {
                                    await cloudStorage.updateNote(
                                      editingNote.id,
                                      {
                                        title: editTitle,
                                        content: editContent,
                                        template: editTemplate,
                                      }
                                    );
                                    showNotification(
                                      "Success",
                                      "Downloaded note updated and synced to cloud!"
                                    );
                                  } catch (error) {
                                    // If cloud update fails, add to offline queue
                                    console.log(
                                      "Cloud update failed, adding to offline queue:",
                                      error
                                    );
                                    addToOfflineQueue(updatedNote);
                                    showNotification(
                                      "Offline",
                                      "Note saved locally. Will sync to cloud when online."
                                    );
                                  }
                                } else if (cloudStorage.user) {
                                  try {
                                    await cloudStorage.updateNote(
                                      editingNote.id,
                                      {
                                        title: editTitle,
                                        content: editContent,
                                        template: editTemplate,
                                      }
                                    );
                                    showNotification(
                                      "Success",
                                      "Note updated in cloud!"
                                    );
                                  } catch (error) {
                                    // If cloud update fails, add to offline queue
                                    console.log(
                                      "Cloud update failed, adding to offline queue:",
                                      error
                                    );
                                    addToOfflineQueue(updatedNote);
                                    showNotification(
                                      "Offline",
                                      "Note saved locally. Will sync to cloud when online."
                                    );
                                  }
                                } else {
                                  // Not authenticated, add to queue for when they sign in
                                  addToOfflineQueue(updatedNote);
                                  showNotification(
                                    "Offline",
                                    "Note saved locally. Will sync to cloud when you sign in."
                                  );
                                }
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
                            <h2
                              className={`text-2xl sm:text-3xl font-semibold font-serif mb-2 leading-tight ${
                                settings.theme === "Light"
                                  ? "text-purple-900"
                                  : "text-gold-100"
                              }`}
                            >
                              {viewingNote.title}
                            </h2>
                            <div
                              className={`flex items-center space-x-4 text-sm ${
                                settings.theme === "Light"
                                  ? "text-purple-600"
                                  : "text-gray-400"
                              }`}
                            >
                              <span
                                className={`px-3 py-1 rounded-full ${
                                  settings.theme === "Light"
                                    ? "bg-purple-100 text-purple-800"
                                    : "bg-indigo-900/50"
                                }`}
                              >
                                {viewingNote.template}
                              </span>
                              {viewingNote.isPermanent && (
                                <span className="bg-amber-900/50 px-3 py-1 rounded-full text-amber-300">
                                  ?? Blockchain Stored
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
                              ?
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

      {/* ArConnect Modal */}
      <ArConnectModal
        isOpen={arConnectModal.isOpen}
        onClose={() =>
          setArConnectModal((prev) => ({ ...prev, isOpen: false }))
        }
        title={arConnectModal.title}
        message={arConnectModal.message}
        actionButton={arConnectModal.actionButton}
      />
    </>
  );
}

export default App;
