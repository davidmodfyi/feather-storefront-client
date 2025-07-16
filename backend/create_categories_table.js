const Database = require('better-sqlite3');
const db = new Database('featherstorefront.db');

console.log('Creating Categories custom table...');

// 1. Create the Categories table
const tableResult = db.prepare(`
  INSERT INTO custom_tables (distributor_id, name, description)
  VALUES (?, ?, ?)
`).run('dist001', 'Categories', 'Product categories for organization');

const tableId = tableResult.lastInsertRowid;
console.log(`Created Categories table with ID: ${tableId}`);

// 2. Create the fields for the Categories table
const insertFieldStmt = db.prepare(`
  INSERT INTO custom_table_fields 
  (table_id, name, label, source_table, source_attribute, data_type, is_key, field_order)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?)
`);

const fields = [
  { name: 'id', label: 'ID', dataType: 'number', isKey: true },
  { name: 'account_id', label: 'Account ID', dataType: 'text', isKey: false },
  { name: 'category_name', label: 'Category Name', dataType: 'text', isKey: false },
  { name: 'description', label: 'Description', dataType: 'text', isKey: false },
  { name: 'priority', label: 'Priority', dataType: 'number', isKey: false }
];

fields.forEach((field, index) => {
  insertFieldStmt.run(
    tableId,
    field.name,
    field.label,
    null, // source_table
    null, // source_attribute
    field.dataType,
    field.isKey ? 1 : 0,
    index
  );
});

console.log(`Created ${fields.length} fields for Categories table`);

// 3. Create the custom_table_data table if it doesn't exist
db.prepare(`
  CREATE TABLE IF NOT EXISTS custom_table_data (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    table_id INTEGER NOT NULL,
    distributor_id TEXT NOT NULL,
    data TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (table_id) REFERENCES custom_tables(id) ON DELETE CASCADE
  )
`).run();

// 4. Add sample data for different accounts
const insertDataStmt = db.prepare(`
  INSERT INTO custom_table_data (table_id, distributor_id, data)
  VALUES (?, ?, ?)
`);

// Sample data for account "ocean001"
const ocean001Categories = [
  { id: 1, account_id: 'ocean001', category_name: 'Electronics', description: 'Electronic devices and gadgets', priority: 1 },
  { id: 2, account_id: 'ocean001', category_name: 'Clothing', description: 'Apparel and fashion items', priority: 2 },
  { id: 3, account_id: 'ocean001', category_name: 'Books', description: 'Literature and educational materials', priority: 3 }
];

// Sample data for account "ocean002"
const ocean002Categories = [
  { id: 4, account_id: 'ocean002', category_name: 'Food', description: 'Fresh and packaged food items', priority: 1 },
  { id: 5, account_id: 'ocean002', category_name: 'Beverages', description: 'Drinks and refreshments', priority: 2 },
  { id: 6, account_id: 'ocean002', category_name: 'Snacks', description: 'Quick snacks and treats', priority: 3 }
];

// Insert all sample data
[...ocean001Categories, ...ocean002Categories].forEach(category => {
  insertDataStmt.run(tableId, 'dist001', JSON.stringify(category));
});

console.log('Added sample data for ocean001 and ocean002 accounts');

// 5. Verify the data was inserted correctly
const verifyData = db.prepare(`
  SELECT * FROM custom_table_data 
  WHERE table_id = ? AND distributor_id = ?
`).all(tableId, 'dist001');

console.log('\nVerification - Inserted data:');
verifyData.forEach((row, index) => {
  const data = JSON.parse(row.data);
  console.log(`${index + 1}. Account: ${data.account_id}, Category: ${data.category_name}, Priority: ${data.priority}`);
});

console.log('\nCategories table creation completed successfully!');
db.close();