import clientPromise from '../lib/mongodb.js';
import { ObjectId } from 'mongodb';
export default async function handler(req, res) {
  const client = await clientPromise;
  const db = client.db("edulog");
  if (req.method === 'GET') {
    const data = await db.collection("schedule").find({}).toArray();
    res.json(data);
  } else if (req.method === 'POST') {
    const { _id, ...body } = req.body;
    await db.collection("schedule").insertOne(body);
    res.json({status:'ok'});
  } else if (req.method === 'DELETE') {
    await db.collection("schedule").deleteOne({_id: new ObjectId(req.query.id)});
    res.json({status:'deleted'});
  }
}