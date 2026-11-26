import crypto from "crypto";
import jwt from "jsonwebtoken";

const API_KEY_SECRET = process.env.API_KEY_SECRET || "tracepilot_api_key_secret_default_hmac";

/**
 * Creates a secure SHA-256 hash of an API key for safe database storage and lookup.
 * We never store plaintext API keys in the database.
 */
export function hashApiKey(apiKey: string): string {
  return crypto.createHash("sha256").update(apiKey.trim()).digest("hex");
}

/**
 * Creates a keyed HMAC-SHA-256 hash of an API key for enhanced authentication security.
 */
export function hmacApiKey(apiKey: string): string {
  return crypto.createHmac("sha256", API_KEY_SECRET).update(apiKey.trim()).digest("hex");
}

/**
 * Constant-time comparison to verify candidate API key against stored hash.
 * Supports both HMAC-SHA-256 and legacy SHA-256 hashes safely.
 */
export function verifyApiKeyHash(candidateKey: string, storedHash: string): boolean {
  if (!candidateKey || !storedHash) return false;

  const candidateHmac = hmacApiKey(candidateKey);
  const candidateSha256 = hashApiKey(candidateKey);

  // Constant-time check against HMAC hash
  if (storedHash.length === candidateHmac.length) {
    try {
      if (crypto.timingSafeEqual(Buffer.from(candidateHmac), Buffer.from(storedHash))) {
        return true;
      }
    } catch {
      // Length mismatch safety
    }
  }

  // Constant-time check against legacy SHA-256 hash
  if (storedHash.length === candidateSha256.length) {
    try {
      if (crypto.timingSafeEqual(Buffer.from(candidateSha256), Buffer.from(storedHash))) {
        return true;
      }
    } catch {
      // Length mismatch safety
    }
  }

  return false;
}

/**
 * Generates a high-entropy cryptographically random API key.
 * Format: tp_live_<publicId>_<secretEntropy>
 */
export function generateApiKey(prefix = "tp_live"): { rawKey: string; keyHash: string; publicId: string } {
  const publicId = crypto.randomBytes(8).toString("hex");
  const secretEntropy = crypto.randomBytes(24).toString("hex");
  const rawKey = `${prefix}_${publicId}_${secretEntropy}`;
  const keyHash = hashApiKey(rawKey);

  return { rawKey, keyHash, publicId };
}

/**
 * Computes a deterministic error fingerprint based on exception type, normalized message,
 * and the first meaningful stack frame.
 */
export function generateFingerprint(
  exceptionType: string,
  message: string,
  stack?: string
): string {
  let firstFrame = "";
  if (stack) {
    const lines = stack.split("\n").map((l) => l.trim());
    const frameLine = lines.find((l) => l.startsWith("at ") && !l.includes("node:internal"));
    if (frameLine) {
      firstFrame = frameLine;
    }
  }

  const rawFingerprint = `${exceptionType}::${message.trim()}::${firstFrame}`;
  return crypto.createHash("sha256").update(rawFingerprint).digest("hex").slice(0, 32);
}

// Password Hashing using scrypt (Node.js built-in)
export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString("hex");
  const derivedKey = crypto.scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${derivedKey}`;
}

export function verifyPassword(password: string, hash: string): boolean {
  const [salt, key] = hash.split(":");
  if (!salt || !key) return false;
  const keyBuffer = Buffer.from(key, "hex");
  const derivedKey = crypto.scryptSync(password, salt, 64);
  return crypto.timingSafeEqual(keyBuffer, derivedKey);
}

// JWT helpers
const JWT_SECRET = process.env.JWT_SECRET || "tracepilot_jwt_secret_dev";

export function signUserToken(userId: string): string {
  return jwt.sign({ userId }, JWT_SECRET, { expiresIn: "7d" });
}

export function verifyUserToken(token: string): { userId: string } | null {
  try {
    return jwt.verify(token, JWT_SECRET) as { userId: string };
  } catch {
    return null;
  }
}
