const { DataTypes } = require('sequelize');
const { sequelize } = require('../database/connection');

const Metric = sequelize.define('Metric', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  platformId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'platforms',
      key: 'id',
    },
  },
  followers: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
  },
  following: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
  },
  posts: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
  },
  likes: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
  },
  engagementRate: {
    type: DataTypes.FLOAT,
    defaultValue: 0,
  },
  avgViews: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
  },
  avgLikes: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
  },
  avgComments: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
  },
  avgShares: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
  },
  growthRate: {
    type: DataTypes.FLOAT,
    defaultValue: 0,
  },
  additionalMetrics: {
    type: DataTypes.JSON,
    defaultValue: {},
  },
  capturedAt: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW,
  },
}, {
  timestamps: true,
  tableName: 'metrics',
  indexes: [
    {
      fields: ['platformId', 'capturedAt'],
    },
  ],
});

module.exports = Metric;