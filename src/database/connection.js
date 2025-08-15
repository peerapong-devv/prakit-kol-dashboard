const { Sequelize } = require('sequelize');
const config = require('../config');
const logger = require('../utils/logger');

const sequelize = new Sequelize(config.database.url, {
  logging: (msg) => logger.debug(msg),
  dialect: 'sqlite',
  storage: './data/kol_database.db',
});

const connectDB = async () => {
  try {
    await sequelize.authenticate();
    logger.info('Database connection established successfully');
    await sequelize.sync({ alter: true });
    logger.info('Database models synchronized');
  } catch (error) {
    logger.error('Unable to connect to database:', error);
    process.exit(1);
  }
};

module.exports = { sequelize, connectDB };