const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

// Print current working directory for debugging
console.log('Current working directory:', process.cwd());

// Use a path that will work on both local and Render environments
const dbPath = path.resolve(process.cwd(), 'featherstorefront.db');
console.log('Database path:', dbPath);
console.log('Database file exists:', fs.existsSync(dbPath));

// Initialize database connection
let db;
try {
  db = new Database(dbPath);
  console.log('Database connection established successfully');
} catch (err) {
  console.error('Failed to connect to database:', err.message);
  throw new Error('Could not connect to database: ' + err.message);
}

// User functions
function getUserByUsername(username) {
  try {
    console.log(`Looking up user: ${username}`);
    const stmt = db.prepare('SELECT * FROM users WHERE username = ?');
    const user = stmt.get(username);
    console.log('User lookup result:', user ? 'Found' : 'Not found');
    return user;
  } catch (error) {
    console.error('Error in getUserByUsername:', error);
    return null;
  }
}

// Products
function getProductsByDistributor(distributorId) {
  try {
    const stmt = db.prepare('SELECT * FROM products WHERE distributor_id = ?');
    return stmt.all(distributorId);
  } catch (error) {
    console.error('Error in getProductsByDistributor:', error);
    return [];
  }
}

// Accounts
function getAccountsByDistributor(distributorId) {
  try {
    const stmt = db.prepare('SELECT * FROM accounts WHERE distributor_id = ?');
    return stmt.all(distributorId);
  } catch (error) {
    console.error('Error in getAccountsByDistributor:', error);
    return [];
  }
}

// Export both the database object and the query functions
module.exports = {
  db, // Export the database connection directly
  getProductsByDistributor,
  getAccountsByDistributor,
  getUserByUsername
};