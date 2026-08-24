const connectDB = require('./src/config/db');
const env = require('./src/config/env');
const app = require('./src/app');
const cloudinaryService = require('./src/services/cloudinaryService');
const logger = require('./src/utils/logger');

const startServer = async () => {
  await connectDB();

  const storageStatus = cloudinaryService.getConfigurationStatus();
  logger.info('Product image storage configuration loaded', {
    configured: storageStatus.configured,
    source: storageStatus.source,
    cloudName: storageStatus.cloudName,
    code: storageStatus.code,
  });

  app.listen(env.PORT, '0.0.0.0', () => {
    console.log(`MATIX server running on port ${env.PORT} [${env.NODE_ENV}]`);
  });
};

startServer().catch((err) => {
  console.error('Failed to start server:', err.message);
  process.exit(1);
});
