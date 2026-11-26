import { Request, Response, NextFunction } from "express";
import { hashApiKey, verifyUserToken } from "../crypto";
import { getRepository, ProjectRecord, UserRecord } from "../db";

// Extend express Request to include authenticated project and user
declare global {
  namespace Express {
    interface Request {
      project?: ProjectRecord;
      user?: UserRecord;
    }
  }
}

/**
 * Check whether authentication is paused for testing.
 * Can be controlled via environment variable PAUSE_AUTH=true or DISABLE_AUTH=true.
 */
export function isAuthPaused(): boolean {
  return process.env.PAUSE_AUTH === "true" || process.env.DISABLE_AUTH === "true";
}

const DEV_USER: UserRecord = {
  id: "usr_dev_testing",
  email: "developer@tracepilot.dev",
  passwordHash: "dev_pw_hash",
  createdAt: new Date(),
  updatedAt: new Date()
};

const DEV_PROJECT: ProjectRecord = {
  id: "proj_dev_testing",
  name: "Dev Testing Project",
  ownerId: "usr_dev_testing",
  createdAt: new Date(),
  updatedAt: new Date()
};

export async function requireApiKey(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  const authHeader = req.headers["authorization"] || "";
  let apiKey = "";

  if (authHeader.startsWith("Bearer ")) {
    apiKey = authHeader.slice(7).trim();
  } else if (req.headers["x-api-key"]) {
    apiKey = String(req.headers["x-api-key"]).trim();
  }

  const repo = getRepository();

  if (apiKey) {
    try {
      const keyHash = hashApiKey(apiKey);
      const project = await repo.findProjectByApiKeyHash(keyHash);
      if (project) {
        req.project = project;
        return next();
      }
    } catch (err: unknown) {
      console.error("[Auth] Error validating API key:", err);
    }
  }

  // If auth is paused for testing, bypass key check and attach/create default testing project
  if (isAuthPaused()) {
    try {
      let user = await repo.findUserByEmail("developer@tracepilot.dev");
      if (!user) {
        user = await repo.createUser("developer@tracepilot.dev", "dev_pw_hash");
      }
      const projects = await repo.listProjectsByOwner(user.id);
      let project = projects[0];
      if (!project) {
        project = await repo.createProject("Dev Testing Project", user.id, "proj_dev_testing");
      }
      req.project = project;
      return next();
    } catch (fallbackErr) {
      console.warn("[Auth] Using dev fallback project while auth is paused");
      req.project = DEV_PROJECT;
      return next();
    }
  }

  res.status(401).json({
    error: "Unauthorized",
    message: "Missing or invalid API key. Provide via 'Authorization: Bearer <API_KEY>' header."
  });
}

export async function requireUserAuth(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  const authHeader = req.headers["authorization"] || "";
  let token = "";

  if (authHeader.startsWith("Bearer ")) {
    token = authHeader.slice(7).trim();
  }

  const repo = getRepository();

  if (token && token !== "dev_testing_token") {
    try {
      const decoded = verifyUserToken(token);
      if (decoded && decoded.userId) {
        const user = await repo.findUserById(decoded.userId);
        if (user) {
          req.user = user;
          return next();
        }
      }
    } catch (err: unknown) {
      console.error("[Auth] Error validating user token:", err);
    }
  }

  // If auth is paused for testing, bypass token check and attach/create default testing user
  if (isAuthPaused()) {
    try {
      let user = await repo.findUserByEmail("developer@tracepilot.dev");
      if (!user) {
        user = await repo.createUser("developer@tracepilot.dev", "dev_pw_hash");
      }
      req.user = user;
      return next();
    } catch (fallbackErr) {
      console.warn("[Auth] Using dev fallback user while auth is paused");
      req.user = DEV_USER;
      return next();
    }
  }

  res.status(401).json({ error: "Unauthorized", message: "Missing or invalid JWT Bearer token." });
}

