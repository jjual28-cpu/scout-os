/** Minimal timestamped logger. */
export const log = (message: string, meta?: unknown): void => {
  const ts = new Date().toISOString();
  if (meta !== undefined) console.log(`[${ts}] ${message}`, meta);
  else console.log(`[${ts}] ${message}`);
};
