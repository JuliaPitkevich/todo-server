const { MongoClient } = require('mongodb');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017';
const DB_NAME = process.env.MONGODB_DB_NAME || 'lection_db';

const client = new MongoClient(MONGODB_URI);


let dbConnection = null;


async function connectToDatabase() {
    if (dbConnection) {
        return dbConnection;
    }

    try {
        await client.connect();
        console.log('Connected to MongoDB successfully!');
        dbConnection = client.db(DB_NAME);
        return dbConnection;
    } catch (error) {
        console.error('MongoDB connection error:', error);
        throw error;
    }
}


async function getUsersCollection() {
    const db = await connectToDatabase();
    return db.collection('users');
}


async function getTasksCollection() {
    const db = await connectToDatabase();
    return db.collection('tasks');
}

async function closeConnection() {
    if (client) {
        await client.close();
        dbConnection = null;
        console.log('MongoDB connection closed');
    }
}

module.exports = {
    connectToDatabase,
    getUsersCollection,
    getTasksCollection,
    closeConnection,
    client,
    DB_NAME
};