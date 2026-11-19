import mongoose from 'mongoose';
import { env } from './env.js';

export async function connectDB() {
  const conn = await mongoose.connect(env.mongoUri, {
    serverSelectionTimeoutMS: 5000, // fail fast if MongoDB is unreachable
  });
  console.log(`MongoDB connected: ${conn.connection.host}/${conn.connection.name}`);
}

export async function disconnectDB() {
  await mongoose.connection.close();
}
