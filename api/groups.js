import clientPromise from '../lib/mongodb.js';

export default async function handler(req, res) {
    const client = await clientPromise;
    const db = client.db("edulog"); // Имя базы

    if (req.method === 'GET') {
        // Скачать все группы
        const groups = await db.collection("groups").find({}).toArray();
        res.json(groups);
    } 
    else if (req.method === 'POST') {
        // Добавить группу
        const { name, totalStudents, poHours } = req.body;
        await db.collection("groups").insertOne({ name, totalStudents, poHours });
        res.json({ status: 'ok' });
    }
    else if (req.method === 'DELETE') {
        // Удалить группу
        const { name } = req.query;
        await db.collection("groups").deleteOne({ name });
        res.json({ status: 'deleted' });
    }
}