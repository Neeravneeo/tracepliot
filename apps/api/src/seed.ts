import dotenv from "dotenv";
dotenv.config();

import { getPrismaClient } from "./db";
import { hashApiKey } from "./crypto";

const DEFAULT_API_KEY = process.env.TRACEPILOT_API_KEY || "tp_dev_secret_key_demo123456789";
const DEFAULT_PROJECT_NAME = "TracePilot Demo Project";

async function main() {
  console.log("🌱 Seeding TracePilot PostgreSQL Database...");

  const prisma = getPrismaClient();
  const apiKeyHash = hashApiKey(DEFAULT_API_KEY);

  let project = await prisma.project.findFirst({
    where: { name: DEFAULT_PROJECT_NAME }
  });

  if (!project) {
    project = await prisma.project.create({
      data: {
        name: DEFAULT_PROJECT_NAME,
        id: "a02dd415-0ef3-4f84-a92b-d923a5296d", // Match existing ID
      }
    });
  }

  const existingKey = await prisma.apiKey.findUnique({
    where: { keyHash: apiKeyHash }
  });

  if (!existingKey) {
    await prisma.apiKey.create({
      data: {
        projectId: project.id,
        keyHash: apiKeyHash,
        name: "Default API Key"
      }
    });
  }

  console.log("✅ Seed completed successfully!");
  console.log("--------------------------------------------------");
  console.log(`Project ID:      ${project.id}`);
  console.log(`Project Name:    ${project.name}`);
  console.log(`API Key:         ${DEFAULT_API_KEY}`);
  console.log(`API Key Hash:    ${apiKeyHash}`);
  console.log("--------------------------------------------------");
  console.log("💡 You can now set this API key in your demo application:");
  console.log(`TRACEPILOT_API_KEY="${DEFAULT_API_KEY}"`);
}

main()
  .catch((e) => {
    console.error("❌ Seed failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    const prisma = getPrismaClient();
    await prisma.$disconnect();
  });
