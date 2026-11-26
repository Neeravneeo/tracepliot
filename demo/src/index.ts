import dotenv from "dotenv";
dotenv.config();

import { tracepilot } from "@tracepilot/sdk";

// Initialize the TracePilot SDK
tracepilot.init({
  apiKey: process.env.TRACEPILOT_API_KEY || "tp_dev_secret_key_demo123456789",
  endpoint: process.env.TRACEPILOT_ENDPOINT || "http://localhost:4000",
  release: "1.0.0",
  environment: "development",
  debug: true
});

// Install safe global crash handler
tracepilot.installGlobalHandler();

interface UserProfile {
  name: string;
}

interface User {
  id: string;
  profile?: UserProfile;
}

const users: User[] = [
  { id: "user-1", profile: { name: "Alice Johnson" } },
  { id: "user-2" } // Intentional bug: profile is undefined!
];

/**
 * Buggy function: Attempts to access user.profile.name without null check.
 */
export function getUserProfileName(id: string): string {
  const user = users.find((u) => u.id === id);
  // Intentional bug when id === "user-2" or "user-99":
  // Cannot read properties of undefined (reading 'name') or (reading 'profile')
  return (user as any).profile.name;
}

/**
 * Simulates user action triggering the bug and capturing it with TracePilot SDK
 */
export async function triggerIntentionalBug(targetUserId = "user-2") {
  console.log(`\n==================================================`);
  console.log(`🚀 [Demo App] Executing getUserProfileName('${targetUserId}')...`);

  try {
    tracepilot.addBreadcrumb({
      category: "navigation",
      message: `Navigated to profile screen for ${targetUserId}`,
      level: "info"
    });

    const name = getUserProfileName(targetUserId);
    console.log(`[Demo App] User profile name found: ${name}`);
    return { success: true, name };
  } catch (error: unknown) {
    console.warn(`⚠️ [Demo App] Exception caught in user flow: ${(error as Error).message}`);
    console.log(`📡 [Demo App] Forwarding exception to TracePilot SDK...`);

    // Attach rich user scope & breadcrumbs
    tracepilot.setUser({ id: targetUserId, email: `${targetUserId}@demo.dev` });
    tracepilot.addBreadcrumb({
      category: "exception",
      message: `Uncaught exception in profile lookup: ${(error as Error).message}`,
      level: "error"
    });

    const result = await tracepilot.captureException(error, {
      tags: {
        feature: "profile",
        component: "user-service"
      },
      context: {
        userId: targetUserId,
        simulatedAction: "view_profile"
      }
    });

    // Ensure all queued telemetry is flushed
    await tracepilot.flush();

    if (result) {
      console.log(`🎉 [Demo App] Ingestion successful! Incident ID: ${result.incidentId}`);
    } else {
      console.log(`ℹ️ [Demo App] TracePilot captured event (buffered/offline fallback).`);
    }

    // Crucial requirement: Host application continues running smoothly!
    console.log(`🛡️ [Demo App] Host application remains healthy and operational!`);
    console.log(`==================================================\n`);
    return { success: false, incidentId: result?.incidentId, hostStillAlive: true };
  }
}

// When run directly from CLI
if (require.main === module) {
  (async () => {
    console.log("TracePilot Milestone 1 Demo App starting up...");
    // 1. Successful user fetch
    console.log("1. Fetching valid user profile:");
    try {
      const name = getUserProfileName("user-1");
      console.log(`   Success: Found profile for ${name}`);
    } catch (e) {
      console.error(e);
    }

    // 2. Intentional bug trigger
    console.log("\n2. Triggering intentional exception with 'user-2' (missing profile):");
    await triggerIntentionalBug("user-2");
  })();
}
