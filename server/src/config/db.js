const mongoose = require('mongoose');
const env = require('./env');

const connectDB = async () => {
  try {
    const conn = await mongoose.connect(env.MONGODB_URI, {
      serverSelectionTimeoutMS: 15000,
    });
    console.log(`✅ MongoDB connected successfully: ${conn.connection.host}`);
  } catch (error) {
    console.error(`\n❌ MongoDB connection error: ${error.message}`);
    console.error('\n⚠️  Please check your MONGODB_URI in .env and MongoDB Atlas Network Access settings.\n');
    process.exit(1);
  }
};

module.exports = connectDB;
