const { DataTypes } = require('sequelize');
const { sequelize } = require('../database/connection');

const ScrapeLog = sequelize.define('ScrapeLog', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  platformId: {
    type: DataTypes.INTEGER,
    allowNull: true,
    references: {
      model: 'platforms',
      key: 'id',
    },
  },
  platform: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  status: {
    type: DataTypes.ENUM('started', 'success', 'failed', 'timeout'),
    allowNull: false,
  },
  errorMessage: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  duration: {
    type: DataTypes.INTEGER,
    allowNull: true,
  },
  metadata: {
    type: DataTypes.JSON,
    defaultValue: {},
  },
}, {
  timestamps: true,
  tableName: 'scrape_logs',
});

module.exports = ScrapeLog;