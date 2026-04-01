/** Minimal structured logger — swap for pino/winston if needed. */
export function log(...args: unknown[]): void {
  console.log(new Date().toISOString(), ...args)
}

export function warn(...args: unknown[]): void {
  console.warn(new Date().toISOString(), '[WARN]', ...args)
}

export function error(...args: unknown[]): void {
  console.error(new Date().toISOString(), '[ERROR]', ...args)
}
