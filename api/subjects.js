import clientPromise from '../lib/mongodb';

export default async function handler(req, res) {
  const client = await clientPromise;
  const db = client.db("edulog");
  const collection = db.collection("subjects");

  if (req.method === 'GET') {
    const subjects = await collection.find({}).toArray();
    res.status(200).json(subjects);
  } else if (req.method === 'POST') {
    const subject = req.body;
    await collection.insertOne(subject);
    res.status(201).json({ message: 'Saved' });
  } else if (req.method === 'DELETE') {
    const { name } = req.query;
    await collection.deleteOne({ name });
    res.status(200).json({ message: 'Deleted' });
  }
}