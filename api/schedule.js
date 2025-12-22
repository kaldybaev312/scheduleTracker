import dbConnect from '../lib/mongodb.js';
import mongoose from 'mongoose';

const RecordSchema = new mongoose.Schema({
  subject: String,
  group: String,
  date: String,
  lessonNumber: Number,
}, { timestamps: true });

const Record = mongoose.models.Record || mongoose.model('Record', RecordSchema);

export default async function handler(req, res) {
  try {
    await dbConnect();

    if (req.method === 'GET') {
      const records = await Record.find({}).sort({ date: 1, lessonNumber: 1 });
      return res.status(200).json(records);
    } 
    
    if (req.method === 'POST') {
      const record = await Record.create(req.body);
      return res.status(201).json(record);
    }

    if (req.method === 'DELETE') {
      const { id } = req.query;
      await Record.findByIdAndDelete(id);
      return res.status(200).json({ success: true });
    }
  } catch (error) {
    console.error("БЭКЕНД ОШИБКА:", error);
    // Отправляем текст ошибки как JSON, чтобы App.jsx не ломался на SyntaxError
    return res.status(500).json({ error: error.message, stack: error.stack });
  }
}