const { DataTypes } = require('sequelize');
const { sequelize } = require('../database/connection');

const Platform = sequelize.define('Platform', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  kolId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'kols',
      key: 'id',
    },
  },
  platformType: {
    type: DataTypes.ENUM('facebook', 'instagram', 'tiktok', 'youtube'),
    allowNull: false,
  },
  username: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  profileUrl: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  isVerified: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
  },
  lastScrapedAt: {
    type: DataTypes.DATE,
    allowNull: true,
  },
  scrapeStatus: {
    type: DataTypes.ENUM('pending', 'success', 'failed'),
    defaultValue: 'pending',
  },
}, {
  timestamps: true,
  tableName: 'platforms',
  indexes: [
    {
      unique: true,
      fields: ['kolId', 'platformType'],
    },
  ],
});

module.exports = Platform;