import clientPromise from '../lib/mongodb'; // Твой файл подключения к Mongo

export default async function handler(req, res) {
  const client = await clientPromise;
  const db = client.db("edulog"); // Имя твоей базы
  const collection = db.collection("groups");

  if (req.method === 'GET') {
    const groups = await collection.find({}).toArray();
    res.status(200).json(groups);
  } else if (req.method === 'POST') {
    const group = req.body;
    await collection.insertOne(group);
    res.status(201).json({ message: 'Saved' });
  } else if (req.method === 'DELETE') {
    const { name } = req.query;
    await collection.deleteOne({ name });
    res.status(200).json({ message: 'Deleted' });
  }
}