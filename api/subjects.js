import clientPromise from '../lib/mongodb.js';

export default async function handler(req, res) {
    const client = await clientPromise;
    const db = client.db("edulog");

    if (req.method === 'GET') {
        const subjects = await db.collection("subjects").find({}).toArray();
        res.json(subjects);
    } 
    else if (req.method === 'POST') {
        await db.collection("subjects").insertOne(req.body);
        res.json({ status: 'ok' });
    }
    else if (req.method === 'DELETE') {
        const { name } = req.query;
        await db.collection("subjects").deleteOne({ name });
        res.json({ status: 'deleted' });
    }
}