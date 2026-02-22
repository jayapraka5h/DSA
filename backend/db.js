const sqlite3 = require('sqlite3').verbose();
const { open } = require('sqlite');
const path = require('path');

let db;

async function initDb() {
    db = await open({
        filename: path.join(__dirname, 'database.sqlite'),
        driver: sqlite3.Database
    });

    console.log('Connected to SQLite database.');

    // Create Tables if they don't exist
    await db.exec(`
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE NOT NULL,
            email TEXT UNIQUE NOT NULL,
            password TEXT NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS questions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            title TEXT NOT NULL,
            description TEXT NOT NULL,
            difficulty TEXT DEFAULT 'Medium',
            author_id INTEGER,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (author_id) REFERENCES users (id)
        );
        
        -- Simple table to store comma separated tags instead of a complex join table for now
        CREATE TABLE IF NOT EXISTS question_tags (
            question_id INTEGER,
            tag TEXT,
            FOREIGN KEY (question_id) REFERENCES questions (id)
        );

        CREATE TABLE IF NOT EXISTS solutions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            code TEXT NOT NULL,
            language TEXT NOT NULL,
            question_id INTEGER NOT NULL,
            author_id INTEGER NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (question_id) REFERENCES questions (id),
            FOREIGN KEY (author_id) REFERENCES users (id)
        );

        CREATE TABLE IF NOT EXISTS rooms (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            roomId TEXT UNIQUE NOT NULL,
            pin TEXT NOT NULL,
            owner_id INTEGER NOT NULL,
            question_id INTEGER,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (owner_id) REFERENCES users (id),
            FOREIGN KEY (question_id) REFERENCES questions (id)
        );

        -- Participants will be stored in memory via WebSockets like we discussed, 
        -- but if you want to store room history you could add a participants table here.
    `);

    console.log('Database tables initialized.');
    return db;
}

function getDb() {
    if (!db) {
        throw new Error('Database not initialized! Call initDb first.');
    }
    return db;
}

module.exports = { initDb, getDb };
