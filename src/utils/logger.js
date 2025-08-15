const winston = require('winston');
const path = require('path');
const config = require('../config');

const logFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  winston.format.splat(),
  winston.format.json()
);

const logger = winston.createLogger({
  level: config.logging.level,
  format: logFormat,
  defaultMeta: { service: 'kol-directory' },
  transports: [
    new winston.transports.File({
      filename: path.join(config.logging.filePath.replace('app.log', 'error.log')),
      level: 'error',
    }),
    new winston.transports.File({
      filename: config.logging.filePath,
    }),
  ],
});

if (config.server.env !== 'production') {
  logger.add(new winston.transports.Console({
    format: winston.format.combine(
      winston.format.colorize(),
      winston.format.simple()
    ),
  }));
}

module.exports = logger;