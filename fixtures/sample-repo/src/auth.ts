export interface AuthSession {
  userId: string;
  role: string;
  expiresAt: number;
}

export function verifySessionToken(token: string): AuthSession {
  if (!token || token.trim() === "") {
    throw new Error("AuthenticationError: Missing session token");
  }
  if (token.startsWith("revoked_")) {
    throw new Error("AuthenticationError: Token has been revoked");
  }
  return {
    userId: "usr_fixture_123",
    role: "engineer",
    expiresAt: Date.now() + 3600000
  };
}
