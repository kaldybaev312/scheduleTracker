import dbConnect from '../lib/mongodb.js';
import mongoose from 'mongoose';

const TemplateSchema = new mongoose.Schema({
  group: String,
  dayOfWeek: Number, // 1 - Пн, 2 - Вт...
  subject: String,
  lessonNumber: Number,
});

const Template = mongoose.models.Template || mongoose.model('Template', TemplateSchema);

export default async function handler(req, res) {
  await dbConnect();

  try {
    if (req.method === 'GET') {
      const { group } = req.query;
      const templates = await Template.find({ group });
      return res.status(200).json(templates);
    }

    if (req.method === 'POST') {
      // Сохраняем или обновляем шаблон для конкретного дня и пары
      const { group, dayOfWeek, subject, lessonNumber } = req.body;
      const updated = await Template.findOneAndUpdate(
        { group, dayOfWeek, lessonNumber },
        { subject },
        { upsert: true, new: true }
      );
      return res.status(200).json(updated);
    }
    
    if (req.method === 'DELETE') {
        const { id } = req.query;
        await Template.findByIdAndDelete(id);
        return res.status(200).json({ success: true });
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}