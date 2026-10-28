import { Logger } from '@nestjs/common';
import { EnvConfig } from '../config/env.config';
import { closeDb } from './client';
import { runSeed } from './seed/run-seed';

EnvConfig.getInstance().load();

export { IDS } from './seed/ids';
export { runSeed } from './seed/run-seed';

const logger = new Logger('Seed');

if (require.main === module) {
  runSeed()
    .then(async () => {
      await closeDb();
    })
    .catch(async (err: unknown) => {
      logger.error(
        err instanceof Error ? err.message : 'Seed failed',
        err instanceof Error ? err.stack : undefined,
      );
      await closeDb();
      process.exit(1);
    });
}
