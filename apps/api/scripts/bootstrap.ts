import { PrismaClient } from '@prisma/client';
import crypto from 'crypto';
import readline from 'readline';

const prisma = new PrismaClient();
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

const question = (query: string): Promise<string> => new Promise(resolve => rl.question(query, resolve));

// Mock basic password hash logic since we haven't implemented argon2 yet
// We will replace this with real hashing when we implement the API.
function hashPasswordMock(password: string): string {
  return crypto.createHash('sha256').update(password).digest('hex');
}

async function bootstrap() {
  console.log('--- TracePilot Bootstrap ---');
  
  // 1. Ask for email and password
  const email = process.env.BOOTSTRAP_EMAIL || await question('Enter Admin Email: ');
  const password = process.env.BOOTSTRAP_PASSWORD || await question('Enter Admin Password: ');
  
  if (!email || !password) {
    console.error('Email and password required.');
    process.exit(1);
  }

  const passwordHash = hashPasswordMock(password);

  console.log('Creating owner...');
  let user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    user = await prisma.user.create({
      data: {
        email,
        passwordHash,
      }
    });
    console.log('Owner created:', user.id);
  } else {
    console.log('Owner already exists:', user.id);
  }

  // 2. Assign legacy project
  const projects = await prisma.project.findMany();
  for (const project of projects) {
    if (!project.ownerId) {
      await prisma.project.update({
        where: { id: project.id },
        data: { ownerId: user.id }
      });
      console.log(`Assigned legacy project ${project.id} to owner.`);
    }

    // 3. Migrate legacy API keys
    if (project.apiKeyHash) {
      const existingKey = await prisma.apiKey.findFirst({ where: { projectId: project.id, keyHash: project.apiKeyHash } });
      if (!existingKey) {
        await prisma.apiKey.create({
          data: {
            projectId: project.id,
            keyHash: project.apiKeyHash,
            name: 'Legacy SDK Key'
          }
        });
        console.log(`Migrated legacy API key for project ${project.id}.`);
      }
    }

    // 4. Migrate environments
    const incidents = await prisma.incident.findMany({
      where: { projectId: project.id },
      select: { environment: true },
      distinct: ['environment']
    });

    for (const inc of incidents) {
      if (inc.environment) {
        const exists = await prisma.environment.findUnique({
          where: { projectId_name: { projectId: project.id, name: inc.environment } }
        });
        if (!exists) {
          await prisma.environment.create({
            data: {
              projectId: project.id,
              name: inc.environment
            }
          });
          console.log(`Migrated environment '${inc.environment}' for project ${project.id}.`);
        }
      }
    }
  }

  console.log('Bootstrap complete.');
  rl.close();
}

bootstrap().catch(console.error).finally(() => prisma.$disconnect());
