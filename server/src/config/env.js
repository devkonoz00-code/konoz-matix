const path = require('path');
const dotenv = require('dotenv');

// Load .env from both project root and cwd
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });
dotenv.config();

const env = {
  PORT: process.env.PORT || 5000,
  NODE_ENV: process.env.NODE_ENV || 'development',
  MONGODB_URI: process.env.MONGODB_URI,
  FRONTEND_ORIGIN: process.env.FRONTEND_ORIGIN || 'http://localhost:5000',
  INITIAL_ADMIN_EMAIL: process.env.INITIAL_ADMIN_EMAIL,
  INITIAL_ADMIN_PASSWORD: process.env.INITIAL_ADMIN_PASSWORD,
  JWT_SECRET: process.env.JWT_SECRET,
  JWT_REFRESH_SECRET: process.env.JWT_REFRESH_SECRET,
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || '1h',
  JWT_REFRESH_EXPIRES_IN: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
  CLOUDINARY_CLOUD_NAME: process.env.CLOUDINARY_CLOUD_NAME,
  CLOUDINARY_API_KEY: process.env.CLOUDINARY_API_KEY,
  CLOUDINARY_API_SECRET: process.env.CLOUDINARY_API_SECRET,
  CLOUDINARY_URL: process.env.CLOUDINARY_URL,
};

// Validate required env vars
const required = ['MONGODB_URI', 'JWT_SECRET', 'JWT_REFRESH_SECRET'];
for (const key of required) {
  if (!env[key]) {
    console.error(`FATAL: Missing required environment variable: ${key}`);
    process.exit(1);
  }
}

// In production, enforce strong cryptographic entropy for JWT secrets
if (env.NODE_ENV === 'production') {
  if (env.JWT_SECRET.length < 32 || env.JWT_REFRESH_SECRET.length < 32) {
    console.error('FATAL: JWT_SECRET and JWT_REFRESH_SECRET must be at least 32 characters long in production.');
    process.exit(1);
  }
}

module.exports = env;
