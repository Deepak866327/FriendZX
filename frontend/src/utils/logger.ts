const LOG_LEVEL = import.meta.env.VITE_LOG_LEVEL || 'debug';

const levels = {
  error: 0,
  warn: 1,
  info: 2,
  debug: 3,
};

type LogLevel = keyof typeof levels;

export class Logger {
  private serviceName: string;
  private level: LogLevel;

  constructor(serviceName: string, level: LogLevel = 'debug') {
    this.serviceName = serviceName;
    this.level = (LOG_LEVEL as LogLevel) || level;
  }

  private shouldLog(level: LogLevel): boolean {
    return levels[level] <= levels[this.level];
  }

  info(message: string, data?: any) {
    if (this.shouldLog('info')) {
      console.log(`[${this.serviceName}]`, message, data || '');
    }
  }

  error(message: string, data?: any) {
    if (this.shouldLog('error')) {
      console.error(`[${this.serviceName}]`, message, data || '');
    }
  }

  warn(message: string, data?: any) {
    if (this.shouldLog('warn')) {
      console.warn(`[${this.serviceName}]`, message, data || '');
    }
  }

  debug(message: string, data?: any) {
    if (this.shouldLog('debug')) {
      console.debug(`[${this.serviceName}]`, message, data || '');
    }
  }
}