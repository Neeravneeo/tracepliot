import { TracePilotClient } from "./client";

export * from "./types";
export * from "./client";
export * from "./transport";
export * from "./scope";
export * from "./integrations/express";

export const tracepilot = new TracePilotClient();
export default tracepilot;
