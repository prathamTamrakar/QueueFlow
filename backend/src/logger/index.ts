import pino from 'pino';
import { config } from '../config';

export const logger = pino({
  level: process.env.LOG_LEVEL || (config.env === 'development' ? 'debug' : 'info'),
  transport:
    config.env === 'development'
      ? {
          target: 'pino-pretty',
          options: {
            colorize: true,
            translateTime: 'yyyy-mm-dd HH:MM:ss.l',
            ignore: 'pid,hostname',
          },
        }
      : undefined,
  base: {
    env: config.env,
  },
  timestamp: pino.stdTimeFunctions.isoTime,
});
