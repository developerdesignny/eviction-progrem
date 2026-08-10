import { bootstrap } from './bootstrap';
import { prisma } from './prisma';

/**
 * Manual entry point for the same startup work the server does on boot: apply pending
 * migrations, then create the first user if there are none. Useful for preparing a
 * database without starting the app.
 *
 * Stages and stage fields are deliberately NOT seeded — the legacy Airtable task list
 * (sections B–H of docs/field-mapping.md) is reference only. The admin builds the real
 * stage list in the Configuration screen.
 */
bootstrap()
  .then(() => console.log('\n  Database ready.\n'))
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
