import type { Tx } from '../prisma';

/**
 * Allocates the next case number for the current year: EV-2026-0001.
 * Must run inside a transaction — the counter row is the lock that keeps two
 * concurrent project creations from claiming the same number.
 */
export async function nextCaseNumber(tx: Tx): Promise<string> {
  const year = new Date().getFullYear();

  const counter = await tx.caseCounter.upsert({
    where: { year },
    create: { year, lastNumber: 1 },
    update: { lastNumber: { increment: 1 } },
  });

  return `EV-${year}-${String(counter.lastNumber).padStart(4, '0')}`;
}
