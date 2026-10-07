import bcrypt from 'bcryptjs';
import { env } from './env';
import { prisma } from './prisma';

/**
 * Creates the first user, and only when there are none. Idempotent, so it is safe on
 * every boot and on every Netlify Function cold start: once a user exists this never
 * touches the database again beyond one count. It means a fresh deploy is
 * signable-in without shell access.
 */
export async function ensureFirstUser(): Promise<void> {
  if ((await prisma.user.count()) > 0) return;

  await prisma.user.create({
    data: {
      name: env.adminName,
      email: env.adminEmail.toLowerCase(),
      passwordHash: await bcrypt.hash(env.adminPassword, 10),
    },
  });

  console.log(`  Created first user: ${env.adminEmail}`);
  console.log('  Change this password from Configuration > Users after signing in.');
}
