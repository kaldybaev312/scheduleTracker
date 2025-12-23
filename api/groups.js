import clientPromise from '../lib/mongodb.js';
export default async function handler(req, res) {
  const client = await clientPromise;
  const db = client.db("edulog");
  if (req.method === 'GET') {
    const data = await db.collection("groups").find({}).toArray();
    res.json(data);
  } else if (req.method === 'POST') {
    await db.collection("groups").insertOne(req.body);
    res.json({status:'ok'});
  } else if (req.method === 'DELETE') {
    await db.collection("groups").deleteOne({name: req.query.name});
    res.json({status:'deleted'});
  }
}