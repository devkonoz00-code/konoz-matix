const dns = require('dns');
try {
  dns.setServers(['8.8.8.8', '1.1.1.1', '8.8.4.4']);
} catch {}

const connectDB = require('./src/config/db');
const env = require('./src/config/env');
const app = require('./src/app');

const startServer = async () => {
  await connectDB();

  app.listen(env.PORT, () => {
    console.log(`MATIX server running on port ${env.PORT} [${env.NODE_ENV}]`);
  });
};

startServer().catch((err) => {
  console.error('Failed to start server:', err.message);
  process.exit(1);
});
