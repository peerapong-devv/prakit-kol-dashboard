const { DataTypes } = require('sequelize');
const { sequelize } = require('../database/connection');

const Kol = sequelize.define('Kol', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  name: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  category: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  bio: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  avatarUrl: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  isActive: {
    type: DataTypes.BOOLEAN,
    defaultValue: true,
  },
  tags: {
    type: DataTypes.JSON,
    defaultValue: [],
  },
  metadata: {
    type: DataTypes.JSON,
    defaultValue: {},
  },
}, {
  timestamps: true,
  tableName: 'kols',
});

module.exports = Kol;