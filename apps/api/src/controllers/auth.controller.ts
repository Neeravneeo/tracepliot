import { Request, Response } from "express";
import { getRepository } from "../db";
import { hashPassword, verifyPassword, signUserToken } from "../crypto";
import { isAuthPaused } from "../middleware/auth";

export function authStatusHandler(req: Request, res: Response): void {
  res.status(200).json({
    authPaused: isAuthPaused(),
    mode: isAuthPaused() ? "testing" : "enforced"
  });
}

export async function registerHandler(req: Request, res: Response): Promise<void> {
  const { email, password } = req.body;
  if (!email || !password || typeof email !== "string" || typeof password !== "string") {
    res.status(400).json({ error: "BadRequest", message: "Email and password are required." });
    return;
  }

  // If auth is paused for testing, accept any registration
  if (isAuthPaused()) {
    try {
      const repo = getRepository();
      const existing = await repo.findUserByEmail(email);
      if (existing) {
        const token = signUserToken(existing.id);
        res.status(200).json({ token, user: { id: existing.id, email: existing.email } });
        return;
      }
      const passwordHash = hashPassword(password);
      const user = await repo.createUser(email, passwordHash);
      const token = signUserToken(user.id);
      res.status(201).json({ token, user: { id: user.id, email: user.email } });
      return;
    } catch {
      const token = signUserToken("usr_dev_testing");
      res.status(201).json({ token, user: { id: "usr_dev_testing", email } });
      return;
    }
  }

  const repo = getRepository();
  const existing = await repo.findUserByEmail(email);
  if (existing) {
    res.status(409).json({ error: "Conflict", message: "Email is already registered." });
    return;
  }

  const passwordHash = hashPassword(password);
  const user = await repo.createUser(email, passwordHash);

  const token = signUserToken(user.id);
  res.status(201).json({ token, user: { id: user.id, email: user.email } });
}

export async function loginHandler(req: Request, res: Response): Promise<void> {
  const { email, password } = req.body;

  // If auth is paused for testing, accept any login attempt or auto-provision dev user
  if (isAuthPaused()) {
    try {
      const repo = getRepository();
      const loginEmail = (typeof email === "string" && email.trim()) ? email.trim() : "developer@tracepilot.dev";
      let user = await repo.findUserByEmail(loginEmail);
      if (!user) {
        user = await repo.createUser(loginEmail, "dev_pw_hash");
      }
      const token = signUserToken(user.id);
      res.status(200).json({ token, user: { id: user.id, email: user.email } });
      return;
    } catch {
      const token = signUserToken("usr_dev_testing");
      res.status(200).json({ token, user: { id: "usr_dev_testing", email: email || "developer@tracepilot.dev" } });
      return;
    }
  }

  if (!email || !password || typeof email !== "string" || typeof password !== "string") {
    res.status(400).json({ error: "BadRequest", message: "Email and password are required." });
    return;
  }

  const repo = getRepository();
  const user = await repo.findUserByEmail(email);
  if (!user || !verifyPassword(password, user.passwordHash)) {
    res.status(401).json({ error: "Unauthorized", message: "Invalid email or password." });
    return;
  }

  const token = signUserToken(user.id);
  res.status(200).json({ token, user: { id: user.id, email: user.email } });
}

export function logoutHandler(req: Request, res: Response): void {
  res.status(200).json({ message: "Logged out successfully" });
}

// In-memory token store for password reset tokens in testing/dev
const resetTokenStore = new Map<string, { email: string; expiresAt: number }>();

export async function requestPasswordResetHandler(req: Request, res: Response): Promise<void> {
  const { email } = req.body || {};

  // Protection against enumeration: always respond with 200 and standard message
  const genericSuccess = {
    message: "If that email address is registered, password reset instructions have been sent."
  };

  if (!email || typeof email !== "string" || !email.includes("@")) {
    res.status(200).json(genericSuccess);
    return;
  }

  try {
    const repo = getRepository();
    const user = await repo.findUserByEmail(email.toLowerCase().trim());
    if (user) {
      const resetToken = "rst_" + Math.random().toString(36).substring(2) + Date.now().toString(36);
      resetTokenStore.set(resetToken, {
        email: user.email,
        expiresAt: Date.now() + 15 * 60 * 1000 // 15 min expiry
      });
      // In production/email service, send resetToken via email.
    }
    res.status(200).json(genericSuccess);
  } catch {
    res.status(200).json(genericSuccess);
  }
}

export async function resetPasswordHandler(req: Request, res: Response): Promise<void> {
  const { token, newPassword } = req.body || {};

  if (!token || !newPassword || typeof token !== "string" || typeof newPassword !== "string" || newPassword.length < 6) {
    res.status(400).json({ error: "BadRequest", message: "Token and valid new password (at least 6 characters) are required." });
    return;
  }

  const record = resetTokenStore.get(token);
  if (!record || record.expiresAt < Date.now()) {
    resetTokenStore.delete(token);
    res.status(400).json({ error: "BadRequest", message: "Invalid or expired password reset token." });
    return;
  }

  try {
    const repo = getRepository();
    const user = await repo.findUserByEmail(record.email);
    if (!user) {
      res.status(400).json({ error: "BadRequest", message: "User not found." });
      return;
    }

    const newHash = hashPassword(newPassword);
    // Update password in database or repository
    const prisma = (repo as any).prisma;
    if (prisma) {
      await prisma.user.update({
        where: { id: user.id },
        data: { passwordHash: newHash }
      });
    } else {
      user.passwordHash = newHash;
    }

    resetTokenStore.delete(token);
    res.status(200).json({ message: "Password updated successfully. You can now log in with your new password." });
  } catch (err: unknown) {
    console.error("[Auth] Failed to reset password:", err);
    res.status(500).json({ error: "InternalServerError", message: "Failed to reset password." });
  }
}

