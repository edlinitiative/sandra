import { startServer } from './server'
import { log, error as logError } from './logger'

process.on('uncaughtException', (err) => {
  logError('[Process] Uncaught exception:', err)
  process.exit(1)
})

process.on('unhandledRejection', (reason) => {
  logError('[Process] Unhandled rejection:', reason)
  process.exit(1)
})

log('[Process] Sandra Voice Bridge starting...')
startServer()
