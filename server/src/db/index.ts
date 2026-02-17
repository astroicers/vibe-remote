import Database from 'better-sqlite3';
import { existsSync, mkdirSync } from 'fs';
import { dirname } from 'path';
import { config } from '../config.js';
import { SCHEMA, SEED_DATA } from './schema.js';

let db: Database.Database | null = null;

export function getDb(): Database.Database {
  if (!db) {
    throw new Error('Database not initialized. Call initDb() first.');
  }
  return db;
}

export function initDb(): Database.Database {
  if (db) {
    return db;
  }

  // Ensure directory exists
  const dbDir = dirname(config.DATABASE_PATH);
  if (!existsSync(dbDir)) {
    mkdirSync(dbDir, { recursive: true });
  }

  // Open database
  db = new Database(config.DATABASE_PATH);

  // Enable WAL mode for better concurrent read/write
  db.pragma('journal_mode = WAL');

  // Enable foreign keys
  db.pragma('foreign_keys = ON');

  // Run schema
  db.exec(SCHEMA);

  // Run seed data (uses INSERT OR IGNORE)
  db.exec(SEED_DATA);

  console.log('✅ Database initialized:', config.DATABASE_PATH);

  return db;
}

export function closeDb(): void {
  if (db) {
    db.close();
    db = null;
    console.log('📦 Database closed');
  }
}

// Helper to generate IDs
export function generateId(prefix: string): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 8);
  return `${prefix}_${timestamp}${random}`;
}
