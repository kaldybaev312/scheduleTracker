import mongoose from 'mongoose';

const MONGODB_URI = process.env.MONGODB_URI;

if (!MONGODB_URI) {
  throw new Error('Переменная MONGODB_URI не найдена в .env или настройках Vercel');
}

async function dbConnect() {
  if (mongoose.connection.readyState >= 1) return;
  
  return mongoose.connect(MONGODB_URI, {
    bufferCommands: false,
  });
}

export default dbConnect;