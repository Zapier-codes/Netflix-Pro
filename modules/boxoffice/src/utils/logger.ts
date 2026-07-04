/**
 * Logger - Simple logging utility for the BoxOffice module.
 * Provides namespaced logging with configurable levels.
 */

export type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'silent'

export class Logger {
  private static instance: Logger
  private level: LogLevel = 'info'
  private namespace: string = 'BoxOffice'

  private constructor() {}

  static getInstance(): Logger {
    if (!Logger.instance) {
      Logger.instance = new Logger()
    }
    return Logger.instance
  }

  /**
   * Set the global log level.
   */
  setLevel(level: LogLevel): void {
    this.level = level
  }

  /**
   * Get the current log level.
   */
  getLevel(): LogLevel {
    return this.level
  }

  /**
   * Set the namespace prefix.
   */
  setNamespace(namespace: string): void {
    this.namespace = namespace
  }

  private shouldLog(level: LogLevel): boolean {
    const levels: LogLevel[] = ['debug', 'info', 'warn', 'error', 'silent']
    return levels.indexOf(level) >= levels.indexOf(this.level)
  }

  private formatMessage(level: LogLevel, message: string, ...args: any[]): string {
    const timestamp = new Date().toISOString()
    const argsStr = args.length > 0 ? ' ' + args.map(a => {
      try {
        return typeof a === 'object' ? JSON.stringify(a) : String(a)
      } catch {
        return '[Circular]'
      }
    }).join(' ') : ''
    return `[${timestamp}] [${this.namespace}] [${level.toUpperCase()}] ${message}${argsStr}`
  }

  debug(message: string, ...args: any[]): void {
    if (this.shouldLog('debug')) {
      console.debug(this.formatMessage('debug', message, ...args))
    }
  }

  info(message: string, ...args: any[]): void {
    if (this.shouldLog('info')) {
      console.info(this.formatMessage('info', message, ...args))
    }
  }

  warn(message: string, ...args: any[]): void {
    if (this.shouldLog('warn')) {
      console.warn(this.formatMessage('warn', message, ...args))
    }
  }

  error(message: string, ...args: any[]): void {
    if (this.shouldLog('error')) {
      console.error(this.formatMessage('error', message, ...args))
    }
  }

  /**
   * Log an error with stack trace.
   */
  logError(error: Error, context?: string): void {
    this.error(context ? `${context}: ${error.message}` : error.message, error.stack)
  }

  /**
   * Create a child logger with a sub-namespace.
   */
  child(childNamespace: string): Logger {
    const child = new Logger()
    child.level = this.level
    child.namespace = `${this.namespace}:${childNamespace}`
    return child
  }
}

// Default export - singleton instance
export const logger = Logger.getInstance()
export default Logger