const Kol = require('./Kol');
const Platform = require('./Platform');
const Metric = require('./Metric');
const ScrapeLog = require('./ScrapeLog');

// Define associations
Kol.hasMany(Platform, { foreignKey: 'kolId', as: 'platforms' });
Platform.belongsTo(Kol, { foreignKey: 'kolId', as: 'kol' });

Platform.hasMany(Metric, { foreignKey: 'platformId', as: 'metrics' });
Metric.belongsTo(Platform, { foreignKey: 'platformId', as: 'platform' });

Platform.hasMany(ScrapeLog, { foreignKey: 'platformId', as: 'scrapeLogs' });
ScrapeLog.belongsTo(Platform, { foreignKey: 'platformId', as: 'platform' });

module.exports = {
  Kol,
  Platform,
  Metric,
  ScrapeLog,
};