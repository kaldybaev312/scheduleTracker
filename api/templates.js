import clientPromise from '../lib/mongodb.js';
export default async function handler(req, res) {
  const client = await clientPromise;
  const db = client.db("edulog");
  
  if (req.method === 'GET') {
    // Получить шаблоны для группы
    const { group } = req.query;
    const data = await db.collection("templates").find({ group }).toArray();
    res.json(data);
  } 
  else if (req.method === 'POST') {
    // Сохранить/Обновить шаблон
    const { group, dayOfWeek, lessonNumber, subject } = req.body;
    await db.collection("templates").updateOne(
      { group, dayOfWeek, lessonNumber },
      { $set: { subject } },
      { upsert: true }
    );
    res.json({status:'ok'});
  }
}