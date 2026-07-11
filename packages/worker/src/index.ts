import 'dotenv/config';

import { log } from './logger.js';
import { requestStop, runLoop } from './runner.js';

process.on('SIGINT', requestStop);
process.on('SIGTERM', requestStop);

runLoop().catch((err) => {
  log('fatal error — worker exiting', err);
  process.exit(1);
});
