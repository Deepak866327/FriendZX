import { PrismaClient } from '@prisma/client';

let prismaInstance: PrismaClient | undefined;

export function getPrisma(): PrismaClient {
  if (!prismaInstance) {
    prismaInstance = new PrismaClient({
      log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
    });
  }
  return prismaInstance;
}

export type { PrismaClient };
