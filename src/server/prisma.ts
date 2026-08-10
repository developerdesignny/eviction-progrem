import { PrismaClient } from '@prisma/client';
import { env } from './env';

// The URL is passed explicitly rather than read from process.env by Prisma, so the
// DB_TARGET switch in env.ts is the single source of truth for what we connect to.
export const prisma = new PrismaClient({ datasourceUrl: env.databaseUrl });

export type Tx = Omit<
  PrismaClient,
  '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'
>;
