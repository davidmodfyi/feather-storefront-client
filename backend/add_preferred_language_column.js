const Database = require('better-sqlite3');
const path = require('path');

// Database path
const dbPath = path.resolve(process.cwd(), 'featherstorefront.db');

console.log('🔄 Adding preferred_language column to users table...');
console.log('Database path:', dbPath);

try {
  const db = new Database(dbPath);
  
  // Check if the column already exists
  const tableInfo = db.prepare("PRAGMA table_info(users)").all();
  const hasLanguageColumn = tableInfo.some(row => row.name === 'preferred_language');
  
  if (hasLanguageColumn) {
    console.log('✅ preferred_language column already exists');
    db.close();
    process.exit(0);
  }
  
  // Add the preferred_language column
  const stmt = db.prepare(`ALTER TABLE users ADD COLUMN preferred_language TEXT DEFAULT 'en'`);
  stmt.run();
  
  console.log('✅ Successfully added preferred_language column to users table');
  
  db.close();
} catch (err) {
  console.error('❌ Error:', err.message);
  process.exit(1);
}