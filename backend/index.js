const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const database = require('./database');
const session = require('express-session');
const MemoryStore = require('memorystore')(session);
const multer = require('multer');
const Anthropic = require('@anthropic-ai/sdk');
const { PricingEngine } = require('./pricing-engine');
const ftp = require('basic-ftp');
const SftpClient = require('ssh2-sftp-client');
const { Client: SSH2Client } = require('ssh2');
const net = require('net');

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY
});

require('dotenv').config();

const DISTRIBUTOR_MAPPING = {
  'dist001': 'oceanwave',    // Ocean Wave Foods (string key)
  'dist002': 'palma',        // Palma Cigars (string key)
  1: 'oceanwave',            // Backup for numeric IDs
  2: 'palma',                // Backup for numeric IDs
  // Add more as needed
};
function getDistributorSlug(distributorId) {
  return DISTRIBUTOR_MAPPING[distributorId] || 'default';
}

// Get the db object from the database module
const db = database.db;
const pricingEngine = new PricingEngine(db);
const isProduction = process.env.NODE_ENV === 'production';


const app = express();
app.use(express.json());
const PORT = process.env.PORT || 4000;
app.use(express.static('public'));
// Log the application startup for debugging
console.log('Starting Feather API server...');
console.log('Environment:', process.env.NODE_ENV || 'development');

const corsOptions = {
  origin: ['https://www.featherstorefront.com', 'https://featherstorefront.com'],
  credentials: true,
  methods: ['GET', 'POST', 'OPTIONS', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type']
}; 


const uploadsDir = path.join(__dirname, 'public', 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}
console.log('Using uploads directory:', uploadsDir);


const publicDir = isProduction
  ? '/opt/render/project/src/public'
  : path.join(__dirname, 'public');

if (!fs.existsSync(publicDir)) {
  fs.mkdirSync(publicDir, { recursive: true });
}

console.log('Using public directory:', publicDir);
console.log('Using uploads directory:', uploadsDir);

if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
  console.log('Created uploads directory');
}

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    // Use the configured uploads directory
    cb(null, uploadsDir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    
    // Use different prefixes based on the endpoint
    let prefix = 'logo-';
    
    // Check if this is a header logo upload
    if (req.originalUrl.includes('header-logo')) {
      prefix = 'headerlogo-'; // Change from 'header-logo-' to 'headerlogo-'
    }
    
    cb(null, prefix + req.session.distributor_id + '-' + uniqueSuffix + ext);
  }
});

const upload = multer({ 
  storage: storage,
  limits: {
    fileSize: 1024 * 1024 // 1MB
  },
  fileFilter: function(req, file, cb) {
    // Accept images only
    if (!file.originalname.match(/\.(jpg|jpeg|png|gif|svg)$/)) {
      return cb(new Error('Only image files are allowed!'), false);
    }
    cb(null, true);
  }
});


app.use(cors(corsOptions));
app.options('*', cors(corsOptions)); // <-- handle preflight

app.use(express.json());

app.set('trust proxy', 1); 
app.use(express.static(path.join(__dirname, 'public')));
// Session configuration with detailed logging
console.log('Configuring session middleware...');
const sessionConfig = {
  store: new MemoryStore({ checkPeriod: 86400000 }), // clean-up every 24h
  name: 'feather.sid',
  secret: process.env.SESSION_SECRET || 'feathersecret',
  resave: false,
  saveUninitialized: false,
cookie: {
  secure: true,
  httpOnly: true,
  sameSite: 'none',
  domain: process.env.NODE_ENV === 'production' ? '.featherstorefront.com' : undefined
   }
};
console.log('Session configuration:', {
  secret: sessionConfig.secret ? '[present]' : '[missing]',
  cookieSecure: sessionConfig.cookie.secure,
  cookieSameSite: sessionConfig.cookie.sameSite
});

app.use(session(sessionConfig));

// Diagnostic endpoint to check database status
app.get('/api/diagnostic', (req, res) => {
  try {
    console.log('Running diagnostic...');
    
    // Check connection and tables
    const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all();
    console.log('Tables in database:', tables.map(t => t.name).join(', '));
    
    // Get users count
    const usersCount = db.prepare("SELECT COUNT(*) as count FROM users").get();
    console.log('Users count:', usersCount.count);
    
    // Get sample user (without password)
    const sampleUser = db.prepare("SELECT id, username, distributor_id, distributor_name, type, account_id FROM users LIMIT 1").get();
    console.log('Sample user:', sampleUser || 'None found');
    
    // Get all users for debugging (without passwords)
    const allUsers = db.prepare("SELECT id, username, distributor_id, distributor_name, type, account_id FROM users").all();
    console.log('All users:', JSON.stringify(allUsers));
    
    // Get direct password for specific test accounts for debugging
    const oceanwavePassword = db.prepare("SELECT password FROM users WHERE username = 'OceanWaveAdmin'").get();
    const palmaPassword = db.prepare("SELECT password FROM users WHERE username = 'PalmaCigarsAdmin'").get();
    
    console.log('Test account passwords:', {
      OceanWaveAdmin: oceanwavePassword ? oceanwavePassword.password : 'not found',
      PalmaCigarsAdmin: palmaPassword ? palmaPassword.password : 'not found'
    });
    
    res.json({
      status: 'ok',
      databaseConnected: true,
      tables: tables.map(t => t.name),
      usersCount: usersCount.count,
      sampleUser: sampleUser || null,
      allUsers: allUsers,
      testPasswords: {
        OceanWaveAdmin: oceanwavePassword ? oceanwavePassword.password : 'not found',
        PalmaCigarsAdmin: palmaPassword ? palmaPassword.password : 'not found'
      }
    });
  } catch (error) {
    console.error('Diagnostic error:', error);
    res.status(500).json({
      status: 'error',
      message: error.message,
      stack: error.stack
    });
  }
});


// Table Builder API - Get accounts with custom attributes
app.get('/api/table-builder/accounts', (req, res) => {
  console.log('Table Builder accounts request');
  
  if (!req.session.distributor_id) {
    return res.status(401).json({ error: 'Not authenticated' });
  }
  
  try {
    const distributorId = req.session.distributor_id;
    
    // Get basic accounts data (limit to first 10)
    const accounts = db.prepare(`
      SELECT * FROM accounts 
      WHERE distributor_id = ? 
      ORDER BY id 
      LIMIT 10
    `).all(distributorId);
    
    // Get all custom attribute definitions for accounts
    const attributeDefinitions = db.prepare(`
      SELECT * FROM custom_attributes_definitions 
      WHERE distributor_id = ? AND entity_type = 'accounts'
      ORDER BY display_order
    `).all(distributorId);
    
    // Get all custom attribute values for these accounts
    const accountIds = accounts.map(account => account.id);
    
    let customAttributes = [];
    if (accountIds.length > 0) {
      const placeholders = accountIds.map(() => '?').join(',');
      customAttributes = db.prepare(`
        SELECT * FROM custom_attributes_values 
        WHERE distributor_id = ? 
        AND entity_type = 'accounts' 
        AND entity_id IN (${placeholders})
      `).all(distributorId, ...accountIds);
    }
    
    console.log(`Found ${accounts.length} accounts, ${customAttributes.length} custom attributes`);
    
    res.json({
      accounts: accounts,
      customAttributes: customAttributes,
      attributeDefinitions: attributeDefinitions
    });
    
  } catch (error) {
    console.error('Error fetching table builder accounts data:', error);
    res.status(500).json({ error: 'Failed to fetch accounts data' });
  }
});

// Table Builder API - Get products with custom attributes
app.get('/api/table-builder/products', (req, res) => {
  console.log('Table Builder products request');
  
  if (!req.session.distributor_id) {
    return res.status(401).json({ error: 'Not authenticated' });
  }
  
  try {
    const distributorId = req.session.distributor_id;
    
    // Get basic products data (limit to first 10)
    const products = db.prepare(`
      SELECT * FROM products 
      WHERE distributor_id = ? 
      ORDER BY id 
      LIMIT 10
    `).all(distributorId);
    
    // Get all custom attribute definitions for products
    const attributeDefinitions = db.prepare(`
      SELECT * FROM custom_attributes_definitions 
      WHERE distributor_id = ? AND entity_type = 'products'
      ORDER BY display_order
    `).all(distributorId);
    
    // Get all custom attribute values for these products
    const productIds = products.map(product => product.id);
    
    let customAttributes = [];
    if (productIds.length > 0) {
      const placeholders = productIds.map(() => '?').join(',');
      customAttributes = db.prepare(`
        SELECT * FROM custom_attributes_values 
        WHERE distributor_id = ? 
        AND entity_type = 'products' 
        AND entity_id IN (${placeholders})
      `).all(distributorId, ...productIds);
    }
    
    console.log(`Found ${products.length} products, ${customAttributes.length} custom attributes`);
    
    res.json({
      products: products,
      customAttributes: customAttributes,
      attributeDefinitions: attributeDefinitions
    });
    
  } catch (error) {
    console.error('Error fetching table builder products data:', error);
    res.status(500).json({ error: 'Failed to fetch products data' });
  }
});

// Table Builder API - Add custom field
app.post('/api/table-builder/add-field', (req, res) => {
  console.log('Add custom field request:', req.body);
  
  if (!req.session.distributor_id) {
    return res.status(401).json({ error: 'Not authenticated' });
  }
  
  try {
    const distributorId = req.session.distributor_id;
    const { entity_type, attribute_name, attribute_label, data_type, validation_rules, display_order } = req.body;
    
    // Validate required fields
    if (!entity_type || !attribute_name || !attribute_label || !data_type) {
      return res.status(400).json({ error: 'Missing required fields' });
    }
    
    // Check if attribute already exists
    const existingAttr = db.prepare(`
      SELECT id FROM custom_attributes_definitions 
      WHERE distributor_id = ? AND entity_type = ? AND attribute_name = ?
    `).get(distributorId, entity_type, attribute_name);
    
    if (existingAttr) {
      return res.status(400).json({ error: 'Field with this name already exists' });
    }
    
    // Insert new custom attribute definition
    const insertStmt = db.prepare(`
      INSERT INTO custom_attributes_definitions 
      (distributor_id, entity_type, attribute_name, attribute_label, data_type, validation_rules, display_order, is_active)
      VALUES (?, ?, ?, ?, ?, ?, ?, 1)
    `);
    
    const result = insertStmt.run(
      distributorId, 
      entity_type, 
      attribute_name, 
      attribute_label, 
      data_type, 
      validation_rules || '{}', 
      display_order || 999
    );
    
    console.log(`Added custom field: ${attribute_label} (${attribute_name}) for ${entity_type}`);
    
    res.json({ 
      success: true, 
      id: result.lastInsertRowid,
      message: `Custom field "${attribute_label}" added successfully`
    });
    
  } catch (error) {
    console.error('Error adding custom field:', error);
    res.status(500).json({ error: 'Failed to add custom field' });
  }
});

// Table Builder API - Export full accounts data to CSV
app.get('/api/table-builder/accounts/export', (req, res) => {
  console.log('Export accounts request');
  
  if (!req.session.distributor_id) {
    return res.status(401).json({ error: 'Not authenticated' });
  }
  
  try {
    const distributorId = req.session.distributor_id;
    
    // Get ALL accounts data (no limit)
    const accounts = db.prepare(`
      SELECT * FROM accounts 
      WHERE distributor_id = ? 
      ORDER BY id
    `).all(distributorId);
    
    // Get all custom attribute definitions for accounts
    const attributeDefinitions = db.prepare(`
      SELECT * FROM custom_attributes_definitions 
      WHERE distributor_id = ? AND entity_type = 'accounts'
      ORDER BY display_order
    `).all(distributorId);
    
    // Get all custom attribute values for all accounts
    const accountIds = accounts.map(account => account.id);
    
    let customAttributes = [];
    if (accountIds.length > 0) {
      const placeholders = accountIds.map(() => '?').join(',');
      customAttributes = db.prepare(`
        SELECT * FROM custom_attributes_values 
        WHERE distributor_id = ? 
        AND entity_type = 'accounts' 
        AND entity_id IN (${placeholders})
      `).all(distributorId, ...accountIds);
    }
    
    // Merge data same as preview endpoint
    const mergedData = accounts.map(account => {
      const mergedAccount = { ...account };
      
      // Add all defined custom attributes as empty fields
      attributeDefinitions.forEach(definition => {
        mergedAccount[definition.attribute_name] = '';
      });
      
      // Fill in actual values where they exist
      const accountCustomAttrs = customAttributes.filter(
        attr => attr.entity_id === account.id
      );
      
      accountCustomAttrs.forEach(attr => {
        let value = attr.value_text || attr.value_number || attr.value_boolean;
        if (attr.value_boolean !== null && attr.value_boolean !== undefined) {
          value = attr.value_boolean ? 'Yes' : 'No';
        }
        mergedAccount[attr.attribute_name] = value || '';
      });
      
      return mergedAccount;
    });
    
    console.log(`Exporting ${mergedData.length} accounts`);
    
    res.json({
      data: mergedData,
      exported_at: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('Error exporting accounts data:', error);
    res.status(500).json({ error: 'Failed to export accounts data' });
  }
});

// Table Builder API - Export full products data to CSV
app.get('/api/table-builder/products/export', (req, res) => {
  console.log('Export products request');
  
  if (!req.session.distributor_id) {
    return res.status(401).json({ error: 'Not authenticated' });
  }
  
  try {
    const distributorId = req.session.distributor_id;
    
    // Get ALL products data (no limit)
    const products = db.prepare(`
      SELECT * FROM products 
      WHERE distributor_id = ? 
      ORDER BY id
    `).all(distributorId);
    
    // Get all custom attribute definitions for products
    const attributeDefinitions = db.prepare(`
      SELECT * FROM custom_attributes_definitions 
      WHERE distributor_id = ? AND entity_type = 'products'
      ORDER BY display_order
    `).all(distributorId);
    
    // Get all custom attribute values for all products
    const productIds = products.map(product => product.id);
    
    let customAttributes = [];
    if (productIds.length > 0) {
      const placeholders = productIds.map(() => '?').join(',');
      customAttributes = db.prepare(`
        SELECT * FROM custom_attributes_values 
        WHERE distributor_id = ? 
        AND entity_type = 'products' 
        AND entity_id IN (${placeholders})
      `).all(distributorId, ...productIds);
    }
    
    // Merge data same as preview endpoint
    const mergedData = products.map(product => {
      const mergedProduct = { ...product };
      
      // Add all defined custom attributes as empty fields
      attributeDefinitions.forEach(definition => {
        mergedProduct[definition.attribute_name] = '';
      });
      
      // Fill in actual values where they exist
      const productCustomAttrs = customAttributes.filter(
        attr => attr.entity_id === product.id
      );
      
      productCustomAttrs.forEach(attr => {
        let value = attr.value_text || attr.value_number || attr.value_boolean;
        if (attr.value_boolean !== null && attr.value_boolean !== undefined) {
          value = attr.value_boolean ? 'Yes' : 'No';
        }
        mergedProduct[attr.attribute_name] = value || '';
      });
      
      return mergedProduct;
    });
    
    console.log(`Exporting ${mergedData.length} products`);
    
    res.json({
      data: mergedData,
      exported_at: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('Error exporting products data:', error);
    res.status(500).json({ error: 'Failed to export products data' });
  }
});

// Setup multer for CSV file uploads
const csvUpload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB limit
  },
  fileFilter: function(req, file, cb) {
    if (file.mimetype === 'text/csv' || 
        file.mimetype === 'application/csv' ||
        file.mimetype === 'application/vnd.ms-excel' ||
        file.originalname.toLowerCase().endsWith('.csv')) {
      cb(null, true);
    } else {
      cb(new Error('Only CSV files are allowed'));
    }
  }
});

// Helper function to parse CSV
function parseCSV(csvText) {
  const lines = csvText.split('\n').filter(line => line.trim());
  if (lines.length === 0) return [];
  
  const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''));
  const rows = lines.slice(1).map(line => {
    const values = [];
    let current = '';
    let inQuotes = false;
    
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        values.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    values.push(current.trim());
    
    const row = {};
    headers.forEach((header, index) => {
      row[header] = values[index] || '';
    });
    return row;
  });
  
  return rows;
}

// Table Builder API - Import accounts from CSV
app.post('/api/table-builder/accounts/import', csvUpload.single('csvFile'), (req, res) => {
  console.log('Import accounts request');
  
  if (!req.session.distributor_id) {
    return res.status(401).json({ error: 'Not authenticated' });
  }
  
  if (!req.file) {
    return res.status(400).json({ error: 'No CSV file uploaded' });
  }
  
  try {
    const distributorId = req.session.distributor_id;
    const csvText = req.file.buffer.toString('utf8');
    const importData = parseCSV(csvText);
    
    if (importData.length === 0) {
      return res.status(400).json({ error: 'CSV file is empty or invalid' });
    }
    
    let imported = 0;
    let updated = 0;
    
    const transaction = db.transaction(() => {
      for (const row of importData) {
        // Separate core account fields from custom attributes
        const coreFields = ['id', 'name', 'email', 'phone', 'address', 'city', 'state', 'zip'];
        const coreData = {};
        const customData = {};
        
        for (const [key, value] of Object.entries(row)) {
          if (coreFields.includes(key)) {
            coreData[key] = value;
          } else {
            customData[key] = value;
          }
        }
        
        // Insert/update core account data
        if (coreData.id) {
          // Update existing account
          const existing = db.prepare('SELECT id FROM accounts WHERE id = ? AND distributor_id = ?').get(coreData.id, distributorId);
          if (existing) {
            const updateFields = Object.keys(coreData).filter(k => k !== 'id').map(k => `${k} = ?`).join(', ');
            const updateValues = Object.keys(coreData).filter(k => k !== 'id').map(k => coreData[k]);
            
            if (updateFields) {
              db.prepare(`UPDATE accounts SET ${updateFields} WHERE id = ? AND distributor_id = ?`)
                .run(...updateValues, coreData.id, distributorId);
              updated++;
            }
          }
        } else {
          // Insert new account
          const result = db.prepare(`
            INSERT INTO accounts (distributor_id, name, email, phone, address, city, state, zip)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
          `).run(
            distributorId,
            coreData.name || '',
            coreData.email || '',
            coreData.phone || '',
            coreData.address || '',
            coreData.city || '',
            coreData.state || '',
            coreData.zip || ''
          );
          coreData.id = result.lastInsertRowid;
          imported++;
        }
        
        // Handle custom attributes
        for (const [attrName, attrValue] of Object.entries(customData)) {
          if (attrValue) {
            // Get or create attribute definition
            let attrDef = db.prepare(`
              SELECT id, data_type FROM custom_attributes_definitions 
              WHERE distributor_id = ? AND entity_type = 'accounts' AND attribute_name = ?
            `).get(distributorId, attrName);
            
            if (!attrDef) {
              // Create new attribute definition
              const result = db.prepare(`
                INSERT INTO custom_attributes_definitions 
                (distributor_id, entity_type, attribute_name, attribute_label, data_type, display_order, is_active)
                VALUES (?, 'accounts', ?, ?, 'text', 999, 1)
              `).run(distributorId, attrName, attrName.replace(/_/g, ' '));
              
              attrDef = { id: result.lastInsertRowid, data_type: 'text' };
            }
            
            // Insert/update custom attribute value
            db.prepare(`
              INSERT OR REPLACE INTO custom_attributes_values 
              (distributor_id, entity_type, entity_id, attribute_name, value_text)
              VALUES (?, 'accounts', ?, ?, ?)
            `).run(distributorId, coreData.id, attrName, attrValue);
          }
        }
      }
    });
    
    transaction();
    
    console.log(`Import complete: ${imported} new accounts, ${updated} updated`);
    
    res.json({
      success: true,
      imported,
      updated,
      total: importData.length
    });
    
  } catch (error) {
    console.error('Error importing accounts:', error);
    res.status(500).json({ error: 'Failed to import accounts: ' + error.message });
  }
});

// Table Builder API - Import products from CSV
app.post('/api/table-builder/products/import', csvUpload.single('csvFile'), (req, res) => {
  console.log('Import products request');
  
  if (!req.session.distributor_id) {
    return res.status(401).json({ error: 'Not authenticated' });
  }
  
  if (!req.file) {
    return res.status(400).json({ error: 'No CSV file uploaded' });
  }
  
  try {
    const distributorId = req.session.distributor_id;
    const csvText = req.file.buffer.toString('utf8');
    const importData = parseCSV(csvText);
    
    if (importData.length === 0) {
      return res.status(400).json({ error: 'CSV file is empty or invalid' });
    }
    
    let imported = 0;
    let updated = 0;
    
    const transaction = db.transaction(() => {
      for (const row of importData) {
        // Separate core product fields from custom attributes
        const coreFields = ['id', 'name', 'description', 'sku', 'unit_price', 'category'];
        const coreData = {};
        const customData = {};
        
        for (const [key, value] of Object.entries(row)) {
          if (coreFields.includes(key)) {
            coreData[key] = value;
          } else {
            customData[key] = value;
          }
        }
        
        // Insert/update core product data
        if (coreData.id) {
          // Update existing product
          const existing = db.prepare('SELECT id FROM products WHERE id = ? AND distributor_id = ?').get(coreData.id, distributorId);
          if (existing) {
            const updateFields = Object.keys(coreData).filter(k => k !== 'id').map(k => `${k} = ?`).join(', ');
            const updateValues = Object.keys(coreData).filter(k => k !== 'id').map(k => coreData[k]);
            
            if (updateFields) {
              db.prepare(`UPDATE products SET ${updateFields} WHERE id = ? AND distributor_id = ?`)
                .run(...updateValues, coreData.id, distributorId);
              updated++;
            }
          }
        } else {
          // Insert new product
          const result = db.prepare(`
            INSERT INTO products (distributor_id, name, description, sku, unit_price, category)
            VALUES (?, ?, ?, ?, ?, ?)
          `).run(
            distributorId,
            coreData.name || '',
            coreData.description || '',
            coreData.sku || '',
            parseFloat(coreData.unit_price) || 0,
            coreData.category || ''
          );
          coreData.id = result.lastInsertRowid;
          imported++;
        }
        
        // Handle custom attributes
        for (const [attrName, attrValue] of Object.entries(customData)) {
          if (attrValue) {
            // Get or create attribute definition
            let attrDef = db.prepare(`
              SELECT id, data_type FROM custom_attributes_definitions 
              WHERE distributor_id = ? AND entity_type = 'products' AND attribute_name = ?
            `).get(distributorId, attrName);
            
            if (!attrDef) {
              // Create new attribute definition
              const result = db.prepare(`
                INSERT INTO custom_attributes_definitions 
                (distributor_id, entity_type, attribute_name, attribute_label, data_type, display_order, is_active)
                VALUES (?, 'products', ?, ?, 'text', 999, 1)
              `).run(distributorId, attrName, attrName.replace(/_/g, ' '));
              
              attrDef = { id: result.lastInsertRowid, data_type: 'text' };
            }
            
            // Insert/update custom attribute value
            db.prepare(`
              INSERT OR REPLACE INTO custom_attributes_values 
              (distributor_id, entity_type, entity_id, attribute_name, value_text)
              VALUES (?, 'products', ?, ?, ?)
            `).run(distributorId, coreData.id, attrName, attrValue);
          }
        }
      }
    });
    
    transaction();
    
    console.log(`Import complete: ${imported} new products, ${updated} updated`);
    
    res.json({
      success: true,
      imported,
      updated,
      total: importData.length
    });
    
  } catch (error) {
    console.error('Error importing products:', error);
    res.status(500).json({ error: 'Failed to import products: ' + error.message });
  }
});

// Table Builder API - Get orders with custom attributes
app.get('/api/table-builder/orders', (req, res) => {
  console.log('Table Builder orders request');
  
  if (!req.session.user_id) {
    return res.status(401).json({ error: 'Not authenticated' });
  }
  
  try {
    const distributorId = req.session.distributor_id;
    
    // Get basic orders data (limit to first 10) - use same query as Order History for Admin users
    const orders = db.prepare(`
      SELECT o.*, a.name as customer_name 
      FROM orders o
      LEFT JOIN users u ON o.user_id = u.id
      LEFT JOIN accounts a ON o.account_id = a.id
      WHERE u.distributor_id = ?
      ORDER BY o.order_date DESC
      LIMIT 10
    `).all(distributorId);
    
    // Get all custom attribute definitions for orders
    const attributeDefinitions = db.prepare(`
      SELECT * FROM custom_attributes_definitions 
      WHERE distributor_id = ? AND entity_type = 'orders'
      ORDER BY display_order
    `).all(distributorId);
    
    // Get all custom attribute values for these orders
    const orderIds = orders.map(order => order.id);
    
    let customAttributes = [];
    if (orderIds.length > 0) {
      const placeholders = orderIds.map(() => '?').join(',');
      customAttributes = db.prepare(`
        SELECT * FROM custom_attributes_values 
        WHERE distributor_id = ? 
        AND entity_type = 'orders' 
        AND entity_id IN (${placeholders})
      `).all(distributorId, ...orderIds);
    }
    
    console.log(`Found ${orders.length} orders, ${customAttributes.length} custom attributes`);
    
    res.json({
      orders: orders,
      customAttributes: customAttributes,
      attributeDefinitions: attributeDefinitions
    });
    
  } catch (error) {
    console.error('Error fetching table builder orders data:', error);
    res.status(500).json({ error: 'Failed to fetch orders data' });
  }
});

// Table Builder API - Get order lines with custom attributes
app.get('/api/table-builder/order-items', (req, res) => {
  console.log('Table Builder order items request');
  
  if (!req.session.user_id) {
    return res.status(401).json({ error: 'Not authenticated' });
  }
  
  try {
    const distributorId = req.session.distributor_id;
    
    // Get basic order items data (limit to first 10) - join with orders and products like the working endpoint
    const orderItems = db.prepare(`
      SELECT oi.*, p.name, p.sku, p.image_url, p.description, o.order_date
      FROM order_items oi
      JOIN orders o ON oi.order_id = o.id
      JOIN products p ON oi.product_id = p.id
      JOIN users u ON o.user_id = u.id
      WHERE u.distributor_id = ?
      ORDER BY oi.id DESC
      LIMIT 10
    `).all(distributorId);
    
    // Get all custom attribute definitions for order lines
    const attributeDefinitions = db.prepare(`
      SELECT * FROM custom_attributes_definitions 
      WHERE distributor_id = ? AND entity_type = 'order_items'
      ORDER BY display_order
    `).all(distributorId);
    
    // Get all custom attribute values for these order items
    const orderItemIds = orderItems.map(item => item.id);
    
    let customAttributes = [];
    if (orderItemIds.length > 0) {
      const placeholders = orderItemIds.map(() => '?').join(',');
      customAttributes = db.prepare(`
        SELECT * FROM custom_attributes_values 
        WHERE distributor_id = ? 
        AND entity_type = 'order_items' 
        AND entity_id IN (${placeholders})
      `).all(distributorId, ...orderItemIds);
    }
    
    console.log(`Found ${orderItems.length} order items, ${customAttributes.length} custom attributes`);
    
    res.json({
      orderItems: orderItems,
      customAttributes: customAttributes,
      attributeDefinitions: attributeDefinitions
    });
    
  } catch (error) {
    console.error('Error fetching table builder order lines data:', error);
    res.status(500).json({ error: 'Failed to fetch order lines data' });
  }
});

// Table Builder API - Export full orders data to CSV
app.get('/api/table-builder/orders/export', (req, res) => {
  console.log('Export orders request');
  
  if (!req.session.user_id) {
    return res.status(401).json({ error: 'Not authenticated' });
  }
  
  try {
    const distributorId = req.session.distributor_id;
    
    // Get ALL orders data (no limit) - use same query as Order History for consistency
    const orders = db.prepare(`
      SELECT o.*, a.name as customer_name 
      FROM orders o
      LEFT JOIN users u ON o.user_id = u.id
      LEFT JOIN accounts a ON o.account_id = a.id
      WHERE u.distributor_id = ?
      ORDER BY o.order_date DESC
    `).all(distributorId);
    
    // Get all custom attribute definitions for orders
    const attributeDefinitions = db.prepare(`
      SELECT * FROM custom_attributes_definitions 
      WHERE distributor_id = ? AND entity_type = 'orders'
      ORDER BY display_order
    `).all(distributorId);
    
    // Get all custom attribute values for all orders
    const orderIds = orders.map(order => order.id);
    
    let customAttributes = [];
    if (orderIds.length > 0) {
      const placeholders = orderIds.map(() => '?').join(',');
      customAttributes = db.prepare(`
        SELECT * FROM custom_attributes_values 
        WHERE distributor_id = ? 
        AND entity_type = 'orders' 
        AND entity_id IN (${placeholders})
      `).all(distributorId, ...orderIds);
    }
    
    // Merge data same as preview endpoint
    const mergedData = orders.map(order => {
      const mergedOrder = { ...order };
      
      // Add all defined custom attributes as empty fields
      attributeDefinitions.forEach(definition => {
        mergedOrder[definition.attribute_name] = '';
      });
      
      // Fill in actual values where they exist
      const orderCustomAttrs = customAttributes.filter(
        attr => attr.entity_id === order.id
      );
      
      orderCustomAttrs.forEach(attr => {
        let value = attr.value_text || attr.value_number || attr.value_boolean;
        if (attr.value_boolean !== null && attr.value_boolean !== undefined) {
          value = attr.value_boolean ? 'Yes' : 'No';
        }
        mergedOrder[attr.attribute_name] = value || '';
      });
      
      return mergedOrder;
    });
    
    console.log(`Exporting ${mergedData.length} orders`);
    
    res.json({
      data: mergedData,
      exported_at: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('Error exporting orders data:', error);
    res.status(500).json({ error: 'Failed to export orders data' });
  }
});

// Table Builder API - Export full order lines data to CSV
app.get('/api/table-builder/order-items/export', (req, res) => {
  console.log('Export order items request');
  
  if (!req.session.user_id) {
    return res.status(401).json({ error: 'Not authenticated' });
  }
  
  try {
    const distributorId = req.session.distributor_id;
    
    // Get ALL order items data (no limit)
    const orderItems = db.prepare(`
      SELECT oi.*, p.name, p.sku, p.image_url, p.description, o.order_date
      FROM order_items oi
      JOIN orders o ON oi.order_id = o.id
      JOIN products p ON oi.product_id = p.id
      JOIN users u ON o.user_id = u.id
      WHERE u.distributor_id = ?
      ORDER BY oi.id DESC
    `).all(distributorId);
    
    // Get all custom attribute definitions for order lines
    const attributeDefinitions = db.prepare(`
      SELECT * FROM custom_attributes_definitions 
      WHERE distributor_id = ? AND entity_type = 'order_items'
      ORDER BY display_order
    `).all(distributorId);
    
    // Get all custom attribute values for all order lines
    const orderLineIds = orderLines.map(line => line.id);
    
    let customAttributes = [];
    if (orderLineIds.length > 0) {
      const placeholders = orderLineIds.map(() => '?').join(',');
      customAttributes = db.prepare(`
        SELECT * FROM custom_attributes_values 
        WHERE distributor_id = ? 
        AND entity_type = 'order_items' 
        AND entity_id IN (${placeholders})
      `).all(distributorId, ...orderLineIds);
    }
    
    // Merge data same as preview endpoint
    const mergedData = orderLines.map(line => {
      const mergedLine = { ...line };
      
      // Add all defined custom attributes as empty fields
      attributeDefinitions.forEach(definition => {
        mergedLine[definition.attribute_name] = '';
      });
      
      // Fill in actual values where they exist
      const lineCustomAttrs = customAttributes.filter(
        attr => attr.entity_id === line.id
      );
      
      lineCustomAttrs.forEach(attr => {
        let value = attr.value_text || attr.value_number || attr.value_boolean;
        if (attr.value_boolean !== null && attr.value_boolean !== undefined) {
          value = attr.value_boolean ? 'Yes' : 'No';
        }
        mergedLine[attr.attribute_name] = value || '';
      });
      
      return mergedLine;
    });
    
    console.log(`Exporting ${mergedData.length} order lines`);
    
    res.json({
      data: mergedData,
      exported_at: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('Error exporting order lines data:', error);
    res.status(500).json({ error: 'Failed to export order lines data' });
  }
});

// Table Builder API - Import orders from CSV
app.post('/api/table-builder/orders/import', csvUpload.single('csvFile'), (req, res) => {
  console.log('Import orders request');
  
  if (!req.session.distributor_id) {
    return res.status(401).json({ error: 'Not authenticated' });
  }
  
  if (!req.file) {
    return res.status(400).json({ error: 'No CSV file uploaded' });
  }
  
  try {
    const distributorId = req.session.distributor_id;
    const csvText = req.file.buffer.toString('utf8');
    const importData = parseCSV(csvText);
    
    if (importData.length === 0) {
      return res.status(400).json({ error: 'CSV file is empty or invalid' });
    }
    
    let imported = 0;
    let updated = 0;
    
    const transaction = db.transaction(() => {
      for (const row of importData) {
        // Separate core order fields from custom attributes
        const coreFields = ['id', 'account_id', 'status', 'total_amount', 'order_date'];
        const coreData = {};
        const customData = {};
        
        for (const [key, value] of Object.entries(row)) {
          if (coreFields.includes(key)) {
            coreData[key] = value;
          } else {
            customData[key] = value;
          }
        }
        
        // Insert/update core order data
        if (coreData.id) {
          // Update existing order
          const existing = db.prepare('SELECT id FROM orders WHERE id = ? AND distributor_id = ?').get(coreData.id, distributorId);
          if (existing) {
            const updateFields = Object.keys(coreData).filter(k => k !== 'id').map(k => `${k} = ?`).join(', ');
            const updateValues = Object.keys(coreData).filter(k => k !== 'id').map(k => coreData[k]);
            
            if (updateFields) {
              db.prepare(`UPDATE orders SET ${updateFields} WHERE id = ? AND distributor_id = ?`)
                .run(...updateValues, coreData.id, distributorId);
              updated++;
            }
          }
        } else {
          // Insert new order
          const result = db.prepare(`
            INSERT INTO orders (distributor_id, account_id, status, total_amount, order_date)
            VALUES (?, ?, ?, ?, ?)
          `).run(
            distributorId,
            coreData.account_id || null,
            coreData.status || 'draft',
            parseFloat(coreData.total_amount) || 0,
            coreData.order_date || new Date().toISOString()
          );
          coreData.id = result.lastInsertRowid;
          imported++;
        }
        
        // Handle custom attributes
        for (const [attrName, attrValue] of Object.entries(customData)) {
          if (attrValue) {
            // Get or create attribute definition
            let attrDef = db.prepare(`
              SELECT id, data_type FROM custom_attributes_definitions 
              WHERE distributor_id = ? AND entity_type = 'orders' AND attribute_name = ?
            `).get(distributorId, attrName);
            
            if (!attrDef) {
              // Create new attribute definition
              const result = db.prepare(`
                INSERT INTO custom_attributes_definitions 
                (distributor_id, entity_type, attribute_name, attribute_label, data_type, display_order, is_active)
                VALUES (?, 'orders', ?, ?, 'text', 999, 1)
              `).run(distributorId, attrName, attrName.replace(/_/g, ' '));
              
              attrDef = { id: result.lastInsertRowid, data_type: 'text' };
            }
            
            // Insert/update custom attribute value
            db.prepare(`
              INSERT OR REPLACE INTO custom_attributes_values 
              (distributor_id, entity_type, entity_id, attribute_name, value_text)
              VALUES (?, 'orders', ?, ?, ?)
            `).run(distributorId, coreData.id, attrName, attrValue);
          }
        }
      }
    });
    
    transaction();
    
    console.log(`Import complete: ${imported} new orders, ${updated} updated`);
    
    res.json({
      success: true,
      imported,
      updated,
      total: importData.length
    });
    
  } catch (error) {
    console.error('Error importing orders:', error);
    res.status(500).json({ error: 'Failed to import orders: ' + error.message });
  }
});

// Table Builder API - Import order lines from CSV
app.post('/api/table-builder/order-items/import', csvUpload.single('csvFile'), (req, res) => {
  console.log('Import order lines request');
  
  if (!req.session.distributor_id) {
    return res.status(401).json({ error: 'Not authenticated' });
  }
  
  if (!req.file) {
    return res.status(400).json({ error: 'No CSV file uploaded' });
  }
  
  try {
    const distributorId = req.session.distributor_id;
    const csvText = req.file.buffer.toString('utf8');
    const importData = parseCSV(csvText);
    
    if (importData.length === 0) {
      return res.status(400).json({ error: 'CSV file is empty or invalid' });
    }
    
    let imported = 0;
    let updated = 0;
    
    const transaction = db.transaction(() => {
      for (const row of importData) {
        // Separate core order line fields from custom attributes
        const coreFields = ['id', 'order_id', 'product_id', 'quantity', 'unit_price', 'line_total'];
        const coreData = {};
        const customData = {};
        
        for (const [key, value] of Object.entries(row)) {
          if (coreFields.includes(key)) {
            coreData[key] = value;
          } else {
            customData[key] = value;
          }
        }
        
        // Insert/update core order line data
        if (coreData.id) {
          // Update existing order line
          const existing = db.prepare('SELECT id FROM order_items WHERE id = ? AND distributor_id = ?').get(coreData.id, distributorId);
          if (existing) {
            const updateFields = Object.keys(coreData).filter(k => k !== 'id').map(k => `${k} = ?`).join(', ');
            const updateValues = Object.keys(coreData).filter(k => k !== 'id').map(k => coreData[k]);
            
            if (updateFields) {
              db.prepare(`UPDATE order_items SET ${updateFields} WHERE id = ? AND distributor_id = ?`)
                .run(...updateValues, coreData.id, distributorId);
              updated++;
            }
          }
        } else {
          // Insert new order line
          const result = db.prepare(`
            INSERT INTO order_items (distributor_id, order_id, product_id, quantity, unit_price, line_total)
            VALUES (?, ?, ?, ?, ?, ?)
          `).run(
            distributorId,
            coreData.order_id || null,
            coreData.product_id || null,
            parseInt(coreData.quantity) || 1,
            parseFloat(coreData.unit_price) || 0,
            parseFloat(coreData.line_total) || 0
          );
          coreData.id = result.lastInsertRowid;
          imported++;
        }
        
        // Handle custom attributes
        for (const [attrName, attrValue] of Object.entries(customData)) {
          if (attrValue) {
            // Get or create attribute definition
            let attrDef = db.prepare(`
              SELECT id, data_type FROM custom_attributes_definitions 
              WHERE distributor_id = ? AND entity_type = 'order_items' AND attribute_name = ?
            `).get(distributorId, attrName);
            
            if (!attrDef) {
              // Create new attribute definition
              const result = db.prepare(`
                INSERT INTO custom_attributes_definitions 
                (distributor_id, entity_type, attribute_name, attribute_label, data_type, display_order, is_active)
                VALUES (?, 'order_items', ?, ?, 'text', 999, 1)
              `).run(distributorId, attrName, attrName.replace(/_/g, ' '));
              
              attrDef = { id: result.lastInsertRowid, data_type: 'text' };
            }
            
            // Insert/update custom attribute value
            db.prepare(`
              INSERT OR REPLACE INTO custom_attributes_values 
              (distributor_id, entity_type, entity_id, attribute_name, value_text)
              VALUES (?, 'order_items', ?, ?, ?)
            `).run(distributorId, coreData.id, attrName, attrValue);
          }
        }
      }
    });
    
    transaction();
    
    console.log(`Import complete: ${imported} new order lines, ${updated} updated`);
    
    res.json({
      success: true,
      imported,
      updated,
      total: importData.length
    });
    
  } catch (error) {
    console.error('Error importing order lines:', error);
    res.status(500).json({ error: 'Failed to import order lines: ' + error.message });
  }
});

// Debug endpoint - Add this to your index.js
app.get('/api/debug/custom-attributes', (req, res) => {
  console.log('=== DEBUG: Custom Attributes ===');
  
  if (!req.session.distributor_id) {
    return res.status(401).json({ error: 'Not authenticated' });
  }
  
  try {
    const distributorId = req.session.distributor_id;
    console.log('Checking for distributor:', distributorId);
    
    // Get all custom attribute definitions for this distributor
    const definitions = db.prepare(`
      SELECT * FROM custom_attributes_definitions 
      WHERE distributor_id = ?
      ORDER BY entity_type, display_order
    `).all(distributorId);
    
    console.log('Found', definitions.length, 'custom attribute definitions');
    
    // Get all custom attribute values for this distributor  
    const values = db.prepare(`
      SELECT * FROM custom_attributes_values 
      WHERE distributor_id = ?
      ORDER BY entity_type, entity_id
    `).all(distributorId);
    
    console.log('Found', values.length, 'custom attribute values');
    
    // Get table counts
    const accountsCount = db.prepare(`
      SELECT COUNT(*) as count FROM accounts WHERE distributor_id = ?
    `).get(distributorId);
    
    const productsCount = db.prepare(`
      SELECT COUNT(*) as count FROM products WHERE distributor_id = ?
    `).get(distributorId);
    
    const debugInfo = {
      distributor_id: distributorId,
      tables: {
        accounts_count: accountsCount.count,
        products_count: productsCount.count,
        custom_definitions_count: definitions.length,
        custom_values_count: values.length
      },
      custom_attribute_definitions: definitions,
      custom_attribute_values: values,
      sample_accounts: db.prepare(`
        SELECT * FROM accounts WHERE distributor_id = ? LIMIT 3
      `).all(distributorId),
      sample_products: db.prepare(`
        SELECT * FROM products WHERE distributor_id = ? LIMIT 3
      `).all(distributorId)
    };
    
    console.log('=== DEBUG SUMMARY ===');
    console.log('Distributor:', distributorId);
    console.log('Accounts:', accountsCount.count);
    console.log('Products:', productsCount.count);
    console.log('Custom Definitions:', definitions.length);
    console.log('Custom Values:', values.length);
    console.log('========================');
    
    res.json(debugInfo);
    
  } catch (error) {
    console.error('Debug error:', error);
    res.status(500).json({ error: error.message, stack: error.stack });
  }
});

// Custom Tables API Endpoints
app.get('/api/custom-tables', (req, res) => {
  console.log('Custom tables request');
  
  if (!req.session.distributor_id) {
    return res.status(401).json({ error: 'Not authenticated' });
  }
  
  try {
    const distributorId = req.session.distributor_id;
    
    // Get all custom tables for this distributor
    const customTables = db.prepare(`
      SELECT * FROM custom_tables 
      WHERE distributor_id = ? 
      ORDER BY created_at DESC
    `).all(distributorId);
    
    // Get fields and data for each table
    const tablesWithFields = customTables.map(table => {
      const fields = db.prepare(`
        SELECT * FROM custom_table_fields 
        WHERE table_id = ? 
        ORDER BY field_order
      `).all(table.id);
      
      // Get table data
      let tableData = [];
      try {
        const dataRows = db.prepare(`
          SELECT * FROM custom_table_data 
          WHERE table_id = ? AND distributor_id = ?
          ORDER BY created_at DESC
        `).all(table.id, distributorId);
        
        tableData = dataRows.map(row => {
          try {
            return JSON.parse(row.data);
          } catch (e) {
            console.error('Error parsing table data:', e);
            return {};
          }
        });
      } catch (error) {
        console.log('No data found for table:', table.id);
        tableData = [];
      }
      
      return {
        ...table,
        fields: fields,
        data: tableData
      };
    });
    
    console.log(`Found ${tablesWithFields.length} custom tables`);
    res.json(tablesWithFields);
    
  } catch (error) {
    console.error('Error fetching custom tables:', error);
    res.status(500).json({ error: 'Failed to fetch custom tables' });
  }
});

app.post('/api/custom-tables', (req, res) => {
  console.log('Create custom table request:', req.body);
  
  if (!req.session.distributor_id) {
    return res.status(401).json({ error: 'Not authenticated' });
  }
  
  try {
    const distributorId = req.session.distributor_id;
    const { name, description, fields } = req.body;
    
    // Validate required fields
    if (!name || !fields || fields.length === 0) {
      return res.status(400).json({ error: 'Name and fields are required' });
    }
    
    // Create tables if they don't exist
    db.prepare(`
      CREATE TABLE IF NOT EXISTS custom_tables (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        distributor_id TEXT NOT NULL,
        name TEXT NOT NULL,
        description TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `).run();
    
    db.prepare(`
      CREATE TABLE IF NOT EXISTS custom_table_fields (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        table_id INTEGER NOT NULL,
        name TEXT NOT NULL,
        label TEXT NOT NULL,
        source_table TEXT,
        source_attribute TEXT,
        data_type TEXT NOT NULL,
        is_key BOOLEAN DEFAULT FALSE,
        field_order INTEGER NOT NULL,
        FOREIGN KEY (table_id) REFERENCES custom_tables(id) ON DELETE CASCADE
      )
    `).run();
    
    // Insert custom table
    const tableResult = db.prepare(`
      INSERT INTO custom_tables (distributor_id, name, description)
      VALUES (?, ?, ?)
    `).run(distributorId, name, description);
    
    const tableId = tableResult.lastInsertRowid;
    
    // Insert fields
    const insertFieldStmt = db.prepare(`
      INSERT INTO custom_table_fields 
      (table_id, name, label, source_table, source_attribute, data_type, is_key, field_order)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
    
    fields.forEach((field, index) => {
      insertFieldStmt.run(
        tableId,
        field.name,
        field.label || field.name,
        field.sourceTable || null,
        field.sourceAttribute || null,
        field.dataType,
        field.isKey ? 1 : 0,
        index
      );
    });
    
    // Return the created table with fields
    const createdTable = db.prepare(`
      SELECT * FROM custom_tables WHERE id = ?
    `).get(tableId);
    
    const tableFields = db.prepare(`
      SELECT * FROM custom_table_fields WHERE table_id = ? ORDER BY field_order
    `).all(tableId);
    
    console.log(`Created custom table: ${name} with ${fields.length} fields`);
    
    res.json({
      ...createdTable,
      fields: tableFields
    });
    
  } catch (error) {
    console.error('Error creating custom table:', error);
    res.status(500).json({ error: 'Failed to create custom table' });
  }
});

app.delete('/api/custom-tables/:id', (req, res) => {
  console.log('Delete custom table request:', req.params.id);
  
  if (!req.session.distributor_id) {
    return res.status(401).json({ error: 'Not authenticated' });
  }
  
  try {
    const distributorId = req.session.distributor_id;
    const tableId = req.params.id;
    
    // Verify table belongs to this distributor
    const table = db.prepare(`
      SELECT * FROM custom_tables 
      WHERE id = ? AND distributor_id = ?
    `).get(tableId, distributorId);
    
    if (!table) {
      return res.status(404).json({ error: 'Table not found' });
    }
    
    // Delete table (fields will be deleted via CASCADE)
    db.prepare(`DELETE FROM custom_tables WHERE id = ?`).run(tableId);
    
    console.log(`Deleted custom table: ${table.name}`);
    res.json({ success: true });
    
  } catch (error) {
    console.error('Error deleting custom table:', error);
    res.status(500).json({ error: 'Failed to delete custom table' });
  }
});

app.get('/api/custom-attributes', (req, res) => {
  console.log('Custom attributes request');
  
  if (!req.session.distributor_id) {
    return res.status(401).json({ error: 'Not authenticated' });
  }
  
  try {
    const distributorId = req.session.distributor_id;
    
    // Get all custom attribute definitions for this distributor
    const customAttributes = db.prepare(`
      SELECT * FROM custom_attributes_definitions 
      WHERE distributor_id = ? AND is_active = 1
      ORDER BY entity_type, display_order
    `).all(distributorId);
    
    console.log(`Found ${customAttributes.length} custom attributes`);
    res.json(customAttributes);
    
  } catch (error) {
    console.error('Error fetching custom attributes:', error);
    res.status(500).json({ error: 'Failed to fetch custom attributes' });
  }
});

// Custom table export endpoint
app.get('/api/table-builder/custom-:tableId/export', (req, res) => {
  console.log('Export custom table request:', req.params.tableId);
  
  if (!req.session.distributor_id) {
    return res.status(401).json({ error: 'Not authenticated' });
  }
  
  try {
    const distributorId = req.session.distributor_id;
    const tableId = req.params.tableId;
    
    // Get the custom table
    const customTable = db.prepare(`
      SELECT * FROM custom_tables 
      WHERE id = ? AND distributor_id = ?
    `).get(tableId, distributorId);
    
    if (!customTable) {
      return res.status(404).json({ error: 'Custom table not found' });
    }
    
    // Get table fields
    const fields = db.prepare(`
      SELECT * FROM custom_table_fields 
      WHERE table_id = ? 
      ORDER BY field_order
    `).all(tableId);
    
    // Check if we have any data for this table
    let customTableData = [];
    try {
      // Try to get existing data from custom_table_data table
      const dataStmt = db.prepare(`
        SELECT * FROM custom_table_data 
        WHERE table_id = ? AND distributor_id = ?
      `);
      customTableData = dataStmt.all(tableId, distributorId);
    } catch (error) {
      console.log('No existing data table found, creating empty export');
      customTableData = [];
    }
    
    if (customTableData.length === 0) {
      // Return empty template with headers
      const emptyRow = {};
      fields.forEach(field => {
        emptyRow[field.name] = '';
      });
      
      // Add a few empty rows to make it easier to work with
      const templateData = [emptyRow, {...emptyRow}, {...emptyRow}];
      
      console.log(`Exporting empty template for custom table: ${customTable.name}`);
      return res.json({
        data: templateData,
        exported_at: new Date().toISOString(),
        table_name: customTable.name,
        template: true
      });
    }
    
    // If we have data, convert it to field-based format
    console.log(`Exporting ${customTableData.length} rows from custom table: ${customTable.name}`);
    
    // Convert stored JSON data to field-based rows
    const exportData = customTableData.map(row => {
      try {
        // Parse the JSON data stored in the 'data' column
        const parsedData = JSON.parse(row.data);
        
        // Create a clean row with only the field values
        const cleanRow = {};
        fields.forEach(field => {
          cleanRow[field.name] = parsedData[field.name] || '';
        });
        
        return cleanRow;
      } catch (error) {
        console.error('Error parsing row data:', error);
        // If parsing fails, create empty row with field structure
        const emptyRow = {};
        fields.forEach(field => {
          emptyRow[field.name] = '';
        });
        return emptyRow;
      }
    });
    
    console.log(`Converted data sample:`, exportData[0]);
    
    res.json({
      data: exportData,
      exported_at: new Date().toISOString(),
      table_name: customTable.name,
      template: false
    });
    
  } catch (error) {
    console.error('Error exporting custom table:', error);
    res.status(500).json({ error: 'Failed to export custom table' });
  }
});

// Custom table import endpoint
app.post('/api/table-builder/custom-:tableId/import', csvUpload.single('csvFile'), (req, res) => {
  console.log('Import custom table request:', req.params.tableId);
  
  if (!req.session.distributor_id) {
    return res.status(401).json({ error: 'Not authenticated' });
  }
  
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded' });
  }
  
  try {
    const distributorId = req.session.distributor_id;
    const tableId = req.params.tableId;
    
    // Get the custom table
    const customTable = db.prepare(`
      SELECT * FROM custom_tables 
      WHERE id = ? AND distributor_id = ?
    `).get(tableId, distributorId);
    
    if (!customTable) {
      return res.status(404).json({ error: 'Custom table not found' });
    }
    
    // Get table fields
    const fields = db.prepare(`
      SELECT * FROM custom_table_fields 
      WHERE table_id = ? 
      ORDER BY field_order
    `).all(tableId);
    
    // Parse the CSV
    const csvText = req.file.buffer.toString('utf8');
    console.log('CSV text:', csvText.substring(0, 200) + '...');
    const parsedData = parseCSV(csvText);
    
    console.log('Parsed data:', JSON.stringify(parsedData, null, 2));
    
    if (parsedData.length === 0) {
      return res.status(400).json({ error: 'No data found in CSV file' });
    }
    
    // Create custom table data table if it doesn't exist
    db.prepare(`
      CREATE TABLE IF NOT EXISTS custom_table_data (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        table_id INTEGER NOT NULL,
        distributor_id TEXT NOT NULL,
        data TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (table_id) REFERENCES custom_tables(id) ON DELETE CASCADE
      )
    `).run();
    
    // Clear existing data for this table
    db.prepare(`
      DELETE FROM custom_table_data 
      WHERE table_id = ? AND distributor_id = ?
    `).run(tableId, distributorId);
    
    // Insert new data
    const insertStmt = db.prepare(`
      INSERT INTO custom_table_data (table_id, distributor_id, data)
      VALUES (?, ?, ?)
    `);
    
    let imported = 0;
    let errors = [];
    
    parsedData.forEach((row, index) => {
      try {
        console.log(`Processing row ${index + 1}:`, JSON.stringify(row));
        
        // Skip empty rows
        const hasData = Object.values(row).some(value => value && value.trim());
        console.log(`Row ${index + 1} has data:`, hasData);
        
        if (!hasData) {
          console.log(`Skipping empty row ${index + 1}`);
          return;
        }
        
        // Store row data as JSON
        console.log(`Inserting row ${index + 1} into database:`, JSON.stringify(row));
        insertStmt.run(tableId, distributorId, JSON.stringify(row));
        imported++;
        console.log(`Successfully imported row ${index + 1}`);
      } catch (error) {
        console.error(`Error processing row ${index + 1}:`, error);
        errors.push(`Row ${index + 1}: ${error.message}`);
      }
    });
    
    console.log(`Imported ${imported} rows into custom table: ${customTable.name}`);
    
    res.json({
      success: true,
      imported: imported,
      errors: errors,
      table_name: customTable.name
    });
    
  } catch (error) {
    console.error('Error importing custom table data:', error);
    res.status(500).json({ error: 'Failed to import custom table data' });
  }
});

// Add field to existing custom table
app.post('/api/custom-tables/:tableId/add-field', (req, res) => {
  console.log('Add field to custom table request:', req.params.tableId);
  console.log('Request body:', JSON.stringify(req.body, null, 2));
  console.log('Distributor ID:', req.session.distributor_id);
  
  if (!req.session.distributor_id) {
    console.log('ERROR: Not authenticated');
    return res.status(401).json({ error: 'Not authenticated' });
  }
  
  try {
    const distributorId = req.session.distributor_id;
    const tableId = req.params.tableId;
    const { name, label, data_type, options } = req.body;
    
    console.log('Parsed values:', { name, label, data_type, options });
    
    // Validate input
    if (!name || !data_type) {
      console.log('ERROR: Missing required fields');
      return res.status(400).json({ error: 'Field name and data type are required' });
    }
    
    // Check if table exists and belongs to distributor
    console.log('Checking if table exists...');
    let customTable;
    if (isNaN(tableId)) {
      // tableId is a string (table name)
      customTable = db.prepare(`
        SELECT * FROM custom_tables 
        WHERE name = ? AND distributor_id = ?
      `).get(tableId, distributorId);
    } else {
      // tableId is numeric (table ID)
      customTable = db.prepare(`
        SELECT * FROM custom_tables 
        WHERE id = ? AND distributor_id = ?
      `).get(tableId, distributorId);
    }
    
    console.log('Custom table found:', customTable);
    
    if (!customTable) {
      console.log('ERROR: Custom table not found');
      return res.status(404).json({ error: 'Custom table not found' });
    }
    
    // Check if field name already exists
    console.log('Checking for existing field...');
    const existingField = db.prepare(`
      SELECT * FROM custom_table_fields 
      WHERE table_id = ? AND name = ?
    `).get(customTable.id, name);
    
    console.log('Existing field check result:', existingField);
    
    if (existingField) {
      console.log('ERROR: Field name already exists');
      return res.status(400).json({ error: 'Field name already exists' });
    }
    
    // Get the highest field_order for this table
    console.log('Getting max field order...');
    const maxOrder = db.prepare(`
      SELECT MAX(field_order) as max_order FROM custom_table_fields 
      WHERE table_id = ?
    `).get(customTable.id);
    
    console.log('Max order result:', maxOrder);
    const fieldOrder = (maxOrder.max_order || 0) + 1;
    console.log('New field order:', fieldOrder);
    
    // Prepare validation_rules
    let validationRules = {};
    if (data_type === 'dropdown' && options) {
      const optionsArray = options.split(',').map(option => option.trim()).filter(option => option.length > 0);
      validationRules = {
        type: 'dropdown',
        options: optionsArray
      };
    }
    console.log('Validation rules:', JSON.stringify(validationRules));
    
    // First, let's check the actual table schema
    console.log('Checking table schema...');
    const schemaInfo = db.prepare(`PRAGMA table_info(custom_table_fields)`).all();
    console.log('Current table schema:', schemaInfo);
    
    // Insert the new field (only using columns that exist)
    console.log('Preparing to insert new field...');
    const insertField = db.prepare(`
      INSERT INTO custom_table_fields (
        table_id, name, label, source_table, source_attribute, 
        data_type, is_key, field_order
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
    
    console.log('Insert parameters:', {
      tableId: customTable.id,
      name,
      label: label || name,
      source_table: null,
      source_attribute: null,
      data_type,
      is_key: 0, // Convert boolean to integer for SQLite
      field_order: fieldOrder
    });
    
    const result = insertField.run(
      customTable.id,
      name,
      label || name,
      null, // source_table
      null, // source_attribute
      data_type,
      0, // is_key: Convert boolean false to integer 0 for SQLite
      fieldOrder
    );
    
    console.log('Insert result:', result);
    console.log(`SUCCESS: Added field '${name}' to custom table ${tableId}`);
    
    res.json({
      success: true,
      field_id: result.lastInsertRowid,
      message: 'Field added successfully'
    });
    
  } catch (error) {
    console.error('FULL ERROR adding field to custom table:', error);
    console.error('Error stack:', error.stack);
    res.status(500).json({ 
      error: 'Failed to add field to custom table',
      details: error.message 
    });
  }
});

// Custom Table Data API - Get data for a specific custom table
app.get('/api/custom-tables/:tableId/data', (req, res) => {
  console.log('🔍 CUSTOM TABLE DATA API CALLED');
  console.log('🔍 Request params:', req.params);
  console.log('🔍 Query params:', req.query);
  console.log('🔍 Session distributor_id:', req.session.distributor_id);
  console.log('🔍 Table ID requested:', req.params.tableId);
  console.log('🔍 Account ID filter:', req.query.account_id);
  
  if (!req.session.distributor_id) {
    console.log('🔍 ❌ Authentication failed - no distributor_id in session');
    return res.status(401).json({ error: 'Not authenticated' });
  }
  
  try {
    const distributorId = req.session.distributor_id;
    const tableId = req.params.tableId;
    const accountId = req.query.account_id; // Optional filter by account ID
    
    // Get table info - handle both numeric ID and table name
    let table;
    console.log('🔍 Looking up table:', tableId, 'for distributor:', distributorId);
    
    if (isNaN(tableId)) {
      // tableId is a string (table name)
      console.log('🔍 Searching by table name (string)');
      table = db.prepare(`
        SELECT * FROM custom_tables 
        WHERE name = ? AND distributor_id = ?
      `).get(tableId, distributorId);
    } else {
      // tableId is numeric (table ID)
      console.log('🔍 Searching by table ID (numeric)');
      table = db.prepare(`
        SELECT * FROM custom_tables 
        WHERE id = ? AND distributor_id = ?
      `).get(tableId, distributorId);
    }
    
    console.log('🔍 Table lookup result:', table);
    
    if (!table) {
      console.log('🔍 ❌ Table not found! Available tables:');
      const allTables = db.prepare(`SELECT * FROM custom_tables WHERE distributor_id = ?`).all(distributorId);
      console.log('🔍 Available tables:', allTables.map(t => `"${t.name}" (ID: ${t.id})`));
      return res.status(404).json({ error: 'Custom table not found' });
    }
    
    // Get table fields
    const fields = db.prepare(`
      SELECT * FROM custom_table_fields 
      WHERE table_id = ? 
      ORDER BY field_order
    `).all(table.id);
    
    // Get table data
    let query = `
      SELECT * FROM custom_table_data 
      WHERE table_id = ? AND distributor_id = ?
    `;
    let params = [table.id, distributorId];
    
    // If account_id is provided, filter by it
    if (accountId) {
      // Dynamically detect the account field name from the table fields
      let accountField = fields.find(field => 
        field.source_table === 'accounts' && field.source_attribute === 'id'
      );
      
      // If not found by source table, try by field name patterns
      if (!accountField) {
        accountField = fields.find(field => {
          const fieldName = field.name.toLowerCase();
          return fieldName === 'accountid' || 
                 fieldName === 'account_id' || 
                 fieldName === 'account' ||
                 fieldName.includes('account');
        });
      }
      
      const accountFieldName = accountField ? accountField.name : 'account_id';
      console.log('🔍 Account field detection:', {
        accountField: accountField,
        accountFieldName: accountFieldName,
        allFields: fields.map(f => f.name)
      });
      
      query += ` AND JSON_EXTRACT(data, '$.${accountFieldName}') = ?`;
      params.push(accountId);
      console.log('🔍 Using account field name:', accountFieldName);
    }
    
    query += ` ORDER BY created_at DESC`;
    
    console.log('🔍 Executing query:', query);
    console.log('🔍 Query params:', params);
    
    const dataRows = db.prepare(query).all(...params);
    console.log('🔍 Raw data rows from database:', dataRows.length, 'rows');
    
    // Parse the JSON data
    const parsedData = dataRows.map(row => {
      try {
        const parsed = {
          id: row.id,
          ...JSON.parse(row.data),
          created_at: row.created_at
        };
        console.log('🔍 Parsed row:', parsed);
        return parsed;
      } catch (e) {
        console.error('🔍 Error parsing table data for row:', row.id, e);
        return { id: row.id, error: 'Invalid data format' };
      }
    });
    
    console.log(`🔍 ✅ Returning ${parsedData.length} records for table ${table.name}`);
    console.log('🔍 Final response data:', parsedData);
    
    const responseData = {
      table: table,
      fields: fields,
      data: parsedData
    };
    
    console.log('🔍 Complete API response:', JSON.stringify(responseData, null, 2));
    res.json(responseData);
    
  } catch (error) {
    console.error('Error fetching custom table data:', error);
    res.status(500).json({ error: 'Failed to fetch custom table data' });
  }
});

// Custom Table Fields API - Get field metadata for intelligent field selection
app.get('/api/custom-tables/:tableId/fields', (req, res) => {
  console.log('Custom table fields request for table:', req.params.tableId);
  
  if (!req.session.distributor_id) {
    return res.status(401).json({ error: 'Not authenticated' });
  }
  
  try {
    const distributorId = req.session.distributor_id;
    const tableId = req.params.tableId;
    
    // Get table info - handle both numeric ID and table name
    let table;
    if (isNaN(tableId)) {
      // tableId is a string (table name)
      table = db.prepare(`
        SELECT * FROM custom_tables 
        WHERE name = ? AND distributor_id = ?
      `).get(tableId, distributorId);
    } else {
      // tableId is numeric (table ID)
      table = db.prepare(`
        SELECT * FROM custom_tables 
        WHERE id = ? AND distributor_id = ?
      `).get(tableId, distributorId);
    }
    
    if (!table) {
      return res.status(404).json({ error: 'Custom table not found' });
    }
    
    // Get table fields
    const fields = db.prepare(`
      SELECT * FROM custom_table_fields 
      WHERE table_id = ? 
      ORDER BY field_order
    `).all(table.id);
    
    // Suggest best display field based on common patterns
    const suggestedDisplayField = fields.find(field => {
      const fieldName = field.name.toLowerCase();
      return fieldName.includes('name') || 
             fieldName.includes('title') || 
             fieldName.includes('description') || 
             fieldName.includes('method') || 
             fieldName.includes('option') || 
             fieldName.includes('label');
    });
    
    // Get sample data to help with field selection
    const sampleData = db.prepare(`
      SELECT * FROM custom_table_data 
      WHERE table_id = ? AND distributor_id = ?
      LIMIT 1
    `).get(table.id, distributorId);
    
    let sampleFields = [];
    if (sampleData) {
      try {
        const parsed = JSON.parse(sampleData.data);
        sampleFields = Object.keys(parsed).filter(key => key !== 'id' && key !== 'account_id');
      } catch (e) {
        console.error('Error parsing sample data:', e);
      }
    }
    
    res.json({
      table: table,
      fields: fields,
      suggestedDisplayField: suggestedDisplayField?.name || (sampleFields.length > 0 ? sampleFields[0] : 'name'),
      sampleFieldNames: sampleFields,
      fieldCount: fields.length
    });
    
  } catch (error) {
    console.error('Error fetching custom table fields:', error);
    res.status(500).json({ error: 'Failed to fetch custom table fields' });
  }
});

app.get('/api/add-header-logo-column', (req, res) => {
  try {
    // Check if column exists
    const columns = db.prepare(`PRAGMA table_info(distributors)`).all();
    const hasColumn = columns.some(col => col.name === 'header_logo_path');
    
    if (!hasColumn) {
      // Add the column
      db.prepare(`ALTER TABLE distributors ADD COLUMN header_logo_path TEXT`).run();
      res.json({ success: true, message: 'Header logo column added' });
    } else {
      res.json({ success: true, message: 'Header logo column already exists' });
    }
  } catch (error) {
    console.error('Error adding column:', error);
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/branding/logo', (req, res) => {
  console.log('Logo request');
  
  if (!req.session.distributor_id) {
    return res.status(401).json({ error: 'Not authenticated' });
  }
  
  try {
    // Check if distributor has a logo
    const distributor = db.prepare(`
      SELECT logo_path FROM distributors WHERE id = ?
    `).get(req.session.distributor_id);
    
    console.log('Distributor logo path:', distributor?.logo_path);
    
    if (!distributor || !distributor.logo_path) {
      return res.json({ logo: null });
    }
    
    // Check if file exists - add more debugging
    const relativePath = distributor.logo_path.startsWith('/') 
      ? distributor.logo_path.substring(1) 
      : distributor.logo_path;
      
    const absolutePath = path.join(__dirname, 'public', relativePath);
    console.log('Checking logo at absolute path:', absolutePath);
    
    // FIXED: Use fs.existsSync instead of fs.promises.existsSync
    if (!fs.existsSync(absolutePath)) {
      console.log('Logo file not found at:', absolutePath);
      return res.json({ logo: null });
    }
    
    // IMPORTANT: Return the URL to the logo that will work in the unified setup
    // Use a relative URL that will work regardless of domain
    const logoUrl = `/${relativePath}`;
    console.log('Returning logo URL:', logoUrl);
    res.json({ logo: logoUrl });
  } catch (error) {
    console.error('Error getting logo:', error);
    res.status(500).json({ error: 'Error getting logo' });
  }
});

app.get('/api/branding/header-logo', (req, res) => {
  console.log('Header logo request');
  
  if (!req.session.distributor_id) {
    return res.status(401).json({ error: 'Not authenticated' }); 
  }
  
  try {
    // Check if distributor has a header logo
    const distributor = db.prepare(`
      SELECT header_logo_path FROM distributors WHERE id = ?
    `).get(req.session.distributor_id);
    
    console.log('Distributor header logo path:', distributor?.header_logo_path);
    
    if (!distributor || !distributor.header_logo_path) {
      return res.json({ logo: null });
    }
    
    // Check if file exists
    const relativePath = distributor.header_logo_path.startsWith('/') 
      ? distributor.header_logo_path.substring(1) 
      : distributor.header_logo_path;
      
    const absolutePath = path.join(__dirname, 'public', relativePath);
    console.log('Checking header logo at absolute path:', absolutePath);
    
    // FIXED: Use fs.existsSync instead of fs.promises.existsSync
    if (!fs.existsSync(absolutePath)) {
      console.log('Header logo file not found at:', absolutePath);
      return res.json({ logo: null });
    }
    
    // Return the URL to the logo that will work in the unified setup
    const logoUrl = `/${relativePath}`;
    console.log('Returning header logo URL:', logoUrl);
    res.json({ logo: logoUrl });
  } catch (error) {
    console.error('Error getting header logo:', error);
    res.status(500).json({ error: 'Error getting header logo' });
  }
});
// Get all logic scripts for a distributor


app.get('/api/logic-scripts', async (req, res) => {
  if (!req.session.distributor_id || req.session.userType !== 'Admin') {
    return res.status(401).json({ error: 'Not authorized' });
  }
  try {
    const distributorId = req.session.distributor_id;
    
    const stmt = db.prepare(`
      SELECT id, trigger_point, description, script_content, sequence_order, active, created_at
      FROM logic_scripts 
      WHERE distributor_id = ?`);
    const scripts = stmt.all(distributorId);
    
    res.json(scripts);
  } catch (error) {
    console.error('Error fetching logic scripts:', error);
    res.status(500).json({ error: 'Failed to fetch logic scripts' });
  }
});

// Get script content for editing
app.get('/api/logic-scripts/:id', async (req, res) => {
  if (!req.session.distributor_id || req.session.userType !== 'Admin') {
    return res.status(401).json({ error: 'Not authorized' });
  }
 
  try {
    const distributorId = req.session.distributor_id;
    const scriptId = req.params.id;
    
   const stmt = db.prepare(`
      SELECT * FROM logic_scripts 
      WHERE id = ? AND distributor_id = ?`);
      const script = stmt.get(scriptId, distributorId);
      if (!script)
    
    if (script.length === 0) {
      return res.status(404).json({ error: 'Script not found' });
    }
    
    res.json(script[0]);
  } catch (error) {
    console.error('Error fetching script:', error);
    res.status(500).json({ error: 'Failed to fetch script' });
  }
});
// Create new logic script
app.post('/api/logic-scripts', (req, res) => {
  if (!req.session.distributor_id || req.session.userType !== 'Admin') {
    return res.status(401).json({ error: 'Not authorized' });
  }
  
  try {
    const distributorId = req.session.distributor_id;
    const { trigger_point, script_content, description, original_prompt } = req.body;
    
    // Get next sequence order for this trigger point
    const maxOrderStmt = db.prepare(`
      SELECT COALESCE(MAX(sequence_order), 0) as max_order 
      FROM logic_scripts 
      WHERE distributor_id = ? AND trigger_point = ?
    `);
    
    const maxOrderResult = maxOrderStmt.get(distributorId, trigger_point);
    const nextOrder = maxOrderResult.max_order + 1;
    
    const insertStmt = db.prepare(`
      INSERT INTO logic_scripts (distributor_id, trigger_point, script_content, description, sequence_order, active, original_prompt)
      VALUES (?, ?, ?, ?, ?, 1, ?)
    `);
    
    const result = insertStmt.run(distributorId, trigger_point, script_content, description, nextOrder, original_prompt);
    pricingEngine.clearCache(); // Add this line
    res.json({ success: true, id: result.lastInsertRowid });
  } catch (error) {
    console.error('Error creating logic script:', error);
    res.status(500).json({ error: 'Failed to create logic script' });
  }
});


// Update script order

app.put('/api/logic-scripts/reorder', (req, res) => {
  if (!req.session.distributor_id || req.session.userType !== 'Admin') {
    return res.status(401).json({ error: 'Not authorized' });
  }

  try {
    const distributorId = req.session.distributor_id;
    const { scripts } = req.body; // Array of { id, sequence_order }
    
    // Update all scripts using prepared statement
    const updateStmt = db.prepare(`
      UPDATE logic_scripts 
      SET sequence_order = ? 
      WHERE id = ? AND distributor_id = ?
    `);
    
    for (const script of scripts) {
      updateStmt.run(script.sequence_order, script.id, distributorId);
    }
    pricingEngine.clearCache(); // Add this line
    res.json({ success: true });
  } catch (error) {
    console.error('Error reordering scripts:', error);
    res.status(500).json({ error: 'Failed to reorder scripts' });
  }
});

app.put('/api/logic-scripts/:id', (req, res) => {
  if (!req.session.distributor_id || req.session.userType !== 'Admin') {
    return res.status(401).json({ error: 'Not authorized' });
  }
  
  try {
    const distributorId = req.session.distributor_id;
    const scriptId = req.params.id;
    const { active, description, script_content } = req.body;
    
    const updateFields = [];
    const updateValues = [];
    
    if (active !== undefined) {
      updateFields.push('active = ?');
      updateValues.push(active);
    }
    if (description !== undefined) {
      updateFields.push('description = ?');
      updateValues.push(description);
    }
    if (script_content !== undefined) {
      updateFields.push('script_content = ?');
      updateValues.push(script_content);
    }
    
    if (updateFields.length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }
    
    updateValues.push(scriptId, distributorId);
    
    const updateStmt = db.prepare(`
      UPDATE logic_scripts 
      SET ${updateFields.join(', ')}, updated_at = CURRENT_TIMESTAMP
      WHERE id = ? AND distributor_id = ?
    `);
    
    updateStmt.run(...updateValues);
    
    pricingEngine.clearCache(); // Add this line
    res.json({ success: true });
  } catch (error) {
    console.error('Error updating script:', error);
    res.status(500).json({ error: 'Failed to update script' });
  }
});
// Delete logic script


app.delete('/api/logic-scripts/:id', (req, res) => {
  if (!req.session.distributor_id || req.session.userType !== 'Admin') {
    return res.status(401).json({ error: 'Not authorized' });
  }
  
  try {
    const distributorId = req.session.distributor_id;
    const scriptId = req.params.id;
    
    const deleteStmt = db.prepare(`
      DELETE FROM logic_scripts 
      WHERE id = ? AND distributor_id = ?
    `);
    
    deleteStmt.run(scriptId, distributorId);

    pricingEngine.clearCache(); // Add this line
    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting script:', error);
    res.status(500).json({ error: 'Failed to delete script' });
  }
});

// Get scripts categorized for dashboard
app.get('/api/dashboard/scripts', (req, res) => {
  if (!req.session.distributor_id || req.session.userType !== 'Admin') {
    return res.status(401).json({ error: 'Not authorized' });
  }
  
  try {
    const distributorId = req.session.distributor_id;
    
    // Get all logic scripts
    const logicScripts = db.prepare(`
      SELECT id, trigger_point, description, script_content, active, created_at, updated_at, original_prompt, sequence_order
      FROM logic_scripts 
      WHERE distributor_id = ? 
      ORDER BY trigger_point, sequence_order
    `).all(distributorId);
    
    // Get all UI styles
    const uiStyles = db.prepare(`
      SELECT id, element_selector, styles, created_at, updated_at, original_prompt
      FROM styles 
      WHERE distributor_id = ? 
      ORDER BY created_at DESC
    `).all(distributorId);
    
    // Categorize scripts
    const categorized = {
      storefrontUI: [],
      cartUI: [],
      storefrontLogic: [],
      cartLogic: []
    };
    
    // Categorize UI styles
    uiStyles.forEach(style => {
      const selector = style.element_selector.toLowerCase();
      
      // Check if this is actually a cart page element (not just containing "cart")
      // Cart page elements typically have patterns like: cart-page-*, cart-item-*, cart-total-*, etc.
      // But "add-to-cart-button" is a storefront element that appears on product pages
      const isActualCartElement = selector.includes('cart-page') || 
                                 selector.includes('cart-item') || 
                                 selector.includes('cart-total') ||
                                 selector.includes('cart-summary') ||
                                 selector.includes('cart-checkout') ||
                                 selector.includes('cart-remove') ||
                                 selector.includes('cart-update') ||
                                 selector.includes('cart-quantity') ||
                                 (selector.includes('cart') && !selector.includes('add-to-cart'));
      
      if (isActualCartElement) {
        categorized.cartUI.push({
          id: style.id,
          type: 'ui',
          selector: style.element_selector,
          styles: style.styles,
          originalPrompt: style.original_prompt,
          createdAt: style.created_at,
          updatedAt: style.updated_at
        });
      } else {
        categorized.storefrontUI.push({
          id: style.id,
          type: 'ui',
          selector: style.element_selector,
          styles: style.styles,
          originalPrompt: style.original_prompt,
          createdAt: style.created_at,
          updatedAt: style.updated_at
        });
      }
    });
    
    // Categorize logic scripts
    logicScripts.forEach(script => {
      const isCartLogic = script.trigger_point === 'submit' || 
                         (script.description && script.description.toLowerCase().includes('cart')) ||
                         (script.script_content && script.script_content.toLowerCase().includes('cart'));
      
      if (isCartLogic) {
        categorized.cartLogic.push({
          id: script.id,
          type: 'logic',
          triggerPoint: script.trigger_point,
          description: script.description,
          scriptContent: script.script_content,
          originalPrompt: script.original_prompt,
          active: script.active,
          sequenceOrder: script.sequence_order,
          createdAt: script.created_at,
          updatedAt: script.updated_at
        });
      } else {
        categorized.storefrontLogic.push({
          id: script.id,
          type: 'logic',
          triggerPoint: script.trigger_point,
          description: script.description,
          scriptContent: script.script_content,
          originalPrompt: script.original_prompt,
          active: script.active,
          sequenceOrder: script.sequence_order,
          createdAt: script.created_at,
          updatedAt: script.updated_at
        });
      }
    });
    
    res.json(categorized);
  } catch (error) {
    console.error('Error fetching dashboard scripts:', error);
    res.status(500).json({ error: 'Failed to fetch scripts' });
  }
});

// Get customer attributes for script context
app.get('/api/customer-attributes', async (req, res) => {
  if (!req.session || !req.session.distributor_id || req.session.userType !== 'Admin') {
    return res.status(401).json({ error: 'Not authorized' });
  }
  try {
    const distributorId = req.session.distributor_id;
    
    // Fix: Use db.prepare().get() instead of db.query()
    const sampleCustomer = db.prepare(`
      SELECT * FROM accounts 
      WHERE distributor_id = ? 
      LIMIT 1
    `).get(distributorId);
    
    if (!sampleCustomer) {
      return res.json({ attributes: [] });
    }
    
    // Return list of available attributes
    const attributes = Object.keys(sampleCustomer).filter(key => 
      !['id', 'distributor_id', 'created_at', 'updated_at'].includes(key)
    );
    
    res.json({ attributes, sampleData: sampleCustomer });
  } catch (error) {
    console.error('Customer attributes error:', error);
    res.status(500).json({ error: 'Failed to fetch customer attributes' });
  }
});

// Execute logic scripts (for frontend to call)
app.post('/api/execute-logic-scripts', (req, res) => {
  try {
    const { distributor_id, trigger_point, context } = req.body;
    
    // Get all active scripts for this trigger point
    const scriptsStmt = db.prepare(`
      SELECT script_content, description 
      FROM logic_scripts 
      WHERE distributor_id = ? AND trigger_point = ? AND active = 1
      ORDER BY sequence_order
    `);
    
    const scripts = scriptsStmt.all(distributor_id, trigger_point);
    
    const results = [];
    
    for (const script of scripts) {
      try {
        // Create a safe execution environment
        const scriptFunction = new Function('customer', 'cart', 'products', script.script_content);
        const result = scriptFunction(context.customer, context.cart, context.products);
        
        results.push({
          description: script.description,
          result: result
        });
        
        // If any script blocks, stop execution
        if (result && result.allow === false) {
          return res.json({
            allowed: false,
            message: result.message,
            results: results
          });
        }
      } catch (error) {
        console.error(`Script execution error (${script.description}):`, error);
        // Continue with other scripts if one fails
        results.push({
          description: script.description,
          result: { allow: true, error: error.message }
        });
      }
    }
    
    res.json({
      allowed: true,
      results: results
    });
  } catch (error) {
    console.error('Error executing logic scripts:', error);
    res.status(500).json({ error: 'Failed to execute logic scripts' });
  }
});

app.post('/api/claude-logic-chat', async (req, res) => {

  if (!req.session.distributor_id || req.session.userType !== 'Admin') {
    return res.status(401).json({ error: 'Not authorized' });
  }
  try {
    const { message, customerAttributes, dynamicFormFields, triggerPoints } = req.body;
    
    // Build dynamic form fields context
    let formFieldsContext = '';
    if (dynamicFormFields && dynamicFormFields.length > 0) {
      formFieldsContext = `

AVAILABLE DYNAMIC FORM FIELDS (added via UI customization):
${dynamicFormFields.map(field => `- cart.${field.label} or cart.${field.label.toLowerCase()} or cart.${field.label.toLowerCase().replace(/\s+/g, '_')} (${field.fieldType})`).join('\n')}`;
    }
    
    const systemPrompt = `You are an expert at creating JavaScript logic scripts for e-commerce storefronts. 

AVAILABLE CUSTOMER ATTRIBUTES: ${customerAttributes.join(', ')}${formFieldsContext}

AVAILABLE TRIGGER POINTS:
- storefront_load: When customer first visits the store (USE THIS FOR PRICING MODIFICATIONS)
- submit: Before order is submitted

CRITICAL: How the execution context works:
The script receives these parameters that you can read and DIRECTLY MODIFY:
- customer: Object with customer attributes (${customerAttributes.join(', ')})
- cart: Object with {items: [], total: 0, subtotal: 0} + dynamic form field values
- products: Array of product objects with {id, name, sku, unitPrice, price, category, etc.}
- currentProduct: The specific product being processed (for storefront_load only)

FOR PRICING MODIFICATIONS (storefront_load trigger):
- The script is called once per product displayed
- You receive a 'products' array with ONE product object
- To modify prices: directly change products[0].price
- The system reads the modified products[0].price value after your script runs
- DO NOT return anything for pricing - just modify the products array directly

FOR BUSINESS LOGIC (submit trigger):
- Return an object: {allow: true/false, message?: "popup text"}
- If allow: false, the action is blocked and message is shown to user

PRICING SCRIPT EXAMPLES:

Example 1 - Simple discount:
SCRIPT_START
trigger_point: storefront_load
description: Apply $200 discount to all products

try {
  if (products && products.length > 0 && products[0].price) {
    // Directly modify the price in the products array
    products[0].price = Math.max(0, products[0].price - 200);
  }
} catch (error) {
  console.error("Error applying discount:", error);
}

SCRIPT_END

Example 2 - Customer-specific pricing:
SCRIPT_START
trigger_point: storefront_load
description: 20% surcharge for Pennsylvania customers

try {
  if (products && products.length > 0 && products[0].price) {
    if (customer.state === 'PA') {
      products[0].price = products[0].price * 1.20;
    }
  }
} catch (error) {
  console.error("Error applying surcharge:", error);
}

SCRIPT_END

Example 3 - Business logic (submit only):
SCRIPT_START
trigger_point: submit
description: Prevent orders under $100 minimum

if (cart.total < 100) {
  return {
    allow: false,
    message: "Your order must be at least $100. Current total: $" + cart.total.toFixed(2)
  };
}
return { allow: true };

SCRIPT_END

SCRIPT REQUIREMENTS:
1. For pricing (storefront_load): Directly modify products[0].price, do not return anything
2. For business logic (submit): Return {allow: true/false, message?: "text"}
3. Use only safe JavaScript - no external API calls, no dangerous operations
4. Always include try/catch for pricing scripts
5. Check if objects exist before modifying them

IMPORTANT: When providing a complete script, format it EXACTLY like this:

SCRIPT_START
trigger_point: [trigger_point_key]
description: [Brief description of what this script does]

[Your JavaScript code here]

SCRIPT_END

When user requests logic, follow this process:
1. Understand the requirement clearly
2. Determine if it's pricing modification (use storefront_load) or business logic (use submit)
3. For pricing: write code that modifies products[0].price directly
4. For business logic: write code that returns {allow: true/false, message}
5. Use the SCRIPT_START/SCRIPT_END format
6. Always include error handling

Be conversational and helpful. Explain your reasoning.`;

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: 2000,
        messages: [
          {
            role: 'user',
            content: `${systemPrompt}\n\nUser request: ${message}`
          }
        ]
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.log('🔥 Logic chat error response body:', errorText);
      
      // Check for 529 overload error
      if (response.status === 529 || errorText.includes('overloaded_error')) {
        return res.json({
          message: "Claude's servers are currently overwhelmed with requests globally. Please try your request again in a few moments. This is not an issue with your input - the AI service is temporarily overloaded.",
          script: null
        });
      }
      
      throw new Error('Claude API request failed');
    }

    const data = await response.json();
    const claudeResponse = data.content[0].text;

    // Extract script using the new format
    let script = null;
    const scriptMatch = claudeResponse.match(/SCRIPT_START\s*\ntrigger_point:\s*([^\n]+)\s*\ndescription:\s*([^\n]+)\s*\n([\s\S]*?)\nSCRIPT_END/);
    
    if (scriptMatch) {
      script = {
        trigger_point: scriptMatch[1].trim(),
        description: scriptMatch[2].trim(),
        script_content: scriptMatch[3].trim()
      };
    }

    res.json({
      message: claudeResponse,
      script: script
    });

  } catch (error) {
    console.error('Claude API error:', error);
    res.status(500).json({ error: 'Failed to process request with Claude' });
  }
});

// Helper function to determine trigger point from Claude's response
function determineTriggerPoint(response) {
  const lowerResponse = response.toLowerCase();
  
  if (lowerResponse.includes('submit') || lowerResponse.includes('order') || lowerResponse.includes('minimum')) {
    return 'submit';
  }
  if (lowerResponse.includes('add to cart') || lowerResponse.includes('adding')) {
    return 'add_to_cart';
  }
  if (lowerResponse.includes('quantity') || lowerResponse.includes('amount')) {
    return 'quantity_change';
  }
  if (lowerResponse.includes('storefront') || lowerResponse.includes('load') || lowerResponse.includes('visit')) {
    return 'storefront_load';
  }
  
  // Default to storefront_load if unclear
  return 'storefront_load';
}

// ===== UNIFIED AI CHAT SYSTEM =====

// Get conversations for a user
app.get('/api/chat/conversations', (req, res) => {
  if (!req.session.user_id || req.session.userType !== 'Admin') {
    return res.status(401).json({ error: 'Not authorized' });
  }

  try {
    const conversations = db.prepare(`
      SELECT * FROM chat_conversations 
      WHERE distributor_id = ? AND is_archived = FALSE 
      ORDER BY updated_at DESC
    `).all(req.session.distributor_id);

    res.json(conversations);
  } catch (error) {
    console.error('Error fetching conversations:', error);
    res.status(500).json({ error: 'Failed to fetch conversations' });
  }
});

// Get messages for a conversation
app.get('/api/chat/conversations/:conversationId/messages', (req, res) => {
  if (!req.session.user_id || req.session.userType !== 'Admin') {
    return res.status(401).json({ error: 'Not authorized' });
  }

  try {
    const messages = db.prepare(`
      SELECT * FROM chat_messages 
      WHERE conversation_id = ? 
      ORDER BY created_at ASC
    `).all(req.params.conversationId);

    res.json(messages);
  } catch (error) {
    console.error('Error fetching messages:', error);
    res.status(500).json({ error: 'Failed to fetch messages' });
  }
});

// Unified AI Chat endpoint
app.post('/api/unified-chat', async (req, res) => {
  console.log('🚀 Unified chat request received');
  console.log('🚀 Session info:', {
    distributor_id: req.session.distributor_id,
    userType: req.session.userType,
    user_id: req.session.user_id
  });
  
  if (!req.session.distributor_id || req.session.userType !== 'Admin') {
    console.log('🚀 Authorization failed');
    return res.status(401).json({ error: 'Not authorized' });
  }

  try {
    const { message, conversationId } = req.body;
    console.log('🚀 Request body:', { message, conversationId });
    
    if (!message) {
      return res.status(400).json({ error: 'Message is required' });
    }

    // Get or create conversation
    let conversation;
    try {
      if (conversationId) {
        console.log('🚀 Looking for existing conversation:', conversationId);
        conversation = db.prepare(`
          SELECT * FROM chat_conversations WHERE id = ? AND distributor_id = ?
        `).get(conversationId, req.session.distributor_id);
      }

      if (!conversation) {
        console.log('🚀 Creating new conversation');
        // Create new conversation
        const title = message.length > 50 ? message.substring(0, 50) + '...' : message;
        const result = db.prepare(`
          INSERT INTO chat_conversations (distributor_id, user_id, title)
          VALUES (?, ?, ?)
        `).run(req.session.distributor_id, req.session.user_id, title);
        
        conversation = { id: result.lastInsertRowid };
        console.log('🚀 Created conversation with ID:', conversation.id);
      }
    } catch (dbError) {
      console.error('🚀 Database error in conversation handling:', dbError);
      throw dbError;
    }

    // Save user message
    db.prepare(`
      INSERT INTO chat_messages (conversation_id, role, content, message_type)
      VALUES (?, ?, ?, ?)
    `).run(conversation.id, 'user', message, 'user_request');

    // Get conversation history for context
    const recentMessages = db.prepare(`
      SELECT role, content FROM chat_messages 
      WHERE conversation_id = ? 
      ORDER BY created_at DESC 
      LIMIT 10
    `).all(conversation.id);

    // Get current system state for context
    const [customerAttributes, dynamicFormFields, currentStyles, currentLogicScripts] = await Promise.all([
      // Customer attributes
      db.prepare(`
        SELECT attribute_name, attribute_label, data_type 
        FROM custom_attributes_definitions 
        WHERE distributor_id = ? AND entity_type = 'accounts'
      `).all(req.session.distributor_id),
      
      // Dynamic form fields
      db.prepare(`
        SELECT insertion_zone, content_data 
        FROM dynamic_content 
        WHERE distributor_id = ? AND content_type = 'form-field' AND active = 1
      `).all(req.session.distributor_id),
      
      // Current styles (sample)
      db.prepare(`
        SELECT COUNT(*) as count FROM styles WHERE distributor_id = ?
      `).get(req.session.distributor_id),
      
      // Current logic scripts
      db.prepare(`
        SELECT trigger_point, description FROM logic_scripts 
        WHERE distributor_id = ? AND active = 1
      `).all(req.session.distributor_id)
    ]);

    // Classify intent using Claude
    const intentResponse = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: 200,
        messages: [{
          role: 'user',
          content: `Analyze this storefront customization request and classify it:

Request: "${message}"

Conversation History:
${recentMessages.slice().reverse().map(m => `${m.role}: ${m.content}`).join('\n').substring(0, 500)}

Current System State:
- Customer attributes: ${customerAttributes.map(a => a.attribute_name).join(', ')}
- Dynamic form fields: ${dynamicFormFields.length} fields
- Active logic scripts: ${currentLogicScripts.map(s => s.description).join(', ')}

Classify as one of:
1. "ui" - styling, visual changes, adding content/fields, layout modifications
2. "logic" - business rules, validation, pricing modifications, custom table lookups, price calculations, discounts, conditional pricing, customer-specific pricing
3. "both" - requires both UI and logic changes

IMPORTANT: Any request mentioning custom tables for pricing, price changes, price calculations, or business logic should be classified as "logic" or "both", NOT "ui".

Respond with ONLY the classification: ui, logic, or both`
        }]
      })
    });

    const intentData = await intentResponse.json();
    const intent = intentData.content[0].text.trim().toLowerCase();

    let uiResults = null;
    let logicResults = null;
    let combinedResponse = '';

    // Execute UI operations if needed
    if (intent === 'ui' || intent === 'both') {
      console.log('Executing UI operations...');
      
      // Build context for UI AI
      const orderCustomFields = db.prepare(`
        SELECT attribute_name, attribute_label, data_type, validation_rules 
        FROM custom_attributes_definitions 
        WHERE distributor_id = ? AND entity_type = 'orders'
      `).all(req.session.distributor_id);

      // Use existing UI AI function
      const aiResponse = await parseAIRequestWithClaude(req, message, orderCustomFields);
      
      // Process UI response (reuse existing logic)
      let modifications = [];
      let insertions = [];
      
      if (aiResponse && typeof aiResponse === 'object') {
        if (aiResponse.type === 'content_insertion' && aiResponse.insertions) {
          insertions = aiResponse.insertions;
        } else if (aiResponse.type === 'style_modification' && aiResponse.modifications) {
          modifications = aiResponse.modifications;
        } else if (Array.isArray(aiResponse)) {
          modifications = aiResponse;
        }
      }

      // Save modifications and insertions (reuse existing logic)
      if (modifications.length > 0) {
        const changes = [];
        for (const mod of modifications) {
          const existingStyle = db.prepare(`
            SELECT * FROM styles WHERE distributor_id = ? AND element_selector = ?
          `).get(req.session.distributor_id, mod.selector);

          if (existingStyle) {
            const existingStyles = JSON.parse(existingStyle.styles || '{}');
            const mergedStyles = { ...existingStyles, ...mod.styles };
            
            db.prepare(`
              UPDATE styles SET styles = ?, updated_at = CURRENT_TIMESTAMP 
              WHERE distributor_id = ? AND element_selector = ?
            `).run(JSON.stringify(mergedStyles), req.session.distributor_id, mod.selector);
          } else {
            db.prepare(`
              INSERT INTO styles (distributor_id, element_selector, styles, original_prompt)
              VALUES (?, ?, ?, ?)
            `).run(req.session.distributor_id, mod.selector, JSON.stringify(mod.styles), message);
          }
          changes.push(`Modified ${mod.selector}`);
        }
        uiResults = { type: 'styles', changes };
      }

      if (insertions.length > 0) {
        const changes = [];
        for (const insertion of insertions) {
          const result = db.prepare(`
            INSERT INTO dynamic_content (distributor_id, insertion_zone, content_type, content_data)
            VALUES (?, ?, ?, ?)
          `).run(
            req.session.distributor_id,
            insertion.zone,
            insertion.type,
            JSON.stringify(insertion.data)
          );
          changes.push(`Added ${insertion.type} to ${insertion.zone}`);
        }
        uiResults = { type: 'content', changes };
      }
    }

    // Execute Logic operations if needed
    if (intent === 'logic' || intent === 'both') {
      console.log('Executing Logic operations...');
      
      // Build context for Logic AI including dynamic form fields
      const formFields = dynamicFormFields.map(field => {
        const data = JSON.parse(field.content_data);
        return {
          zone: field.insertion_zone,
          label: data.label,
          fieldType: data.fieldType,
          options: data.options
        };
      });

      let formFieldsContext = '';
      if (formFields.length > 0) {
        formFieldsContext = `
AVAILABLE DYNAMIC FORM FIELDS (added via UI customization):
${formFields.map(field => `- cart.${field.label} or cart.${field.label.toLowerCase()} or cart.${field.label.toLowerCase().replace(/\s+/g, '_')} (${field.fieldType})`).join('\n')}`;
      }

      // Fetch available custom tables for logic context
      const customTables = db.prepare(`
        SELECT ct.*, 
               GROUP_CONCAT(
                 ctf.name || ':' || ctf.label || ':' || ctf.data_type || ':' || 
                 COALESCE(ctf.source_table, '') || ':' || COALESCE(ctf.source_attribute, ''),
                 '|'
               ) as fields_info
        FROM custom_tables ct
        LEFT JOIN custom_table_fields ctf ON ct.id = ctf.table_id
        WHERE ct.distributor_id = ?
        GROUP BY ct.id, ct.name, ct.description
        ORDER BY ct.created_at DESC
      `).all(req.session.distributor_id);

      // Build custom tables context for logic AI
      let customTablesContext = '';
      if (customTables.length > 0) {
        customTablesContext = `

AVAILABLE CUSTOM TABLES (for data lookups and business logic):
${customTables.map(table => {
  let tableInfo = `- "${table.name}" - ${table.description || 'Custom data table'}`;
  if (table.fields_info) {
    const fields = table.fields_info.split('|').filter(f => f.trim());
    tableInfo += '\n  Fields:';
    fields.forEach(fieldInfo => {
      const [name, label, dataType, sourceTable, sourceAttribute] = fieldInfo.split(':');
      tableInfo += `\n    • ${name} (${dataType})`;
      if (sourceTable && sourceAttribute) {
        tableInfo += ` - linked to ${sourceTable}.${sourceAttribute}`;
      }
    });
  }
  return tableInfo;
}).join('\n\n')}

IMPORTANT: To access custom table data in logic scripts, you can use database lookups within your JavaScript code.`;
      }

      const systemPrompt = `You are an expert at creating JavaScript logic scripts for e-commerce storefronts. 

AVAILABLE CUSTOMER ATTRIBUTES: ${customerAttributes.map(a => a.attribute_name).join(', ')}${formFieldsContext}${customTablesContext}

AVAILABLE TRIGGER POINTS:
- storefront_load: When customer first visits the store (USE THIS FOR PRICING MODIFICATIONS)
- submit: Before order is submitted

CRITICAL: How the execution context works:
The script receives these parameters that you can read and DIRECTLY MODIFY:
- customer: Object with customer attributes (${customerAttributes.map(a => a.attribute_name).join(', ')})
- cart: Object with {items: [], total: 0, subtotal: 0} + dynamic form field values
- products: Array of product objects with {id, name, sku, unitPrice, price, category, etc.}

FOR BUSINESS LOGIC (submit trigger):
- Return an object: {allow: true/false, message?: "popup text"}
- If allow: false, the action is blocked and message is shown to user

Example script:
SCRIPT_START
trigger_point: submit
description: Make OrderType field mandatory

if (!cart.OrderType || cart.OrderType === '') {
  return {
    allow: false,
    message: "Please select an Order Type before submitting your order."
  };
}
return { allow: true };

SCRIPT_END

SCRIPT REQUIREMENTS:
1. For business logic (submit): Return {allow: true/false, message?: "text"}
2. Use only safe JavaScript - no external API calls, no dangerous operations
3. Always include try/catch for safety
4. Check if objects exist before accessing them`;

      // Call Claude for logic script generation
      const logicResponse = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': process.env.ANTHROPIC_API_KEY,
          'anthropic-version': '2023-06-01'
        },
        body: JSON.stringify({
          model: 'claude-3-5-sonnet-20241022',
          max_tokens: 1500,
          messages: [{
            role: 'user',
            content: `${systemPrompt}\n\nUser request: ${message}`
          }]
        })
      });

      const logicData = await logicResponse.json();
      const claudeResponse = logicData.content[0].text;

      // Extract script
      const scriptMatch = claudeResponse.match(/SCRIPT_START\s*\ntrigger_point:\s*([^\n]+)\s*\ndescription:\s*([^\n]+)\s*\n([\s\S]*?)\nSCRIPT_END/);
      
      if (scriptMatch) {
        const script = {
          trigger_point: scriptMatch[1].trim(),
          description: scriptMatch[2].trim(),
          script_content: scriptMatch[3].trim()
        };

        // Save the script
        db.prepare(`
          INSERT INTO logic_scripts (distributor_id, trigger_point, description, script_content, active, original_prompt)
          VALUES (?, ?, ?, ?, 1, ?)
        `).run(req.session.distributor_id, script.trigger_point, script.description, script.script_content, message);

        logicResults = { type: 'script', description: script.description };
      }

      combinedResponse = claudeResponse;
    }

    // Build response message
    let responseMessage = '';
    if (intent === 'ui' && uiResults) {
      responseMessage = `✅ I've applied your UI customizations:\n${uiResults.changes.join('\n')}\n\nThe changes should be visible after refreshing your storefront.`;
    } else if (intent === 'logic' && logicResults) {
      responseMessage = combinedResponse;
    } else if (intent === 'both') {
      const parts = [];
      if (uiResults) {
        parts.push(`✅ UI Changes Applied:\n${uiResults.changes.join('\n')}`);
      }
      if (logicResults) {
        parts.push(`✅ Logic Script Created:\n${logicResults.description}`);
      }
      responseMessage = parts.join('\n\n') + '\n\nAll customizations are now active!';
    } else {
      responseMessage = "I wasn't able to process that request. Could you please rephrase or be more specific about what you'd like to customize?";
    }

    // Save assistant response
    const metadata = JSON.stringify({
      intent,
      uiResults,
      logicResults,
      conversationId: conversation.id
    });

    db.prepare(`
      INSERT INTO chat_messages (conversation_id, role, content, message_type, metadata)
      VALUES (?, ?, ?, ?, ?)
    `).run(conversation.id, 'assistant', responseMessage, intent, metadata);

    // Update conversation timestamp
    db.prepare(`
      UPDATE chat_conversations SET updated_at = CURRENT_TIMESTAMP WHERE id = ?
    `).run(conversation.id);

    res.json({
      message: responseMessage,
      conversationId: conversation.id,
      intent,
      uiResults,
      logicResults
    });

  } catch (error) {
    console.error('Unified chat error:', error);
    console.error('Error stack:', error.stack);
    console.error('Error details:', {
      message: error.message,
      code: error.code,
      errno: error.errno
    });
    res.status(500).json({ error: 'Failed to process request', details: error.message });
  }
});

// Delete header logo endpoint
app.post('/api/branding/header-logo', upload.single('logo'), (req, res) => {
  console.log('Header logo upload request');
  
  if (!req.session.distributor_id) {
    return res.status(401).json({ error: 'Not authenticated' });
  }
  
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded' });
  }
  
  try {
    console.log('File uploaded:', req.file);
    
    // Delete old header logo if exists
    const distributor = db.prepare(`
      SELECT header_logo_path FROM distributors WHERE id = ?
    `).get(req.session.distributor_id);
    
    if (distributor && distributor.header_logo_path) {
      try {
        const relativePath = distributor.header_logo_path.startsWith('/') 
          ? distributor.header_logo_path.substring(1) 
          : distributor.header_logo_path;
          
        const oldLogoPath = path.join(__dirname, 'public', relativePath);
        console.log('Checking for old header logo at:', oldLogoPath);
        if (fs.promises.existsSync(oldLogoPath)) {
          fs.promises.unlinkSync(oldLogoPath);
          console.log('Deleted old header logo');
        }
      } catch (err) {
        console.error('Error deleting old header logo:', err);
        // Continue even if delete fails
      }
    }
    
    // Store relative path from public directory - EXACTLY like the working version
    const relativeFilePath = 'uploads/' + path.basename(req.file.path);
    console.log('Storing relative file path for header logo:', relativeFilePath);
    
    db.prepare(`
      UPDATE distributors 
      SET header_logo_path = ? 
      WHERE id = ?
    `).run(relativeFilePath, req.session.distributor_id);
    
    // Return the URL to access the logo
    const logoUrl = '/' + relativeFilePath;
    console.log('Header logo URL:', logoUrl);
    res.json({ success: true, logo: logoUrl });
  } catch (error) {
    console.error('Error uploading header logo:', error);
    res.status(500).json({ error: 'Error uploading header logo' });
  }
});


app.post('/api/branding/logo', upload.single('logo'), (req, res) => {
  console.log('Logo upload request');
  
  if (!req.session.distributor_id) {
    return res.status(401).json({ error: 'Not authenticated' });
  }
  
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded' });
  }
  
  try {
    console.log('File uploaded:', req.file);
    
    // Delete old logo if exists
    const distributor = db.prepare(`
      SELECT logo_path FROM distributors WHERE id = ?
    `).get(req.session.distributor_id);
    
    if (distributor && distributor.logo_path) {
      try {
        const relativePath = distributor.logo_path.startsWith('/') 
          ? distributor.logo_path.substring(1) 
          : distributor.logo_path;
          
        const oldLogoPath = path.join(__dirname, 'public', relativePath);
        console.log('Checking for old logo at:', oldLogoPath);
        if (fs.promises.existsSync(oldLogoPath)) {
          fs.promises.unlinkSync(oldLogoPath);
          console.log('Deleted old logo');
        }
      } catch (err) {
        console.error('Error deleting old logo:', err);
        // Continue even if delete fails
      }
    }
    
    // Store relative path from public directory
    const relativeFilePath = 'uploads/' + path.basename(req.file.path);
    console.log('Storing relative file path:', relativeFilePath);
    
    db.prepare(`
      UPDATE distributors 
      SET logo_path = ? 
      WHERE id = ?
    `).run(relativeFilePath, req.session.distributor_id);
    
    // Return the URL to access the logo - ensure it works with unified setup
    const logoUrl = '/' + relativeFilePath;
    console.log('Logo URL:', logoUrl);
    res.json({ success: true, logo: logoUrl });
  } catch (error) {
    console.error('Error uploading logo:', error);
    res.status(500).json({ error: 'Error uploading logo' });
  }
});

app.get('/api/debug/scripts', (req, res) => {
  console.log('🔍 Debug endpoint called - fetching logic_scripts');
  
  try {
    const stmt = db.prepare('SELECT * FROM logic_scripts ORDER BY id');
    const rows = stmt.all();
    
    console.log('✅ Query successful, found', rows.length, 'rows');
    console.log('📊 Rows:', JSON.stringify(rows, null, 2));
    
    res.json({
      success: true,
      count: rows.length,
      scripts: rows
    });
    
  } catch (error) {
    console.error('❌ Error:', error);
    res.status(500).json({ 
      error: 'Database error', 
      details: error.message,
      stack: error.stack 
    });
  }
});


app.get('/api/diagnose-filesystem', (req, res) => {
  try {
    const publicDir = path.join(__dirname, 'public');
    const uploadsDir = path.join(publicDir, 'uploads');
    
    const result = {
      cwd: process.cwd(),
      dirname: __dirname,
      publicDirExists: fs.promises.existsSync(publicDir),
      uploadsDirExists: fs.promises.existsSync(uploadsDir),
      publicDirContents: [],
      uploadsDirContents: []
    };
    
    if (result.publicDirExists) {
      try {
        result.publicDirContents = fs.promises.readdirSync(publicDir);
      } catch (err) {
        result.publicDirError = err.message;
      }
    }
    
    if (result.uploadsDirExists) {
      try {
        result.uploadsDirContents = fs.promises.readdirSync(uploadsDir);
      } catch (err) {
        result.uploadsDirError = err.message;
      }
    }
    
    res.json(result);
  } catch (error) {
    console.error('Error in filesystem diagnostic:', error);
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/ai-customize', async (req, res) => {
  console.log('🔥 AI Customization request received');
  console.log('🔥 Request body:', JSON.stringify(req.body, null, 2));
  console.log('🔥 Session info:', {
    distributor_id: req.session.distributor_id,
    userType: req.session.userType,
    user_id: req.session.user_id
  });
  
  if (!req.session.distributor_id || req.session.userType !== 'Admin') {
    console.log('🔥 Authorization failed - not admin or no distributor_id');
    return res.status(401).json({ error: 'Not authorized' });
  }
  
  const { message, distributorSlug } = req.body;
  console.log('🔥 Extracted message:', message);
  console.log('🔥 Extracted distributorSlug:', distributorSlug);
  
  if (!message || !distributorSlug) {
    console.log('🔥 Missing required fields - message or distributorSlug');
    return res.status(400).json({ error: 'Message and distributor slug are required' });
  }
  
  // Fetch available custom fields for context
  const orderCustomFields = db.prepare(`
    SELECT attribute_name, attribute_label, data_type, validation_rules 
    FROM custom_attributes_definitions 
    WHERE distributor_id = ? AND entity_type = 'orders'
  `).all(req.session.distributor_id);
  
  // Fetch available custom tables for context
  const customTables = db.prepare(`
    SELECT ct.*, 
           GROUP_CONCAT(
             ctf.name || ':' || ctf.label || ':' || ctf.data_type || ':' || 
             COALESCE(ctf.source_table, '') || ':' || COALESCE(ctf.source_attribute, ''),
             '|'
           ) as fields_info
    FROM custom_tables ct
    LEFT JOIN custom_table_fields ctf ON ct.id = ctf.table_id
    WHERE ct.distributor_id = ?
    GROUP BY ct.id, ct.name, ct.description
    ORDER BY ct.created_at DESC
  `).all(req.session.distributor_id);
  
  console.log('🔥 DEBUG: Found custom order fields:', orderCustomFields.map(f => f.attribute_name));
  console.log('🔥 DEBUG: Found custom tables:', customTables.map(t => t.name));
  console.log('🔥 DEBUG: Full custom fields data:', JSON.stringify(orderCustomFields, null, 2));
  console.log('🔥 DEBUG: Full custom tables data:', JSON.stringify(customTables, null, 2));
  
  try {
    console.log(`🔥 Starting AI customization for ${distributorSlug}: ${message}`);
    
    console.log('🔥 Using unified frontend with database-driven styling');
    
    // Use Claude AI to parse the request and generate modifications
    console.log('🔥 Calling parseAIRequestWithClaude...');
    const aiResponse = await parseAIRequestWithClaude(req, message, orderCustomFields, customTables);
    console.log('🔥 AI Response received:', JSON.stringify(aiResponse, null, 2));
    
    // Check if Claude is overloaded
    if (aiResponse && aiResponse.overloaded) {
      console.log('🔥 DEBUG: Claude is overloaded, returning overload message');
      return res.json({
        response: "Claude's servers are currently overwhelmed with requests globally. Please try your request again in a few moments. This is not an issue with your input - the AI service is temporarily overloaded.",
        changes: []
      });
    }
    
    // Handle both old format (array) and new format (object with type)
    let modifications = [];
    let insertions = [];
    
    console.log('🔥 DEBUG: Processing AI response type:', typeof aiResponse);
    console.log('🔥 DEBUG: AI response is array:', Array.isArray(aiResponse));
    console.log('🔥 DEBUG: AI response has type property:', aiResponse && aiResponse.type);
    console.log('🔥 DEBUG: AI response structure:', JSON.stringify(aiResponse, null, 2));
    
    if (Array.isArray(aiResponse)) {
      console.log('🔥 DEBUG: Using old format - treating as styling modifications');
      modifications = aiResponse;
    } else if (aiResponse && aiResponse.type === 'styling') {
      console.log('🔥 DEBUG: Using new styling format');
      modifications = aiResponse.modifications || [];
      console.log('🔥 DEBUG: Extracted modifications:', modifications.length);
    } else if (aiResponse && aiResponse.type === 'content') {
      console.log('🔥 DEBUG: Using new content format');
      insertions = aiResponse.insertions || [];
      console.log('🔥 DEBUG: Extracted insertions:', insertions.length);
    } else {
      console.log('🔥 DEBUG: Unknown response format:', aiResponse);
    }
    
    console.log('🔥 DEBUG: Final counts - modifications:', modifications.length, 'insertions:', insertions.length);
    
    if (modifications.length === 0 && insertions.length === 0) {
      console.log('🔥 DEBUG: No modifications or insertions found, returning default response');
      return res.json({
        response: "I understand your request, but I couldn't determine specific changes to make. Could you be more specific about what visual or functional changes you'd like? For example:\n\n• 'Make the Add to Cart buttons blue with rounded corners'\n• 'Add a promotional banner at the top of the page'\n• 'Create a dark mode toggle in the header'",
        changes: []
      });
    }
    
    // Apply styling modifications and content insertions
    const appliedChanges = [];
    const errors = [];
    
    // Apply styling modifications
    for (const mod of modifications) {
      try {
        console.log('🔥 DEBUG: About to apply modification:', JSON.stringify(mod, null, 2));
        console.log('🔥 DEBUG: Element selector being processed:', mod.elementSelector);
        console.log('🔥 DEBUG: CSS properties being applied:', JSON.stringify(mod.cssProperties, null, 2));
        
        await applyModification(mod, req.session.distributor_id, message);
        appliedChanges.push(mod.description);
        console.log(`🔥 DEBUG: Successfully applied styling: ${mod.description}`);
        console.log('🔥 DEBUG: Style should now be saved to database');
      } catch (error) {
        console.error(`🔥 DEBUG: Failed to apply styling modification: ${mod.description}`, error);
        console.error('🔥 DEBUG: Error details:', error.stack);
        errors.push(`Failed: ${mod.description} - ${error.message}`);
      }
    }
    
    // Apply content insertions
    for (const insertion of insertions) {
      try {
        await applyContentInsertion(insertion, req.session.distributor_id);
        appliedChanges.push(insertion.description);
        console.log(`Applied content insertion: ${insertion.description}`);
      } catch (error) {
        console.error(`Failed to apply content insertion: ${insertion.description}`, error);
        errors.push(`Failed: ${insertion.description} - ${error.message}`);
      }
    }
    
    let response;
    if (appliedChanges.length > 0) {
      response = `Great! I've successfully applied the following changes:\n\n${appliedChanges.map(change => `✓ ${change}`).join('\n')}`;
      
      if (errors.length > 0) {
        response += `\n\nNote: Some changes couldn't be applied:\n${errors.map(error => `✗ ${error}`).join('\n')}`;
      }
      
      response += `\n\nThe changes should be visible after refreshing your storefront. Is there anything else you'd like me to customize?`;
    } else {
      response = `I encountered issues applying your requested changes:\n\n${errors.join('\n')}\n\nPlease try being more specific or contact support if the problem persists.`;
    }
    
    res.json({
      response: response,
      changes: appliedChanges,
      errors: errors
    });
    
  } catch (error) {
    console.error('🔥 AI customization error caught:', error);
    console.error('🔥 Error stack:', error.stack);
    console.error('🔥 Error message:', error.message);
    console.error('🔥 Error name:', error.name);
    res.status(500).json({ 
      error: 'Error processing customization request',
      response: "I encountered an error while processing your request. Please try again or contact support."
    });
  }
});

// Claude AI-powered request parser
async function parseAIRequestWithClaude(req, userRequest, orderCustomFields = [], customTables = []) {
  console.log('🔥 parseAIRequestWithClaude called');
  console.log('🔥 userRequest:', userRequest);
  console.log('🔥 orderCustomFields:', orderCustomFields);
  console.log('🔥 customTables:', customTables);
  console.log('🔥 ANTHROPIC_API_KEY exists:', !!process.env.ANTHROPIC_API_KEY);
  console.log('🔥 Processing AI customization request with Claude...');
  
  // Build custom fields context
  let customFieldsContext = '';
  if (orderCustomFields.length > 0) {
    customFieldsContext = '\n\nAVAILABLE CUSTOM ORDER FIELDS:\n';
    orderCustomFields.forEach(field => {
      customFieldsContext += `- "${field.attribute_name}" (${field.data_type})`;
      if (field.validation_rules) {
        try {
          const rules = JSON.parse(field.validation_rules);
          if (rules.options) {
            customFieldsContext += ` - Options: [${rules.options.join(', ')}]`;
          }
        } catch (e) {
          console.log('🔥 DEBUG: Error parsing validation_rules for field:', field.attribute_name, e);
        }
      }
      customFieldsContext += '\n';
    });
  }
  
  // Build custom tables context
  let customTablesContext = '';
  if (customTables.length > 0) {
    customTablesContext = '\n\nAVAILABLE CUSTOM TABLES:\n';
    customTables.forEach(table => {
      customTablesContext += `- "${table.name}" - ${table.description || 'Custom data table'}\n`;
      if (table.fields_info) {
        const fields = table.fields_info.split('|').filter(f => f.trim());
        customTablesContext += '  Fields:\n';
        fields.forEach(fieldInfo => {
          const [name, label, dataType, sourceTable, sourceAttribute] = fieldInfo.split(':');
          customTablesContext += `    • ${name} (${dataType})`;
          if (sourceTable && sourceAttribute) {
            customTablesContext += ` - linked to ${sourceTable}.${sourceAttribute}`;
          }
          customTablesContext += '\n';
        });
      }
      customTablesContext += '\n';
    });
  }
  
  console.log('🔥 DEBUG: Custom fields context built:', customFieldsContext);
  console.log('🔥 DEBUG: Custom tables context built:', customTablesContext);
  
  // Enhanced system prompt with styling AND content insertion capabilities  
  const systemPrompt = `You are an AI assistant that helps customize storefront and cart appearance using CSS styling AND content insertion.${customFieldsContext}${customTablesContext}

CAPABILITIES:
1. STYLING - Modify existing elements with CSS
2. CONTENT INSERTION - Add new elements to specific zones

AVAILABLE ELEMENTS TO STYLE:

STOREFRONT ELEMENTS:
- "add-to-cart-button" - add to cart buttons throughout the store
- "product-card" - individual product display cards  
- "header-nav" - top navigation area
- "search-bar" - product search input
- "category-buttons" - category filter buttons
- "product-price" - price display text
- "product-title" - product name text
- "page-background" - main page background
- "product-grid" - container holding all products
- "quantity-controls" - quantity selector interface

CART ELEMENTS:
- "cart-page-background" - cart page background
- "cart-header-nav" - cart page header navigation
- "cart-page-title" - "My Cart" title text
- "cart-home-button" - home button on cart page
- "cart-continue-shopping-button" - continue shopping button
- "cart-logout-button" - logout button on cart page
- "cart-loading-container" - loading message container
- "cart-loading-text" - loading message text
- "cart-empty-container" - empty cart message container
- "cart-empty-text" - empty cart message text
- "cart-browse-products-button" - browse products button
- "cart-summary-container" - cart summary section
- "cart-summary-title" - "Cart Summary" title
- "cart-summary-text" - item count text
- "cart-clear-button" - clear cart button
- "cart-items-container" - container for all cart items
- "cart-item-card" - individual cart item cards
- "cart-item-image-container" - product image container
- "cart-item-image" - product images in cart
- "cart-item-details" - product details section
- "cart-item-name" - product name in cart
- "cart-item-sku" - product SKU in cart
- "cart-item-price" - product price in cart
- "cart-item-description" - product description in cart
- "cart-item-controls" - quantity and action controls
- "cart-quantity-controls" - quantity adjustment section
- "cart-quantity-label" - "Quantity:" label
- "cart-quantity-button" - +/- quantity buttons
- "cart-quantity-input" - quantity input field
- "cart-item-actions" - update/remove button section
- "cart-update-button" - update quantity button
- "cart-remove-button" - remove item button
- "cart-item-total" - line total price
- "cart-total-container" - final total section
- "cart-subtotal" - subtotal amount text
- "cart-submit-order-button" - submit order button

AVAILABLE CONTENT INSERTION ZONES:

STOREFRONT ZONES:
- "storefront-header-top" - Above the main header
- "storefront-header-bottom" - Below the main header  
- "storefront-before-categories" - Before category buttons
- "storefront-after-categories" - After category buttons
- "storefront-before-products" - Before product grid
- "storefront-after-products" - After product grid
- "storefront-sidebar-left" - Left sidebar area
- "storefront-sidebar-right" - Right sidebar area

CART ZONES:
- "cart-header-top" - Above cart header
- "cart-header-bottom" - Below cart header
- "cart-before-items" - Before cart items list
- "cart-after-items" - After cart items list
- "cart-before-total" - Before total section
- "cart-after-total" - After total section
- "cart-sidebar-left" - Left sidebar on cart
- "cart-sidebar-right" - Right sidebar on cart

STYLING CAPABILITIES:
You can apply ANY CSS properties including:
- Colors: backgroundColor, color, borderColor
- Layout: display, flexDirection, justifyContent, alignItems, flexWrap
- Positioning: position, top, left, right, bottom
- Sizing: width, height, maxWidth, minHeight
- Spacing: margin, padding, gap
- Borders: border, borderRadius, borderWidth, borderStyle
- Shadows: boxShadow
- Text: fontSize, fontWeight, textAlign, textDecoration
- Visibility: display (none to hide), opacity
- Transform: transform, rotate, scale
- And any other valid CSS properties

ADVANCED LAYOUT CHANGES:
- To make elements horizontal: flexDirection: 'row'
- To make elements vertical: flexDirection: 'column'  
- To hide elements: display: 'none'
- To center elements: justifyContent: 'center', alignItems: 'center'
- To align left: justifyContent: 'flex-start'
- To create dropdowns: position: 'relative' with child elements having position: 'absolute'

EXAMPLES:

STOREFRONT EXAMPLES:
- "Make buttons black" → category-buttons: {backgroundColor: '#000000'}
- "Hide the search bar" → search-bar: {display: 'none'}
- "Center the category buttons" → category-filter-container: {justifyContent: 'center'}
- "Make product cards bigger" → product-card: {transform: 'scale(1.1)'}
- "Arrange category buttons vertically" → category-filter-container: {flexDirection: 'column', alignItems: 'flex-start'}

CART EXAMPLES:
- "Make the cart submit button green" → cart-submit-order-button: {backgroundColor: '#10B981'}
- "Change cart item cards to blue" → cart-item-card: {backgroundColor: '#EBF8FF', borderColor: '#3B82F6'}
- "Hide the clear cart button" → cart-clear-button: {display: 'none'}
- "Make cart page title larger" → cart-page-title: {fontSize: '3rem', fontWeight: 'bold'}
- "Change cart background to gray" → cart-page-background: {backgroundColor: '#F3F4F6'}
- "Make remove buttons red" → cart-remove-button: {backgroundColor: '#DC2626'}
- "Style cart quantity controls" → cart-quantity-button: {backgroundColor: '#6B7280', color: 'white'}

MULTI-SCREEN EXAMPLES:
- "Make all buttons blue" → affects both add-to-cart-button AND cart-submit-order-button
- "Change page backgrounds" → affects both page-background AND cart-page-background

CONTENT INSERTION EXAMPLES:
- "Add a banner above the products" → INSERT into storefront-before-products zone
- "Add a promotional message in cart" → INSERT into cart-header-bottom zone  
- "Add a help section to the right of products" → INSERT into storefront-sidebar-right zone
- "Add custom order field dropdown to cart" → INSERT into cart-after-items zone
- "Add [FieldName] field to cart" → INSERT form-field into appropriate cart zone
- "Add OrderType to the bottom of cart" → INSERT form-field into cart-before-total zone
- "I added a new custom order header field [Name]. Add it to [location]" → INSERT form-field
- "Add ShippingAddress table dropdown to cart" → INSERT custom-table-dropdown into cart zone
- "I made a [TableName] table. Add dropdown to cart" → INSERT custom-table-dropdown
- "Use [TableName] custom table as dropdown in [location]" → INSERT custom-table-dropdown

CONTENT INSERTION TYPES:
- "banner" - promotional banners with text/images
- "message" - informational text blocks
- "form-field" - input fields, dropdowns, checkboxes
- "custom-table-dropdown" - dropdowns populated from custom tables
- "custom-html" - any custom HTML content

IMPORTANT: Custom field requests are ALWAYS content insertion requests:
- Keywords like "add field", "custom field", "OrderType", "field to cart" = CONTENT INSERTION
- Requests mentioning Table Builder custom fields = CONTENT INSERTION  
- "Add [FieldName] to [location]" = CONTENT INSERTION
- Custom table requests: "table", "dropdown from table", "ShippingAddress table" = CUSTOM TABLE DROPDOWN INSERTION

Parse the user request and determine if it requires STYLING or CONTENT INSERTION:

STYLING REQUEST - modify existing elements:
Return: {"type": "styling", "modifications": [...]}

CONTENT INSERTION REQUEST - add new content (including custom fields):
Return: {"type": "content", "insertions": [...]}

USER REQUEST: "${userRequest}"

STYLING FORMAT:
{
  "type": "styling",
  "modifications": [
    {
      "elementSelector": "add-to-cart-button",
      "cssProperties": {"backgroundColor": "#8B4513"},
      "description": "Changed buttons to brown"
    }
  ]
}

CONTENT INSERTION FORMAT:
{
  "type": "content", 
  "insertions": [
    {
      "insertionZone": "storefront-before-products",
      "contentType": "banner",
      "contentData": {
        "text": "Special Sale - 20% Off!",
        "backgroundColor": "#10B981", 
        "color": "white",
        "textAlign": "center",
        "padding": "1rem"
      },
      "description": "Added promotional banner above products"
    }
  ]
}

CUSTOM FIELD INSERTION FORMAT:
{
  "type": "content",
  "insertions": [
    {
      "insertionZone": "cart-before-total",
      "contentType": "form-field", 
      "contentData": {
        "fieldType": "dropdown",
        "label": "OrderType",
        "options": ["Standard", "Rush", "Bulk"],
        "containerStyle": {"marginBottom": "1rem"},
        "labelStyle": {"fontWeight": "bold", "marginBottom": "0.5rem"},
        "inputStyle": {"padding": "0.5rem", "border": "1px solid #ccc", "borderRadius": "4px"}
      },
      "description": "Added OrderType dropdown field to cart"
    }
  ]
}

CUSTOM TABLE DROPDOWN INSERTION FORMAT:
{
  "type": "content",
  "insertions": [
    {
      "insertionZone": "cart-before-total",
      "contentType": "custom-table-dropdown",
      "contentData": {
        "label": "[User-friendly label for the dropdown]",
        "tableId": "[EXACT table name as created by user]",
        "displayField": "[Field to show in dropdown - usually name, title, description, or similar]",
        "valueField": "id",
        "containerStyle": {"marginBottom": "1rem"},
        "labelStyle": {"fontWeight": "bold", "marginBottom": "0.5rem"},
        "inputStyle": {"padding": "0.5rem", "border": "1px solid #ccc", "borderRadius": "4px", "width": "100%"}
      },
      "description": "Added custom table dropdown for [table purpose]"
    }
  ]
}

CRITICAL CUSTOM TABLE RULES:
1. **tableId**: Use the EXACT table name from the "REAL CUSTOM TABLES" section above
2. **valueField**: ALWAYS use "id" (this is the row identifier, not the filtering field)
3. **displayField**: Use the EXACT field name from the "ACTUAL DATA FIELDS" or "SUGGESTED DISPLAY FIELD" above
   - DO NOT GUESS field names - use only the field names listed in the table structure above
   - If "SUGGESTED DISPLAY FIELD" is provided, use that exact name
   - If no suggestion, use the first field from "ACTUAL DATA FIELDS" (excluding id, account_id)
4. **Filtering**: The system automatically filters by account_id - DO NOT use account_id as valueField
5. **Account ID**: The system will automatically filter the dropdown options by the current user's account ID

CRITICAL: If table structure is provided above, use EXACT field names from that data. DO NOT guess or make up field names.

RETURN ONLY VALID JSON FOR THE DETECTED REQUEST TYPE:`;

  // Smart table discovery - look up actual table structures if user mentions custom tables
  let enhancedTablesContext = '';
  
  try {
    // Check if user request mentions any table-related keywords
    const tableKeywords = [
      'table', 'dropdown', 'custom table', 'made a', 'created a',
      // Common table names users might create
      'PaymentMethod', 'Payment', 'Shipping', 'Address', 'Supplier', 'Category', 'Topping',
      'Customer', 'Product', 'Order', 'Invoice', 'Contact', 'Location', 'Department',
      'Method', 'Option', 'Choice', 'List', 'Menu'
    ];
    const mentionsTable = tableKeywords.some(keyword => 
      userRequest.toLowerCase().includes(keyword.toLowerCase())
    );
    
    if (mentionsTable) {
      console.log('🔍 User mentioned table-related keywords, looking up actual table structures...');
      
      // Get all available custom tables for this distributor
      const allTables = db.prepare(`
        SELECT * FROM custom_tables 
        WHERE distributor_id = ?
        ORDER BY name
      `).all(req.session.distributor_id);
      
      if (allTables.length > 0) {
        console.log('🔍 DEBUG: Found custom tables:', allTables.map(t => t.name));
        enhancedTablesContext = '\n\nREAL CUSTOM TABLES WITH EXACT FIELD NAMES:\n';
        
        for (const table of allTables) {
          // Get the actual field structure for each table
          const fields = db.prepare(`
            SELECT * FROM custom_table_fields 
            WHERE table_id = ? 
            ORDER BY field_order
          `).all(table.id);
          
          // Get sample data to show field content
          const sampleData = db.prepare(`
            SELECT * FROM custom_table_data 
            WHERE table_id = ? AND distributor_id = ?
            LIMIT 1
          `).get(table.id, req.session.distributor_id);
          
          console.log(`🔍 DEBUG: Table "${table.name}" has ${fields.length} fields and ${sampleData ? 'has' : 'NO'} sample data`);
          
          enhancedTablesContext += `TABLE: "${table.name}" (ID: ${table.id})\n`;
          enhancedTablesContext += `Description: ${table.description || 'Custom table'}\n`;
          enhancedTablesContext += `EXACT FIELD NAMES:\n`;
          
          // Add database field structure
          fields.forEach(field => {
            enhancedTablesContext += `  • ${field.name} (${field.data_type})${field.is_key ? ' [KEY]' : ''}\n`;
          });
          
          // Add sample data field names if available
          if (sampleData) {
            try {
              const parsed = JSON.parse(sampleData.data);
              const actualFields = Object.keys(parsed);
              console.log(`🔍 DEBUG: Sample data fields for "${table.name}":`, actualFields);
              enhancedTablesContext += `ACTUAL DATA FIELDS: ${actualFields.join(', ')}\n`;
              
              // Suggest best display field
              const displayField = actualFields.find(field => 
                field.toLowerCase().includes('name') || 
                field.toLowerCase().includes('title') || 
                field.toLowerCase().includes('description') ||
                field.toLowerCase().includes('method') ||
                field.toLowerCase().includes('option')
              ) || actualFields.filter(f => f !== 'id' && f !== 'account_id')[0];
              
              console.log(`🔍 DEBUG: Suggested display field for "${table.name}": "${displayField}"`);
              enhancedTablesContext += `SUGGESTED DISPLAY FIELD: "${displayField}"\n`;
            } catch (e) {
              console.error('🔍 DEBUG: Error parsing sample data for table:', table.name, e);
            }
          } else {
            console.log(`🔍 DEBUG: No sample data found for table "${table.name}"`);
            enhancedTablesContext += `NO SAMPLE DATA - Check if table has data for account_id filtering\n`;
          }
          
          enhancedTablesContext += `USAGE: tableId: "${table.name}", displayField: "[use exact field name above]", valueField: "id"\n\n`;
        }
        
        console.log('🔍 Enhanced tables context built:', enhancedTablesContext);
      }
    }
  } catch (error) {
    console.error('Error during table discovery:', error);
  }

  try {
    console.log('🔥 About to make Claude API call...');
    console.log('🔥 API Key length:', process.env.ANTHROPIC_API_KEY ? process.env.ANTHROPIC_API_KEY.length : 'undefined');
    console.log('🔥 System prompt length:', systemPrompt.length);
    
    const requestBody = {
      model: 'claude-3-5-haiku-20241022',
      max_tokens: 1000,
      messages: [{
        role: 'user',
        content: `${systemPrompt}${enhancedTablesContext}\n\nUser request: ${userRequest}`
      }]
    };
    console.log('🔥 DEBUG: System prompt being sent to Claude:');
    console.log('🔥 DEBUG: Prompt length:', systemPrompt.length);
    console.log('🔥 DEBUG: Prompt contains custom fields:', customFieldsContext.length > 0);
    console.log('🔥 DEBUG: User request in prompt:', userRequest);
    
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify(requestBody)
    });

    console.log('🔥 Response received. Status:', response.status);
    console.log('🔥 Response headers:', Object.fromEntries(response.headers.entries()));

    if (!response.ok) {
      const errorText = await response.text();
      console.log('🔥 Error response body:', errorText);
      
      // Check for 529 overload error
      if (response.status === 529 || errorText.includes('overloaded_error')) {
        throw new Error('CLAUDE_OVERLOADED');
      }
      
      throw new Error(`Claude API error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    console.log('🔥 DEBUG: Response data:', JSON.stringify(data, null, 2));
    const claudeResponse = data.content[0].text;
    
    console.log('🔥 DEBUG: Raw Claude response text:');
    console.log('🔥 DEBUG: Response length:', claudeResponse.length);
    console.log('🔥 DEBUG: Response content:', claudeResponse);
    console.log('🔥 DEBUG: Response contains "type":', claudeResponse.includes('"type"'));
    console.log('🔥 DEBUG: Response contains "content":', claudeResponse.includes('"content"'));
    console.log('🔥 DEBUG: Response contains "insertions":', claudeResponse.includes('"insertions"'));
    console.log('🔥 DEBUG: Response contains "elementSelector":', claudeResponse.includes('"elementSelector"'));
    console.log('🔥 DEBUG: Response contains "add-to-cart-button":', claudeResponse.includes('"add-to-cart-button"'));
    
    // Log specific patterns for Add to Cart button requests
    if (userRequest.toLowerCase().includes('add to cart') && userRequest.toLowerCase().includes('button')) {
      console.log('🔥 DEBUG: SPECIAL CASE - Add to Cart button request detected!');
      console.log('🔥 DEBUG: Original user request:', userRequest);
      console.log('🔥 DEBUG: Looking for add-to-cart-button in response...');
      const addToCartMatch = claudeResponse.match(/"elementSelector"\s*:\s*"([^"]*add-to-cart[^"]*)"/i);
      if (addToCartMatch) {
        console.log('🔥 DEBUG: Found Add to Cart element selector:', addToCartMatch[1]);
      } else {
        console.log('🔥 DEBUG: WARNING - Add to Cart button request but no add-to-cart element selector found!');
      }
    }
    
    // Log specific patterns for custom table dropdown requests
    if (userRequest.toLowerCase().includes('table') || userRequest.toLowerCase().includes('dropdown')) {
      console.log('🔥 DEBUG: CUSTOM TABLE REQUEST DETECTED!');
      console.log('🔥 DEBUG: Original user request:', userRequest);
      console.log('🔥 DEBUG: Enhanced tables context was:', enhancedTablesContext.substring(0, 500) + '...');
      console.log('🔥 DEBUG: Looking for custom-table-dropdown in response...');
      
      // Check if Claude generated a custom table dropdown
      if (claudeResponse.includes('custom-table-dropdown')) {
        console.log('🔥 DEBUG: ✅ Claude generated custom-table-dropdown response!');
        
        // Extract the tableId, displayField, and valueField from the response
        const tableIdMatch = claudeResponse.match(/"tableId"\s*:\s*"([^"]*)"/i);
        const displayFieldMatch = claudeResponse.match(/"displayField"\s*:\s*"([^"]*)"/i);
        const valueFieldMatch = claudeResponse.match(/"valueField"\s*:\s*"([^"]*)"/i);
        
        console.log('🔥 DEBUG: Generated tableId:', tableIdMatch ? tableIdMatch[1] : 'NOT FOUND');
        console.log('🔥 DEBUG: Generated displayField:', displayFieldMatch ? displayFieldMatch[1] : 'NOT FOUND');
        console.log('🔥 DEBUG: Generated valueField:', valueFieldMatch ? valueFieldMatch[1] : 'NOT FOUND');
        
        // Validate against available tables
        if (enhancedTablesContext) {
          const availableTables = enhancedTablesContext.match(/TABLE: "([^"]*)"/g);
          console.log('🔥 DEBUG: Available tables in context:', availableTables);
        }
      } else {
        console.log('🔥 DEBUG: ❌ WARNING - Table request but no custom-table-dropdown found in response!');
        console.log('🔥 DEBUG: Response type check - contains "content":', claudeResponse.includes('"content"'));
        console.log('🔥 DEBUG: Response type check - contains "form-field":', claudeResponse.includes('form-field'));
      }
    }
    
    // Use the parseClaudeResponse function instead of inline parsing
    console.log('🔥 DEBUG: Calling parseClaudeResponse...');
    const parsedResult = parseClaudeResponse(claudeResponse);
    console.log('🔥 DEBUG: parseClaudeResponse returned:', JSON.stringify(parsedResult, null, 2));
    
    return parsedResult;
    
  } catch (error) {
    console.error('🔥 Error in parseAIRequestWithClaude:', error);
    console.error('🔥 Error name:', error.name);
    console.error('🔥 Error message:', error.message);
    console.error('🔥 Error stack:', error.stack);
    console.error('🔥 Error type:', typeof error);
    console.error('🔥 Is TypeError:', error instanceof TypeError);
    console.error('🔥 Is ReferenceError:', error instanceof ReferenceError);
    console.error('🔥 Is SyntaxError:', error instanceof SyntaxError);
    
    // Check if this is a Claude overload error
    if (error.message === 'CLAUDE_OVERLOADED') {
      return { overloaded: true };
    }
    
    return [];
  }
}


// Read all relevant files in the distributor directory
async function readDistributorFiles(distributorDir) {
  const files = {};
  const filesToRead = [
    'components/Storefront.jsx',
    'components/Header.jsx', 
    'components/BackofficeOptions.jsx',
    'main.jsx'
  ];
  
  for (const filePath of filesToRead) {
    const fullPath = distributorDir + '/' + filePath;
    try {
      const content = await fs.promises.readFile(fullPath, 'utf8');
      files[filePath] = content;
    } catch (error) {
      console.log(`File not found: ${filePath}`);
      files[filePath] = null;
    }
  }
  
  return files;
}

// Generate comprehensive prompt for Claude
function generateClaudePrompt(userRequest, currentFiles) {
  const fileContents = Object.entries(currentFiles)
    .filter(([_, content]) => content !== null)
    .map(([file, content]) => `\n=== ${file} ===\n${content}\n`)
    .join('\n');

  return `You are an expert React/Tailwind CSS developer helping a user customize their e-commerce storefront. 

USER REQUEST: "${userRequest}"

CURRENT CODEBASE:
${fileContents}

TASK: Analyze the user's request and generate specific code modifications to implement their desired changes.

IMPORTANT GUIDELINES:
- You are modifying a React storefront with Tailwind CSS
- Preserve existing functionality unless explicitly asked to change it
- Use modern React patterns (hooks, functional components)
- Use Tailwind CSS classes for all styling
- Be precise with find/replace operations - use exact strings that exist in the code
- If creating new components, follow the existing code style
- Consider responsive design (mobile-friendly)

RESPOND WITH VALID JSON ONLY (no other text) IN THIS EXACT FORMAT:
{
  "understanding": "Brief explanation of what the user wants to accomplish",
  "modifications": [
    {
      "file": "components/Storefront.jsx",
      "type": "replace",
      "description": "Human-readable description of this change",
      "find": "exact string to find in the file",
      "replace": "exact string to replace it with"
    }
  ],
  "newFiles": [
    {
      "path": "components/NewComponent.jsx", 
      "content": "complete file content for new files"
    }
  ],
  "summary": "Overall summary of changes made"
}

EXAMPLES OF COMMON REQUESTS:
- Color changes: Replace existing Tailwind color classes (bg-green-500 → bg-blue-500)
- Styling: Add effects like hover:, shadow-, rounded-, etc.
- Layout: Modify flex, grid, spacing classes
- New features: Add new sections, components, or functionality
- Responsive: Add sm:, md:, lg: breakpoint classes

CRITICAL: Your find strings must match exactly what exists in the code files. Use precise, unique strings for reliable replacement.`;
}

// Parse Claude's response into modification objects
function parseClaudeResponse(claudeResponse) {
  console.log('🔥 DEBUG: parseClaudeResponse called with:', claudeResponse.substring(0, 200) + '...');
  
  try {
    // Claude sometimes includes explanation before/after JSON, so extract just the JSON
    console.log('🔥 DEBUG: Searching for JSON in response...');
    const jsonMatch = claudeResponse.match(/\{[\s\S]*\}/);
    
    if (!jsonMatch) {
      console.error('🔥 DEBUG: No valid JSON found in Claude response');
      console.error('🔥 DEBUG: Full response was:', claudeResponse);
      return [];
    }
    
    console.log('🔥 DEBUG: Found JSON match:', jsonMatch[0].substring(0, 200) + '...');
    
    const parsed = JSON.parse(jsonMatch[0]);
    console.log('🔥 DEBUG: Successfully parsed JSON:', JSON.stringify(parsed, null, 2));
    
    // Log element selectors if they exist
    if (parsed.modifications && Array.isArray(parsed.modifications)) {
      console.log('🔥 DEBUG: Element selectors found in modifications:');
      parsed.modifications.forEach((mod, index) => {
        console.log(`🔥 DEBUG: - Modification ${index + 1}: ${mod.elementSelector}`);
        console.log(`🔥 DEBUG: - Description: ${mod.description}`);
        console.log(`🔥 DEBUG: - CSS Properties: ${JSON.stringify(mod.cssProperties)}`);
      });
    }
    
    // Handle new format with type field or old format with modifications
    if (parsed.type) {
      console.log('🔥 DEBUG: New format detected with type:', parsed.type);
      if (parsed.type === 'styling' && parsed.modifications) {
        console.log('🔥 DEBUG: Styling modifications count:', parsed.modifications.length);
        parsed.modifications.forEach((mod, index) => {
          console.log(`🔥 DEBUG: Styling ${index + 1} - Element: ${mod.elementSelector}, Props: ${JSON.stringify(mod.cssProperties)}`);
        });
      }
      // New format - return the entire parsed object
      return parsed;
    } else if (parsed.modifications) {
      console.log('🔥 DEBUG: Old format detected with modifications array');
      console.log('🔥 DEBUG: Old format modifications count:', parsed.modifications.length);
      // Old format - return just modifications for backwards compatibility
      return parsed.modifications;
    } else {
      console.log('🔥 DEBUG: Very old format detected, returning entire parsed object');
      // Very old format - assume the parsed object is the modifications array
      return parsed;
    }
    
  } catch (error) {
    console.error('🔥 DEBUG: Error parsing Claude response:', error);
    console.error('🔥 DEBUG: Error message:', error.message);
    console.error('🔥 DEBUG: Raw response that caused error:', claudeResponse);
    return [];
  }
}

// Enhanced applyModification function
async function applyModification(modification, distributorId, originalPrompt = null) {
  console.log('🔥 DEBUG: applyModification called with:');
  console.log('🔥 DEBUG: - distributorId:', distributorId);
  console.log('🔥 DEBUG: - element_selector:', modification.elementSelector);
  console.log('🔥 DEBUG: - cssProperties:', JSON.stringify(modification.cssProperties, null, 2));
  console.log('🔥 DEBUG: - originalPrompt:', originalPrompt);
  
  try {
    // Insert into the styles table (used by dashboard) instead of distributor_styles
    const insertQuery = `
      INSERT INTO styles (distributor_id, element_selector, styles, original_prompt, created_at, updated_at)
      VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    `;
    
    console.log('🔥 DEBUG: About to execute SQL query:', insertQuery);
    console.log('🔥 DEBUG: Query parameters:', [
      distributorId,
      modification.elementSelector,
      JSON.stringify(modification.cssProperties),
      originalPrompt
    ]);
    
    const result = db.prepare(insertQuery).run(
      distributorId,
      modification.elementSelector,
      JSON.stringify(modification.cssProperties),
      originalPrompt
    );
    
    console.log('🔥 DEBUG: SQL insert result:', result);
    console.log('🔥 DEBUG: Insert lastInsertRowid:', result.lastInsertRowid);
    console.log('🔥 DEBUG: Insert changes:', result.changes);

    console.log(`🔥 DEBUG: Successfully saved style for: ${modification.elementSelector}`);
    
    // Verify the style was actually saved
    const savedStyle = db.prepare(`
      SELECT * FROM styles WHERE distributor_id = ? AND element_selector = ? ORDER BY created_at DESC LIMIT 1
    `).get(distributorId, modification.elementSelector);
    
    console.log('🔥 DEBUG: Verification - style retrieved from database:', JSON.stringify(savedStyle, null, 2));
    
  } catch (error) {
    console.error(`🔥 DEBUG: Failed to save style for ${modification.elementSelector}:`, error);
    console.error('🔥 DEBUG: Error details:', error.message);
    console.error('🔥 DEBUG: Error stack:', error.stack);
    throw error;
  }
}

// Apply content insertion to database
async function applyContentInsertion(insertion, distributorId) {
  try {
    // Store the content insertion in the database
    db.prepare(`
      INSERT INTO dynamic_content (distributor_id, insertion_zone, content_type, content_data, display_order)
      VALUES (?, ?, ?, ?, 0)
    `).run(
      distributorId,
      insertion.insertionZone,
      insertion.contentType,
      JSON.stringify(insertion.contentData)
    );
    
    console.log(`Successfully applied content insertion: ${insertion.description}`);
  } catch (error) {
    console.error(`Error applying content insertion: ${insertion.description}`, error);
    throw error;
  }
}

// Helper function to check if directory exists (if not already defined)
async function directoryExists(dirPath) {
  try {
    const stats = await fs.promises.stat(dirPath);
    return stats.isDirectory();
  } catch {
    return false;
  }
}



app.get('/api/diagnose-logo', (req, res) => {
  try {
    // Get distributor info
    const distributorId = req.session.distributor_id;
    const distributor = distributorId 
      ? db.prepare('SELECT * FROM distributors WHERE id = ?').get(distributorId)
      : null;
    
    // Check directories
    const publicDir = path.join(__dirname, 'public');
    const uploadsDir = path.join(publicDir, 'uploads');
    const renderMountDir = '/opt/render/project/src/public/uploads';
    
    // Check database records
    const allDistributors = db.prepare('SELECT id, name, logo_path FROM distributors').all();
    
    // Prepare diagnostics result
    const result = {
      session: {
        exists: !!req.session,
        id: req.session?.id,
        distributor_id: distributorId,
        authenticated: !!distributorId
      },
      distributor: distributor ? {
        id: distributor.id,
        name: distributor.name,
        has_logo: !!distributor.logo_path,
        logo_path: distributor.logo_path,
        logo_path_type: distributor.logo_path ? (
          distributor.logo_path.startsWith('data:') ? 'data_uri' : 
          distributor.logo_path.startsWith('/') ? 'absolute_path' : 
          'relative_path'
        ) : null
      } : null,
      directories: {
        current_dir: __dirname,
        public_dir: {
          path: publicDir,
          exists: fs.promises.existsSync(publicDir),
          writable: false, // We'll set this below
          contents: []
        },
        uploads_dir: {
          path: uploadsDir,
          exists: fs.promises.existsSync(uploadsDir),
          writable: false, // We'll set this below
          contents: []
        },
        render_mount: {
          path: renderMountDir,
          exists: fs.promises.existsSync(renderMountDir),
          writable: false, // We'll set this below
          contents: []
        }
      },
      all_distributors: allDistributors
    };
    
    // Check directory permissions
    try {
      if (result.directories.public_dir.exists) {
        // Test write permission by trying to create a temporary file
        const testFile = path.join(publicDir, '.write-test-' + Date.now());
        fs.promises.writeFileSync(testFile, 'test');
        fs.promises.unlinkSync(testFile);
        result.directories.public_dir.writable = true;
        
        // Get directory contents
        result.directories.public_dir.contents = fs.promises.readdirSync(publicDir);
      }
    } catch (e) {
      result.directories.public_dir.error = e.message;
    }
    
    try {
      if (result.directories.uploads_dir.exists) {
        const testFile = path.join(uploadsDir, '.write-test-' + Date.now());
        fs.promises.writeFileSync(testFile, 'test');
        fs.promises.unlinkSync(testFile);
        result.directories.uploads_dir.writable = true;
        
        result.directories.uploads_dir.contents = fs.promises.readdirSync(uploadsDir);
      }
    } catch (e) {
      result.directories.uploads_dir.error = e.message;
    }
    
    try {
      if (result.directories.render_mount.exists) {
        const testFile = path.join(renderMountDir, '.write-test-' + Date.now());
        fs.promises.writeFileSync(testFile, 'test');
        fs.promises.unlinkSync(testFile);
        result.directories.render_mount.writable = true;
        
        result.directories.render_mount.contents = fs.promises.readdirSync(renderMountDir);
      }
    } catch (e) {
      result.directories.render_mount.error = e.message;
    }
    
    // Check if the logo file exists
    if (distributor && distributor.logo_path && !distributor.logo_path.startsWith('data:')) {
      // Try different paths
      const possiblePaths = [
        // Exactly as stored
        distributor.logo_path,
        // Treat as relative to __dirname
        path.join(__dirname, distributor.logo_path),
        // Relative to public
        path.join(publicDir, distributor.logo_path),
        // Just filename in uploads
        path.join(uploadsDir, path.basename(distributor.logo_path)),
        // In render mount path
        path.join(renderMountDir, path.basename(distributor.logo_path))
      ];
      
      result.file_checks = possiblePaths.map(p => ({
        path: p,
        exists: fs.promises.existsSync(p),
        size: fs.promises.existsSync(p) ? fs.promises.statSync(p).size : null
      }));
    }
    
    // Add environment info
    result.environment = {
      node_env: process.env.NODE_ENV || 'development',
      hostname: require('os').hostname(),
      platform: process.platform
    };
    
    // Return full diagnostics
    res.json(result);
  } catch (error) {
    console.error('Error in diagnostics:', error);
    res.status(500).json({
      error: error.message,
      stack: error.stack
    });
  }
});

// Delete logo
app.delete('/api/branding/logo', (req, res) => {
  console.log('Logo delete request');
  
  if (!req.session.distributor_id) {
    return res.status(401).json({ error: 'Not authenticated' });
  }
  
  try {
    // Get current logo path
    const distributor = db.prepare(`
      SELECT logo_path FROM distributors WHERE id = ?
    `).get(req.session.distributor_id);
    
    if (!distributor || !distributor.logo_path) {
      return res.json({ success: true });
    }
    
    // Delete the file
    const logoPath = path.join(__dirname, distributor.logo_path);
    if (fs.promises.existsSync(logoPath)) {
      fs.promises.unlinkSync(logoPath);
    }
    
    // Update distributor to clear logo path
    db.prepare(`
      UPDATE distributors 
      SET logo_path = NULL 
      WHERE id = ?
    `).run(req.session.distributor_id);
    
    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting logo:', error);
    res.status(500).json({ error: 'Error deleting logo' });
  }
});

app.get('/api/styles', (req, res) => {
  console.log('🔥 DEBUG: /api/styles GET request received');
  console.log('🔥 DEBUG: Session distributor_id:', req.session.distributor_id);
  
  if (!req.session.distributor_id) {
    console.log('🔥 DEBUG: No distributor_id in session, returning 401');
    return res.status(401).json({ error: 'Not authenticated' });
  }
  
  try {
    // Check both tables to see where styles are stored
    console.log('🔥 DEBUG: Checking distributor_styles table...');
    const distributorStyles = db.prepare(`
      SELECT element_selector, css_properties 
      FROM distributor_styles 
      WHERE distributor_id = ?
    `).all(req.session.distributor_id);
    
    console.log('🔥 DEBUG: Found', distributorStyles.length, 'styles in distributor_styles table');
    console.log('🔥 DEBUG: distributor_styles content:', JSON.stringify(distributorStyles, null, 2));
    
    console.log('🔥 DEBUG: Checking styles table...');
    const stylesTable = db.prepare(`
      SELECT element_selector, styles 
      FROM styles 
      WHERE distributor_id = ?
    `).all(req.session.distributor_id);
    
    console.log('🔥 DEBUG: Found', stylesTable.length, 'styles in styles table');
    console.log('🔥 DEBUG: styles table content:', JSON.stringify(stylesTable, null, 2));
    
    // Convert distributor_styles to a more usable format
    const styleMap = {};
    distributorStyles.forEach(style => {
      try {
        styleMap[style.element_selector] = JSON.parse(style.css_properties);
        console.log('🔥 DEBUG: Parsed style for', style.element_selector, ':', JSON.parse(style.css_properties));
      } catch (e) {
        console.error('🔥 DEBUG: Error parsing CSS properties for', style.element_selector, ':', e);
      }
    });
    
    // Also add styles from the styles table if they exist
    stylesTable.forEach(style => {
      try {
        styleMap[style.element_selector] = JSON.parse(style.styles);
        console.log('🔥 DEBUG: Added style from styles table for', style.element_selector, ':', JSON.parse(style.styles));
      } catch (e) {
        console.error('🔥 DEBUG: Error parsing styles from styles table for', style.element_selector, ':', e);
      }
    });
    
    console.log('🔥 DEBUG: Final styleMap being returned:', JSON.stringify(styleMap, null, 2));
    console.log('🔥 DEBUG: Total styles being returned:', Object.keys(styleMap).length);
    
    res.json(styleMap);
  } catch (error) {
    console.error('🔥 DEBUG: Error fetching styles:', error);
    console.error('🔥 DEBUG: Error stack:', error.stack);
    res.status(500).json({ error: 'Error fetching styles' });
  }
});

// Update or create custom styles
app.post('/api/styles', (req, res) => {
  console.log('Update styles request');
  
  if (!req.session.distributor_id || req.session.userType !== 'Admin') {
    return res.status(401).json({ error: 'Not authorized' });
  }
  
  const { elementSelector, cssProperties } = req.body;
  
  if (!elementSelector || !cssProperties) {
    return res.status(400).json({ error: 'Missing elementSelector or cssProperties' });
  }
  
  try {
    // Insert or update the style
    db.prepare(`
      INSERT OR REPLACE INTO distributor_styles (distributor_id, element_selector, css_properties, updated_at)
      VALUES (?, ?, ?, CURRENT_TIMESTAMP)
    `).run(
      req.session.distributor_id,
      elementSelector,
      JSON.stringify(cssProperties)
    );
    
    console.log(`Updated style for ${elementSelector} for distributor ${req.session.distributor_id}`);
    res.json({ success: true });
  } catch (error) {
    console.error('Error updating styles:', error);
    res.status(500).json({ error: 'Error updating styles' });
  }
});

// Delete custom styles
app.delete('/api/styles/:id', (req, res) => {
  console.log('Delete style request for ID:', req.params.id);
  
  if (!req.session.distributor_id || req.session.userType !== 'Admin') {
    return res.status(401).json({ error: 'Not authorized' });
  }
  
  const styleId = req.params.id;
  const distributorId = req.session.distributor_id;
  
  try {
    // Delete from styles table (which has id field)
    const deleteStylesResult = db.prepare(`
      DELETE FROM styles 
      WHERE id = ? AND distributor_id = ?
    `).run(styleId, distributorId);
    
    // Also try to delete from distributor_styles table if it exists (by element_selector)
    // First, get the element_selector from the styles table if it was found
    if (deleteStylesResult.changes > 0) {
      console.log(`Deleted style ID ${styleId} from styles table for distributor ${distributorId}`);
    } else {
      // If no record was found in styles table, return 404
      return res.status(404).json({ error: 'Style not found' });
    }
    
    res.json({ success: true, message: 'Style deleted successfully' });
  } catch (error) {
    console.error('Error deleting style:', error);
    res.status(500).json({ error: 'Failed to delete style' });
  }
});

// ===== NEW: DYNAMIC CONTENT INSERTION ENDPOINTS =====

// Initialize dynamic content table (run once on startup)
function initializeDynamicContentTable() {
  try {
    db.prepare(`
      CREATE TABLE IF NOT EXISTS dynamic_content (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        distributor_id INTEGER NOT NULL,
        insertion_zone TEXT NOT NULL,
        content_type TEXT NOT NULL DEFAULT 'html',
        content_data TEXT NOT NULL,
        display_order INTEGER DEFAULT 0,
        active BOOLEAN DEFAULT 1,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (distributor_id) REFERENCES distributors(id)
      )
    `).run();
    console.log('Dynamic content table initialized');
  } catch (error) {
    console.error('Error initializing dynamic content table:', error);
  }
}

// Initialize chat history tables
function initializeChatTables() {
  try {
    // Conversations table
    db.prepare(`
      CREATE TABLE IF NOT EXISTS chat_conversations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        distributor_id INTEGER NOT NULL,
        user_id INTEGER NOT NULL,
        title TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        is_archived BOOLEAN DEFAULT FALSE
      )
    `).run();

    // Messages table
    db.prepare(`
      CREATE TABLE IF NOT EXISTS chat_messages (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        conversation_id INTEGER NOT NULL,
        role TEXT NOT NULL,
        content TEXT NOT NULL,
        message_type TEXT,
        metadata TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (conversation_id) REFERENCES chat_conversations(id)
      )
    `).run();

    // Context table for tracking system changes
    db.prepare(`
      CREATE TABLE IF NOT EXISTS chat_context (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        conversation_id INTEGER NOT NULL,
        context_type TEXT NOT NULL,
        context_data TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (conversation_id) REFERENCES chat_conversations(id)
      )
    `).run();

    // Styles table for UI customizations
    db.prepare(`
      CREATE TABLE IF NOT EXISTS styles (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        distributor_id INTEGER NOT NULL,
        element_selector TEXT NOT NULL,
        styles TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(distributor_id, element_selector)
      )
    `).run();

    // Logic scripts table for business rules
    db.prepare(`
      CREATE TABLE IF NOT EXISTS logic_scripts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        distributor_id INTEGER NOT NULL,
        trigger_point TEXT NOT NULL,
        description TEXT NOT NULL,
        script_content TEXT NOT NULL,
        active BOOLEAN DEFAULT TRUE,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `).run();

    // Add original_prompt column to existing tables if not exists
    try {
      db.prepare(`ALTER TABLE styles ADD COLUMN original_prompt TEXT`).run();
      console.log('Added original_prompt column to styles table');
    } catch (error) {
      // Column might already exist, ignore error
      if (!error.message.includes('duplicate column name')) {
        console.log('Note: original_prompt column might already exist in styles table');
      }
    }

    try {
      db.prepare(`ALTER TABLE logic_scripts ADD COLUMN original_prompt TEXT`).run();
      console.log('Added original_prompt column to logic_scripts table');
    } catch (error) {
      // Column might already exist, ignore error
      if (!error.message.includes('duplicate column name')) {
        console.log('Note: original_prompt column might already exist in logic_scripts table');
      }
    }

    console.log('Chat history, styles, and logic scripts tables initialized');
  } catch (error) {
    console.error('Error initializing chat tables:', error);
  }
}

// Initialize customer card configuration table
function initializeCustomerCardConfigTable() {
  try {
    db.prepare(`
      CREATE TABLE IF NOT EXISTS customer_card_configurations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        distributor_id INTEGER NOT NULL,
        field_name TEXT NOT NULL,
        display_label TEXT NOT NULL,
        display_order INTEGER NOT NULL,
        is_visible BOOLEAN DEFAULT TRUE,
        field_type TEXT DEFAULT 'text',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (distributor_id) REFERENCES distributors(id),
        UNIQUE(distributor_id, field_name)
      )
    `).run();
    console.log('Customer card configuration table initialized');
  } catch (error) {
    console.error('Error initializing customer card configuration table:', error);
  }
}

// Initialize the tables on startup
initializeDynamicContentTable();
initializeChatTables();
initializeCustomerCardConfigTable();

// Get dynamic content for a distributor
app.get('/api/dynamic-content', (req, res) => {
  console.log('Dynamic content request');
  
  if (!req.session.distributor_id) {
    return res.status(401).json({ error: 'Not authenticated' });
  }
  
  try {
    const content = db.prepare(`
      SELECT * FROM dynamic_content 
      WHERE distributor_id = ? AND active = 1 
      ORDER BY insertion_zone, display_order
    `).all(req.session.distributor_id);
    
    // Group by insertion zone
    const contentByZone = {};
    content.forEach(item => {
      if (!contentByZone[item.insertion_zone]) {
        contentByZone[item.insertion_zone] = [];
      }
      contentByZone[item.insertion_zone].push({
        id: item.id,
        type: item.content_type,
        data: JSON.parse(item.content_data),
        order: item.display_order
      });
    });
    
    res.json(contentByZone);
  } catch (error) {
    console.error('Error fetching dynamic content:', error);
    res.status(500).json({ error: 'Error fetching dynamic content' });
  }
});

// Add or update dynamic content
app.post('/api/dynamic-content', (req, res) => {
  console.log('Add dynamic content request');
  
  if (!req.session.distributor_id || req.session.userType !== 'Admin') {
    return res.status(401).json({ error: 'Not authorized' });
  }
  
  const { insertionZone, contentType, contentData, displayOrder } = req.body;
  
  if (!insertionZone || !contentType || !contentData) {
    return res.status(400).json({ error: 'Missing required fields' });
  }
  
  try {
    const result = db.prepare(`
      INSERT INTO dynamic_content (distributor_id, insertion_zone, content_type, content_data, display_order)
      VALUES (?, ?, ?, ?, ?)
    `).run(
      req.session.distributor_id,
      insertionZone,
      contentType,
      JSON.stringify(contentData),
      displayOrder || 0
    );
    
    console.log(`Added dynamic content to ${insertionZone} for distributor ${req.session.distributor_id}`);
    res.json({ success: true, id: result.lastInsertRowid });
  } catch (error) {
    console.error('Error adding dynamic content:', error);
    res.status(500).json({ error: 'Error adding dynamic content' });
  }
});

// Delete dynamic content
app.delete('/api/dynamic-content/:id', (req, res) => {
  console.log('Delete dynamic content request');
  
  if (!req.session.distributor_id || req.session.userType !== 'Admin') {
    return res.status(401).json({ error: 'Not authorized' });
  }
  
  const { id } = req.params;
  
  try {
    db.prepare(`
      DELETE FROM dynamic_content 
      WHERE id = ? AND distributor_id = ?
    `).run(id, req.session.distributor_id);
    
    console.log(`Deleted dynamic content ${id} for distributor ${req.session.distributor_id}`);
    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting dynamic content:', error);
    res.status(500).json({ error: 'Error deleting dynamic content' });
  }
});

// ===== DEBUG ENDPOINT =====
app.get('/api/debug/ai-custom-fields', (req, res) => {
  console.log('🔥 DEBUG: Debug endpoint called');
  
  if (!req.session.distributor_id) {
    return res.status(401).json({ error: 'Not authenticated' });
  }
  
  try {
    // Fetch available custom fields for context
    const orderCustomFields = db.prepare(`
      SELECT attribute_name, attribute_label, data_type, validation_rules 
      FROM custom_attributes_definitions 
      WHERE distributor_id = ? AND entity_type = 'orders'
    `).all(req.session.distributor_id);
    
    console.log('🔥 DEBUG: Found custom order fields:', orderCustomFields);
    
    res.json({
      distributor_id: req.session.distributor_id,
      custom_fields_found: orderCustomFields.length,
      custom_fields: orderCustomFields
    });
  } catch (error) {
    console.error('🔥 DEBUG: Error fetching custom fields:', error);
    res.status(500).json({ error: 'Debug failed' });
  }
});


app.use('/uploads', express.static(path.join(__dirname, 'public', 'uploads')));

// Replace your login endpoint in backend/index.js with this:

app.post('/api/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    console.log('Login attempt:', { username, passwordLength: password ? password.length : 0 });

    // Validate input
    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required.' });
    }

    // Get user from database
    const dbUser = database.getUserByUsername(username);

    if (!dbUser) {
      console.log('No user found with username:', username);
      return res.status(401).json({ error: 'Invalid username or password' });
    }

    // Password check
    if (password !== dbUser.password) {
      console.log('Password mismatch for user:', username);
      return res.status(401).json({ error: 'Invalid username or password' });
    }

    // Set session data
    req.session.user_id = dbUser.id;
    req.session.distributor_id = dbUser.distributor_id;
    req.session.distributorName = dbUser.distributor_name;
    req.session.userType = dbUser.type || 'Admin';
    req.session.accountId = dbUser.account_id;

    // Get distributor slug
    const distributorSlug = getDistributorSlug(dbUser.distributor_id);

    console.log('=== LOGIN DEBUG ===');
    console.log('dbUser.distributor_id:', dbUser.distributor_id);
    console.log('distributorSlug from getDistributorSlug:', distributorSlug);
    console.log('distributorSlug !== "default":', distributorSlug !== 'default');
    
    // Calculate redirect URL ONCE
    const redirectUrl = distributorSlug !== 'default' ? `/?dist=${distributorSlug}` : '/';
    console.log('Generated redirectUrl:', redirectUrl);
    console.log('===================');
      
    console.log('Session data set:', {
      user_id: dbUser.id,
      distributor_id: dbUser.distributor_id,
      distributorName: dbUser.distributor_name,
      userType: dbUser.type || 'Admin',
      accountId: dbUser.account_id,
      distributorSlug: distributorSlug
    });

    // Save session and respond
    req.session.save((err) => {
      if (err) {
        console.error('Session save error:', err);
        return res.status(500).json({ error: 'Error saving session' });
      }

      // Use the redirectUrl calculated above (REMOVED the duplicate calculation)
      return res.json({
        status: 'logged_in',
        user_id: dbUser.id,
        distributorName: dbUser.distributor_name,
        userType: dbUser.type || 'Admin',
        accountId: dbUser.account_id,
        distributorSlug: distributorSlug,
        redirectUrl: redirectUrl  // Use the redirectUrl from above
      });
    });
  } catch (error) {
    console.error('Login error:', error);
    return res.status(500).json({ error: 'Server error during login' });
  }
});

 


// Logout route
app.post('/api/logout', (req, res) => {
  console.log('Logout request received');
  
  req.session.destroy((err) => {
    if (err) {
      console.error('Error destroying session:', err);
    }
    
    res.clearCookie('feather.sid', {
      path: '/',
      sameSite: 'none',
      secure: true
    });
    
    console.log('Session destroyed and cookie cleared');
    res.send({ status: 'logged_out' });
  });
});

// Session check endpoint
app.get('/api/session-check', (req, res) => {
  console.log('Session check request');
  console.log('Session data:', req.session);
  
  res.json({
    sessionExists: !!req.session.distributor_id,
    distributorId: req.session.distributor_id || 'none',
    distributorName: req.session.distributorName || 'none',
    userType: req.session.userType || 'Admin',
    userId: req.session.user_id || 'none'
  });
});

app.get('/api/connected-accounts', (req, res) => {
  console.log('Connected accounts request');
  
  // Check if user is logged in
  if (!req.session.distributor_id) {
    return res.status(401).json({ error: 'Not authenticated' });
  }
  
  try {
    // Get all users with account_id for this distributor
    const connectedAccounts = db.prepare(`
      SELECT account_id FROM users 
      WHERE distributor_id = ? AND account_id IS NOT NULL
    `).all(req.session.distributor_id);
    
    res.json(connectedAccounts);
  } catch (error) {
    console.error('Error fetching connected accounts:', error);
    res.status(500).json({ error: 'Server error' });
  }
});


// Handle order submission and email generation
app.post('/api/submit-order', async (req, res) => {
  console.log('Order submission request');
  
  // Check if user is logged in
  if (!req.session.user_id) {
    return res.status(401).json({ error: 'Not authenticated' });
  }
  
  try {
    const { items, dynamicFormValues } = req.body;
    
    console.log('Order submission with dynamic form values:', dynamicFormValues);
    
    if (!items || items.length === 0) {
      return res.status(400).json({ error: 'No items in order' });
    }
    
    // Get user info for the order
    const user = db.prepare(`
      SELECT users.*, accounts.name as customer_name 
      FROM users 
      LEFT JOIN accounts ON users.account_id = accounts.id
      WHERE users.id = ?
    `).get(req.session.user_id);
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const distributorId = user.distributor_id || 1;

    // ===== NEW: FETCH ALL CUSTOM FIELDS FOR ORDER SCOPE =====
    
    // 1. Fetch custom attribute definitions for this distributor
    const accountAttrDefs = db.prepare(`
      SELECT * FROM custom_attributes_definitions 
      WHERE distributor_id = ? AND entity_type = 'accounts'
    `).all(distributorId);
    
    const productAttrDefs = db.prepare(`
      SELECT * FROM custom_attributes_definitions 
      WHERE distributor_id = ? AND entity_type = 'products'
    `).all(distributorId);
    
    const orderAttrDefs = db.prepare(`
      SELECT * FROM custom_attributes_definitions 
      WHERE distributor_id = ? AND entity_type = 'orders'
    `).all(distributorId);

    // 2. Fetch custom attribute values for the customer's account
    let accountCustomFields = {};
    if (user.account_id && accountAttrDefs.length > 0) {
      const accountCustomValues = db.prepare(`
        SELECT * FROM custom_attributes_values 
        WHERE distributor_id = ? AND entity_type = 'accounts' AND entity_id = ?
      `).all(distributorId, user.account_id);
      
      // Merge definitions with values
      accountAttrDefs.forEach(def => {
        const value = accountCustomValues.find(val => val.attribute_name === def.attribute_name);
        if (value) {
          accountCustomFields[def.attribute_name] = value.value_text || value.value_number || value.value_boolean;
        } else {
          accountCustomFields[def.attribute_name] = null; // Field exists but no value set
        }
      });
    }

    // 3. Fetch custom attribute values for each product in the order
    const enhancedItems = items.map(item => {
      let productCustomFields = {};
      if (productAttrDefs.length > 0) {
        const productCustomValues = db.prepare(`
          SELECT * FROM custom_attributes_values 
          WHERE distributor_id = ? AND entity_type = 'products' AND entity_id = ?
        `).all(distributorId, item.id);
        
        productAttrDefs.forEach(def => {
          const value = productCustomValues.find(val => val.attribute_name === def.attribute_name);
          if (value) {
            productCustomFields[def.attribute_name] = value.value_text || value.value_number || value.value_boolean;
          } else {
            productCustomFields[def.attribute_name] = null;
          }
        });
      }
      
      return {
        ...item,
        customFields: productCustomFields
      };
    });

    // 4. Enhance user object with custom fields
    const enhancedUser = {
      ...user,
      customFields: accountCustomFields
    };

    console.log('Enhanced order data with custom fields:', {
      userCustomFields: Object.keys(accountCustomFields).length,
      itemsWithCustomFields: enhancedItems.length,
      availableOrderFields: orderAttrDefs.length
    });
    
    // Generate CSV content with custom fields
    const orderDate = new Date().toISOString().split('T')[0];
    
    // Build CSV header with custom fields
    let csvHeader = 'Order Date,Customer ID,Customer Name,Customer Email,Product SKU,Product Name,Quantity,Unit Price,Total';
    
    // Add account custom field headers
    accountAttrDefs.forEach(def => {
      csvHeader += `,Account ${def.attribute_label || def.attribute_name}`;
    });
    
    // Add product custom field headers  
    productAttrDefs.forEach(def => {
      csvHeader += `,Product ${def.attribute_label || def.attribute_name}`;
    });
    
    csvHeader += '\n';
    let csvContent = csvHeader;
    
    enhancedItems.forEach(item => {
      const lineTotal = item.quantity * item.unitPrice;
      let csvLine = `${orderDate},${user.account_id || 'N/A'},${enhancedUser.customer_name || enhancedUser.username},${enhancedUser.username},${item.sku},"${item.name}",${item.quantity},${item.unitPrice.toFixed(2)},${lineTotal.toFixed(2)}`;
      
      // Add account custom field values
      accountAttrDefs.forEach(def => {
        const value = accountCustomFields[def.attribute_name] || '';
        csvLine += `,"${String(value).replace(/"/g, '""')}"`;
      });
      
      // Add product custom field values
      productAttrDefs.forEach(def => {
        const value = (item.customFields && item.customFields[def.attribute_name]) || '';
        csvLine += `,"${String(value).replace(/"/g, '""')}"`;
      });
      
      csvLine += '\n';
      csvContent += csvLine;
    });
    
    // Calculate order total
    const orderTotal = items.reduce((total, item) => {
      return total + (item.quantity * item.unitPrice);
    }, 0);
    
    // ADD VALIDATION HERE - Check business rules before processing order
    console.log('Validating order submission for distributor:', distributorId, 'total:', orderTotal);
    
    // Create enhanced cart object with dynamic form values
    const enhancedCart = { 
      items: enhancedItems,  // Now includes custom fields for each product
      total: orderTotal, 
      subtotal: orderTotal,
      ...dynamicFormValues  // Add dynamic form values directly to cart object
    };
    
    // Also add them with lowercase property names for convenience
    if (dynamicFormValues) {
      Object.entries(dynamicFormValues).forEach(([key, value]) => {
        const lowerKey = key.toLowerCase();
        enhancedCart[lowerKey] = value;
        // Also add with common naming conventions
        enhancedCart[lowerKey.replace(/\s+/g, '')] = value; // Remove spaces
        enhancedCart[lowerKey.replace(/\s+/g, '_')] = value; // Replace spaces with underscores
      });
    }
    
    console.log('Enhanced cart for validation:', enhancedCart);

    const validation = pricingEngine.executeLogicScripts('submit', distributorId, {
      customer: enhancedUser,  // Now includes custom fields
      cart: enhancedCart,
      products: enhancedItems,  // Enhanced items with custom fields
      orderCustomFieldDefinitions: orderAttrDefs  // Available order-level custom fields
    });
    
    if (!validation.allowed) {
      console.log('Order validation failed:', validation.message);
      return res.status(400).json({ 
        error: validation.message || 'Order submission not allowed' 
      });
    }
    
    console.log('Order validation passed');
    
    // Add total row
    csvContent += `${orderDate},${user.account_id || 'N/A'},${user.customer_name || user.username},${user.username},"","Order Total","","",${orderTotal.toFixed(2)}\n`;
    
    // Save the order in the database
    const orderResult = db.prepare(`
      INSERT INTO orders (user_id, account_id, order_date, total_amount, status)
      VALUES (?, ?, ?, ?, ?)
    `).run(
      req.session.user_id,
      user.account_id,
      orderDate,
      orderTotal,
      'Submitted'
    );
    
    const orderId = orderResult.lastInsertRowid;
    
    // Save order items
    const insertOrderItem = db.prepare(`
      INSERT INTO order_items (order_id, product_id, quantity, unit_price)
      VALUES (?, ?, ?, ?)
    `);
    
    enhancedItems.forEach(item => {
      insertOrderItem.run(
        orderId,
        item.id,
        item.quantity,
        item.unitPrice
      );
    });

    // ===== NEW: SAVE CUSTOM ATTRIBUTES FOR THIS ORDER =====
    
    // Save account custom attributes as order context (for reference)
    if (Object.keys(accountCustomFields).length > 0) {
      const insertCustomValue = db.prepare(`
        INSERT INTO custom_attributes_values 
        (distributor_id, entity_type, entity_id, attribute_name, value_text, value_number, value_boolean)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `);
      
      Object.entries(accountCustomFields).forEach(([attrName, value]) => {
        if (value !== null) {
          const def = accountAttrDefs.find(d => d.attribute_name === attrName);
          if (def) {
            let valueText = null, valueNumber = null, valueBoolean = null;
            
            if (def.data_type === 'number') {
              valueNumber = parseFloat(value) || null;
            } else if (def.data_type === 'boolean') {
              valueBoolean = Boolean(value);
            } else {
              valueText = String(value);
            }
            
            // Store as order context with a special entity_type
            try {
              insertCustomValue.run(
                distributorId,
                'order_account_context', // Special type to indicate this is account data saved with order
                orderId,
                `account_${attrName}`,
                valueText,
                valueNumber,
                valueBoolean
              );
            } catch (err) {
              console.error('Error saving account custom field for order:', err);
            }
          }
        }
      });
    }

    // Save product custom attributes as order context (for reference)
    enhancedItems.forEach((item, index) => {
      if (Object.keys(item.customFields || {}).length > 0) {
        const insertCustomValue = db.prepare(`
          INSERT INTO custom_attributes_values 
          (distributor_id, entity_type, entity_id, attribute_name, value_text, value_number, value_boolean)
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `);
        
        Object.entries(item.customFields).forEach(([attrName, value]) => {
          if (value !== null) {
            const def = productAttrDefs.find(d => d.attribute_name === attrName);
            if (def) {
              let valueText = null, valueNumber = null, valueBoolean = null;
              
              if (def.data_type === 'number') {
                valueNumber = parseFloat(value) || null;
              } else if (def.data_type === 'boolean') {
                valueBoolean = Boolean(value);
              } else {
                valueText = String(value);
              }
              
              // Store as order context with a special entity_type
              try {
                insertCustomValue.run(
                  distributorId,
                  'order_product_context', // Special type to indicate this is product data saved with order
                  orderId,
                  `product_${item.id}_${attrName}`,
                  valueText,
                  valueNumber,
                  valueBoolean
                );
              } catch (err) {
                console.error('Error saving product custom field for order:', err);
              }
            }
          }
        });
      }
    });

    console.log(`Order ${orderId} created with custom field context preserved`);
    
    // Create a temporary file for the CSV
    const fs = require('fs');
    const path = require('path');
    const csvFilePath = path.join(__dirname, `order_${orderId}_${orderDate}.csv`);
    
    // FIXED: Use regular fs.writeFileSync (synchronous) instead of fs.promises.writeFileSync
    fs.writeFileSync(csvFilePath, csvContent);
    
    // Send email with CSV attachment
    // Note: This requires nodemailer or similar package to be installed
    // For this example, I'll use nodemailer
    const nodemailer = require('nodemailer');
    
    // Create SMTP service account
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: 'david@mod.fyi',
        pass: process.env.GMAIL_APP_PASSWORD 
      }
    });
    
    // Send mail with defined transport object
    const info = await transporter.sendMail({
      from: '"Feather Storefront" <orders@featherstorefront.com>',
      to: "david@mod.fyi", // Hard-coded email as requested
      subject: `New Order #${orderId} - ${user.customer_name || user.username}`,
      text: `A new order has been submitted.\n\nOrder #: ${orderId}\nCustomer: ${user.customer_name || user.username}\nDate: ${orderDate}\nTotal: $${orderTotal.toFixed(2)}\n\nPlease see attached CSV for order details.`,
      html: `<h2>New Order Received</h2>
             <p><strong>Order #:</strong> ${orderId}</p>
             <p><strong>Customer:</strong> ${user.customer_name || user.username}</p>
             <p><strong>Date:</strong> ${orderDate}</p>
             <p><strong>Total:</strong> $${orderTotal.toFixed(2)}</p>
             <p>Please see attached CSV for order details.</p>`,
      attachments: [
        {
          filename: `order_${orderId}_${orderDate}.csv`,
          path: csvFilePath
        }
      ]
    });
    
    console.log('Email sent:', info.messageId);
    
    // FIXED: Use regular fs.unlinkSync (synchronous) instead of fs.promises.unlinkSync
    fs.unlinkSync(csvFilePath);
    
    // Clear the user's cart
    db.prepare(`DELETE FROM cart_items WHERE user_id = ?`).run(req.session.user_id);
    
    res.json({ 
      success: true, 
      orderId: orderId,
      message: 'Order submitted successfully'
    });
  } catch (error) {
    console.error('Error processing order:', error);
    res.status(500).json({ error: 'Error processing order' });
  }
}); 
// Connect account for ordering
app.post('/api/connect-account', (req, res) => {
  console.log('Connect account request');
  
  // Check if user is logged in and is Admin
  if (!req.session.distributor_id || req.session.userType !== 'Admin') {
    return res.status(401).json({ error: 'Not authorized' });
  }
  
  const { accountId, email } = req.body;
  
  if (!accountId || !email) {
    return res.status(400).json({ error: 'Missing required fields' });
  }
  
  try {
    // Check if user already exists with this email
    const existingUser = db.prepare(`
      SELECT * FROM users WHERE username = ?
    `).get(email);
    
    if (existingUser) {
      return res.status(400).json({ error: 'User already exists with this email' });
    }
    
    // Generate random 6-digit password
    const password = Math.floor(100000 + Math.random() * 900000).toString();
    
    // Insert new user
    db.prepare(`
      INSERT INTO users (username, password, distributor_id, distributor_name, type, account_id)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(
      email,
      password,
      req.session.distributor_id,
      req.session.distributorName,
      'Customer',
      accountId
    );
    
    console.log(`Created user for account ${accountId} with email ${email}`);
    
    // Return success with password so admin can provide it to customer
    res.json({ 
      success: true,
      password
    });
  } catch (error) {
    console.error('Error connecting account:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// User info endpoint
app.get('/api/me', (req, res) => {
  console.log('User info request');
  if (!req.session || !req.session.distributor_id) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  const distributorSlug = getDistributorSlug(req.session.distributor_id);

  res.json({
    distributorId: req.session.distributor_id,
    distributorName: req.session.distributorName || 'Storefront',
    userType: req.session.userType || 'Admin',
    accountId: req.session.accountId || null,
    userId: req.session.user_id || null,
    distributorSlug: distributorSlug  // NEW: Include distributor slug
  });
});

// Items endpoint
app.get('/api/items', (req, res) => {
  console.log('Items request');
  console.log('Session data:', req.session);
  
  const distributorId = req.session.distributor_id;
  if (!distributorId) {
    console.log('No distributor_id in session, returning empty array');
    return res.status(401).json([]);
  }
  
  console.log('Getting products for distributor:', distributorId);
  const products = database.getProductsByDistributor(distributorId);
  console.log('Found products count:', products.length);
  
  // NEW: Apply pricing engine (synchronous)
  const customer = req.session.user || {};
  console.log('🎯 Applying pricing engine to', products.length, 'products for distributor:', distributorId);
  console.log('🎯 PricingEngine object:', typeof pricingEngine, !!pricingEngine);
  
  let productsWithPricing;
  try {
    productsWithPricing = pricingEngine.applyProductsPricing(products, distributorId, customer);
    console.log('🎯 Pricing engine completed successfully');
  } catch (error) {
    console.error('🎯 ERROR in pricing engine:', error);
    console.error('🎯 Error stack:', error.stack);
    // Fallback to original products if pricing fails
    productsWithPricing = products;
  }
  
  console.log('🎯 First product before/after:');
  if (products.length > 0 && productsWithPricing.length > 0) {
    console.log('Before:', products[0].sku, products[0].unitPrice);
    console.log('After:', productsWithPricing[0].sku, productsWithPricing[0].unitPrice);
  }
  
  res.json(productsWithPricing);
});

// Debug endpoint to check pricing rules
app.get('/api/debug/pricing-rules', (req, res) => {
  if (!req.session.distributor_id) {
    return res.status(401).json({ error: 'Not authenticated' });
  }
  
  try {
    const distributorId = req.session.distributor_id;
    
    const allRules = db.prepare(`
      SELECT id, trigger_point, description, script_content, active, created_at
      FROM logic_scripts 
      WHERE distributor_id = ?
      ORDER BY created_at DESC
    `).all(distributorId);
    
    const activeRules = db.prepare(`
      SELECT id, trigger_point, description, script_content, active, created_at
      FROM logic_scripts 
      WHERE distributor_id = ? AND active = 1
      ORDER BY created_at DESC
    `).all(distributorId);
    
    console.log('🎯 Debug: Found', allRules.length, 'total rules,', activeRules.length, 'active rules for distributor:', distributorId);
    
    res.json({
      distributorId,
      totalRules: allRules.length,
      activeRules: activeRules.length,
      allRules,
      activeRules
    });
  } catch (error) {
    console.error('Error fetching pricing rules:', error);
    res.status(500).json({ error: error.message });
  }
});

// Real-time pricing calculation endpoint
app.post('/api/calculate-pricing', (req, res) => {
  console.log('🔄 Real-time pricing calculation request');
  
  if (!req.session.distributor_id) {
    return res.status(401).json({ error: 'Not authenticated' });
  }
  
  try {
    const { items } = req.body; // Array of {product_id, quantity}
    const distributorId = req.session.distributor_id;
    const customer = req.session.user || {};
    
    console.log('🔄 Calculating pricing for items:', items);
    
    // Get full product details for the items
    const productIds = items.map(item => item.product_id);
    const placeholders = productIds.map(() => '?').join(',');
    
    const products = db.prepare(`
      SELECT * FROM products 
      WHERE id IN (${placeholders}) AND distributor_id = ?
    `).all(...productIds, distributorId);
    
    // Create cart items with quantities
    const cartItems = items.map(item => {
      const product = products.find(p => p.id === item.product_id);
      if (!product) return null;
      
      return {
        ...product,
        quantity: item.quantity,
        cart_item_id: `temp_${item.product_id}` // Temporary ID for calculation
      };
    }).filter(Boolean);
    
    console.log('🔄 Built cart items for pricing:', cartItems.map(i => `${i.sku}(${i.quantity})`));
    
    // Apply cart pricing with full context
    const pricedItems = pricingEngine.applyCartPricing(cartItems, distributorId, customer);
    
    // Return pricing results
    const pricingResults = pricedItems.map(item => ({
      product_id: item.id,
      sku: item.sku,
      quantity: item.quantity,
      originalPrice: item.originalPrice || item.unitPrice,
      unitPrice: item.unitPrice,
      onSale: item.onSale,
      pricingRule: item.pricingRule,
      appliedPricingRules: item.appliedPricingRules
    }));
    
    console.log('🔄 Pricing calculation complete:', pricingResults.length, 'items');
    
    res.json({
      items: pricingResults,
      success: true
    });
    
  } catch (error) {
    console.error('🔄 Error calculating pricing:', error);
    res.status(500).json({ error: 'Failed to calculate pricing' });
  }
});

// Accounts endpoint
app.get('/api/accounts', (req, res) => {
  console.log('Accounts request');
  console.log('Session data:', req.session);
  
  const distributorId = req.session.distributor_id;
  if (!distributorId) {
    console.log('No distributor_id in session, returning empty array');
    return res.status(401).json([]);
  }
  
  console.log('Getting accounts for distributor:', distributorId);
  const accounts = database.getAccountsByDistributor(distributorId);
  console.log('Found accounts count:', accounts.length);
  
  res.json(accounts);
});

// Get all accounts with CAV data for customer list (no limit)
app.get('/api/accounts-with-cav', (req, res) => {
  console.log('Accounts with CAV request');
  
  if (!req.session.distributor_id) {
    return res.status(401).json({ error: 'Not authenticated' });
  }
  
  try {
    const distributorId = req.session.distributor_id;
    
    // Get ALL accounts data (no limit)
    const accounts = db.prepare(`
      SELECT * FROM accounts 
      WHERE distributor_id = ? 
      ORDER BY id
    `).all(distributorId);
    
    // Get all custom attribute definitions for accounts
    const attributeDefinitions = db.prepare(`
      SELECT * FROM custom_attributes_definitions 
      WHERE distributor_id = ? AND entity_type = 'accounts'
      ORDER BY display_order
    `).all(distributorId);
    
    // Get all custom attribute values for these accounts
    const accountIds = accounts.map(account => account.id);
    
    let customAttributes = [];
    if (accountIds.length > 0) {
      const placeholders = accountIds.map(() => '?').join(',');
      customAttributes = db.prepare(`
        SELECT * FROM custom_attributes_values 
        WHERE distributor_id = ? 
        AND entity_type = 'accounts' 
        AND entity_id IN (${placeholders})
      `).all(distributorId, ...accountIds);
    }
    
    console.log(`Found ${accounts.length} accounts, ${customAttributes.length} custom attributes`);
    
    res.json({
      accounts: accounts,
      customAttributes: customAttributes,
      attributeDefinitions: attributeDefinitions
    });
    
  } catch (error) {
    console.error('Error fetching accounts with CAV data:', error);
    res.status(500).json({ error: 'Failed to fetch accounts data' });
  }
});

// CUSTOMER CARD CONFIGURATION ENDPOINTS

// Get available customer fields
app.get('/api/available-customer-fields', (req, res) => {
  console.log('Available customer fields request');
  
  if (!req.session.distributor_id) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  try {
    // Get columns from accounts table to determine available fields
    const tableInfo = db.prepare("PRAGMA table_info(accounts)").all();
    
    // Field display name mappings for better labels
    const fieldLabels = {
      'name': 'Name',
      'email': 'Email', 
      'phone': 'Phone',
      'street': 'Address',
      'city': 'City',
      'state': 'State',
      'zip': 'ZIP',
      'id': 'ID',
      'payment_terms': 'Payment Terms',
      'distributor_id': 'Distributor ID'
    };
    
    // Convert table columns to field objects, excluding internal fields
    const excludeFields = ['distributor_id']; // Hide internal fields
    const standardFields = tableInfo
      .filter(col => !excludeFields.includes(col.name))
      .map(col => ({
        field_name: col.name,
        display_label: fieldLabels[col.name] || col.name.charAt(0).toUpperCase() + col.name.slice(1).replace(/_/g, ' '),
        field_type: col.type.toLowerCase().includes('int') ? 'number' : 'text',
        is_custom: false
      }));

    // Get CAV custom fields for accounts from table builder
    const cavFields = db.prepare(`
      SELECT attribute_name, attribute_label, data_type
      FROM custom_attributes_definitions 
      WHERE distributor_id = ? AND entity_type = 'accounts' AND is_active = 1
      ORDER BY display_order
    `).all(req.session.distributor_id);

    const cavFieldsFormatted = cavFields.map(field => ({
      field_name: field.attribute_name,
      display_label: field.attribute_label,
      field_type: field.data_type || 'text',
      is_custom: true
    }));

    // Get custom fields from dynamic content if any exist
    const dynamicFields = db.prepare(`
      SELECT DISTINCT JSON_EXTRACT(content_data, '$.label') as display_label,
             LOWER(REPLACE(JSON_EXTRACT(content_data, '$.label'), ' ', '')) as field_name,
             JSON_EXTRACT(content_data, '$.fieldType') as field_type
      FROM dynamic_content 
      WHERE distributor_id = ? AND content_type = 'form-field'
    `).all(req.session.distributor_id);

    const dynamicFieldsFormatted = dynamicFields.map(field => ({
      field_name: field.field_name,
      display_label: field.display_label,
      field_type: field.field_type || 'text',
      is_custom: true
    }));

    const allFields = [...standardFields, ...cavFieldsFormatted, ...dynamicFieldsFormatted];
    
    res.json(allFields);
  } catch (error) {
    console.error('Error fetching available fields:', error);
    res.status(500).json({ error: 'Failed to fetch available fields' });
  }
});

// Get current customer card configuration
app.get('/api/customer-card-config', (req, res) => {
  console.log('Customer card config request');
  
  if (!req.session.distributor_id) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  try {
    const config = db.prepare(`
      SELECT field_name, display_label, display_order, is_visible, field_type, is_custom
      FROM customer_card_configurations 
      WHERE distributor_id = ? 
      ORDER BY display_order
    `).all(req.session.distributor_id);

    // If no configuration exists, return default configuration
    if (config.length === 0) {
      const defaultConfig = [
        { field_name: 'name', display_label: 'Name', display_order: 0, is_visible: true, field_type: 'text', is_custom: false },
        { field_name: 'email', display_label: 'Email', display_order: 1, is_visible: true, field_type: 'text', is_custom: false },
        { field_name: 'phone', display_label: 'Phone', display_order: 2, is_visible: true, field_type: 'text', is_custom: false },
        { field_name: 'street', display_label: 'Address', display_order: 3, is_visible: true, field_type: 'text', is_custom: false },
        { field_name: 'city', display_label: 'City', display_order: 4, is_visible: true, field_type: 'text', is_custom: false },
        { field_name: 'state', display_label: 'State', display_order: 5, is_visible: true, field_type: 'text', is_custom: false },
        { field_name: 'zip', display_label: 'ZIP', display_order: 6, is_visible: true, field_type: 'text', is_custom: false }
      ];
      return res.json(defaultConfig);
    }

    res.json(config);
  } catch (error) {
    console.error('Error fetching customer card config:', error);
    res.status(500).json({ error: 'Failed to fetch configuration' });
  }
});

// Save customer card configuration
app.post('/api/customer-card-config', (req, res) => {
  console.log('Save customer card config request');
  console.log('Request body:', JSON.stringify(req.body, null, 2));
  console.log('Session distributor_id:', req.session.distributor_id);
  
  if (!req.session.distributor_id) {
    console.log('Authentication failed - no distributor_id');
    return res.status(401).json({ error: 'Not authenticated' });
  }

  const { configuration } = req.body;
  
  if (!configuration || !Array.isArray(configuration)) {
    console.log('Invalid configuration data:', configuration);
    return res.status(400).json({ error: 'Invalid configuration data' });
  }

  console.log(`Attempting to save ${configuration.length} field configurations`);

  try {
    // Delete existing configuration for this distributor
    const deleteResult = db.prepare(`DELETE FROM customer_card_configurations WHERE distributor_id = ?`)
      .run(req.session.distributor_id);
    console.log('Deleted existing configurations:', deleteResult.changes);

    // Add is_custom column if it doesn't exist
    try {
      db.prepare(`ALTER TABLE customer_card_configurations ADD COLUMN is_custom BOOLEAN DEFAULT FALSE`).run();
      console.log('Added is_custom column to customer_card_configurations table');
    } catch (error) {
      // Column might already exist, ignore error
      if (!error.message.includes('duplicate column name')) {
        console.log('Note: is_custom column might already exist');
      }
    }

    // Insert new configuration
    const insertStmt = db.prepare(`
      INSERT INTO customer_card_configurations 
      (distributor_id, field_name, display_label, display_order, is_visible, field_type, is_custom, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    `);

    configuration.forEach((field, index) => {
      console.log(`Inserting field ${index}:`, field);
      const result = insertStmt.run(
        req.session.distributor_id,
        field.field_name,
        field.display_label,
        field.display_order || index,
        field.is_visible !== false ? 1 : 0,  // Convert boolean to integer
        field.field_type || 'text',
        field.is_custom ? 1 : 0  // Convert boolean to integer
      );
      console.log('Insert result:', result.changes);
    });

    console.log(`Successfully saved ${configuration.length} field configurations for distributor ${req.session.distributor_id}`);
    res.json({ success: true });
  } catch (error) {
    console.error('Error saving customer card config:', error);
    console.error('Error details:', error.message);
    console.error('Error stack:', error.stack);
    res.status(500).json({ error: 'Failed to save configuration', details: error.message });
  }
});

// CART ENDPOINTS

// Get cart items for current user
app.get('/api/cart', (req, res) => {
  console.log('Cart request');
  console.log('Session data:', req.session);
  
  // Check if user is logged in
  if (!req.session.user_id) {
    console.log('No user_id in session, returning 401');
    return res.status(401).json({ error: 'Not authenticated' });
  }
  
  const distributorId = req.session.distributor_id;
  if (!distributorId) {
    console.log('No distributor_id in session');
    return res.status(401).json({ error: 'No distributor found' });
  }
  
  try {
    // Get cart items with product details (ensure they belong to this distributor)
    const cartItems = db.prepare(`
      SELECT ci.id as cart_item_id, ci.quantity, p.*
      FROM cart_items ci
      JOIN products p ON ci.product_id = p.id
      WHERE ci.user_id = ? AND p.distributor_id = ?
    `).all(req.session.user_id, distributorId);
    
    console.log(`Found ${cartItems.length} cart items for user ${req.session.user_id}`);
    
    // NEW: Apply pricing engine to cart items (synchronous)
    const customer = req.session.user || {};
    const cartItemsWithPricing = pricingEngine.applyCartPricing(cartItems, distributorId, customer);
    
    res.json(cartItemsWithPricing);
  } catch (error) {
    console.error('Error fetching cart items:', error);
    res.status(500).json({ error: 'Error fetching cart items' });
  }
});

// Get all orders for the current user
app.get('/api/orders', (req, res) => {
  console.log('Orders request');
  
  // Check if user is logged in
  if (!req.session.user_id) {
    return res.status(401).json({ error: 'Not authenticated' });
  }
  
  try {
    let query;
    const params = [];
    
    // If admin, show all orders for their distributor
    // If customer, show only their orders
    if (req.session.userType === 'Admin') {
      query = `
        SELECT o.*, a.name as customer_name 
        FROM orders o
        LEFT JOIN users u ON o.user_id = u.id
        LEFT JOIN accounts a ON o.account_id = a.id
        WHERE u.distributor_id = ?
        ORDER BY o.order_date DESC
      `;
      params.push(req.session.distributor_id);
    } else {
      query = `
        SELECT o.*, a.name as customer_name 
        FROM orders o
        LEFT JOIN accounts a ON o.account_id = a.id
        WHERE o.account_id = (SELECT account_id FROM users WHERE id = ?)
        ORDER BY o.order_date DESC
      `;
      params.push(req.session.user_id);
    }
    
    const orders = db.prepare(query).all(params);
    console.log(`Found ${orders.length} orders for ${req.session.userType} user`);
    
    res.json(orders);
  } catch (error) {
    console.error('Error fetching orders:', error);
    res.status(500).json({ error: 'Error fetching orders' });
  }
});

// Get order details (items for a specific order)
app.get('/api/orders/:orderId/items', (req, res) => {
  console.log('Order items request for order:', req.params.orderId);
  
  // Check if user is logged in
  if (!req.session.user_id) {
    return res.status(401).json({ error: 'Not authenticated' });
  }
  
  const { orderId } = req.params;
  
  try {
    // First check if the user has access to this order
    let order;
    
    if (req.session.userType === 'Admin') {
      order = db.prepare(`
        SELECT o.* FROM orders o
        JOIN users u ON o.user_id = u.id
        WHERE o.id = ? AND u.distributor_id = ?
      `).get(orderId, req.session.distributor_id);
    } else {
      order = db.prepare(`
        SELECT o.* FROM orders o
        WHERE o.id = ? AND o.account_id = (SELECT account_id FROM users WHERE id = ?)
      `).get(orderId, req.session.user_id);
    }
    
    if (!order) {
      return res.status(403).json({ error: 'Access denied to this order' });
    }
    
    // Get order items with product details
    const orderItems = db.prepare(`
      SELECT oi.*, p.name, p.sku, p.image_url, p.description
      FROM order_items oi
      JOIN products p ON oi.product_id = p.id
      WHERE oi.order_id = ?
    `).all(orderId);
    
    console.log(`Found ${orderItems.length} items for order ${orderId}`);
    res.json(orderItems);
  } catch (error) {
    console.error('Error fetching order items:', error);
    res.status(500).json({ error: 'Error fetching order items' });
  }
});

// Add item to cart
app.post('/api/cart', (req, res) => {
  console.log('Add to cart request');
  console.log('Session data:', req.session);
  
  // Check if user is logged in
  if (!req.session.user_id) {
    console.log('No user_id in session, returning 401');
    return res.status(401).json({ error: 'Not authenticated' });
  }
  
  const { product_id, quantity } = req.body;
  
  if (!product_id || !quantity || quantity < 1) {
    return res.status(400).json({ error: 'Invalid product_id or quantity' });
  }
  
  try {
    // Check if item is already in cart
    const existingItem = db.prepare(`
      SELECT * FROM cart_items 
      WHERE user_id = ? AND product_id = ?
    `).get(req.session.user_id, product_id);
    
    if (existingItem) {
      // Update quantity
      db.prepare(`
        UPDATE cart_items
        SET quantity = ?
        WHERE user_id = ? AND product_id = ?
      `).run(quantity, req.session.user_id, product_id);
      
      console.log(`Updated cart item for user ${req.session.user_id}, product ${product_id}, quantity ${quantity}`);
    } else {
      // Insert new item
      db.prepare(`
        INSERT INTO cart_items (user_id, product_id, quantity)
        VALUES (?, ?, ?)
      `).run(req.session.user_id, product_id, quantity);
      
      console.log(`Added new cart item for user ${req.session.user_id}, product ${product_id}, quantity ${quantity}`);
    }
    
    res.json({ success: true });
  } catch (error) {
    console.error('Error adding item to cart:', error);
    res.status(500).json({ error: 'Error adding item to cart' });
  }
});

// Update cart item quantity
app.put('/api/cart/:itemId', (req, res) => {
  console.log('Update cart item request');
  console.log('Session data:', req.session);
  
  // Check if user is logged in
  if (!req.session.user_id) {
    console.log('No user_id in session, returning 401');
    return res.status(401).json({ error: 'Not authenticated' });
  }
  
  const { itemId } = req.params;
  const { quantity } = req.body;
  
  if (!quantity || quantity < 1) {
    return res.status(400).json({ error: 'Invalid quantity' });
  }
  
  try {
    // Verify item belongs to user
    const item = db.prepare(`
      SELECT * FROM cart_items 
      WHERE id = ? AND user_id = ?
    `).get(itemId, req.session.user_id);
    
    if (!item) {
      return res.status(404).json({ error: 'Cart item not found' });
    }
    
    // Update quantity
    db.prepare(`
      UPDATE cart_items
      SET quantity = ?
      WHERE id = ?
    `).run(quantity, itemId);
    
    console.log(`Updated cart item ${itemId} for user ${req.session.user_id}, new quantity ${quantity}`);
    res.json({ success: true });
  } catch (error) {
    console.error('Error updating cart item:', error);
    res.status(500).json({ error: 'Error updating cart item' });
  }
});

// Remove item from cart
app.delete('/api/cart/:itemId', (req, res) => {
  console.log('Remove cart item request');
  console.log('Session data:', req.session);
  
  // Check if user is logged in
  if (!req.session.user_id) {
    console.log('No user_id in session, returning 401');
    return res.status(401).json({ error: 'Not authenticated' });
  }
  
  const { itemId } = req.params;
  
  try {
    // Verify item belongs to user
    const item = db.prepare(`
      SELECT * FROM cart_items 
      WHERE id = ? AND user_id = ?
    `).get(itemId, req.session.user_id);
    
    if (!item) {
      return res.status(404).json({ error: 'Cart item not found' });
    }
    
    // Delete item
    db.prepare(`
      DELETE FROM cart_items
      WHERE id = ?
    `).run(itemId);
    
    console.log(`Removed cart item ${itemId} for user ${req.session.user_id}`);
    res.json({ success: true });
  } catch (error) {
    console.error('Error removing cart item:', error);
    res.status(500).json({ error: 'Error removing cart item' });
  }
});

// Clear entire cart
app.delete('/api/cart', (req, res) => {
  console.log('Clear cart request');
  console.log('Session data:', req.session);
  
  // Check if user is logged in
  if (!req.session.user_id) {
    console.log('No user_id in session, returning 401');
    return res.status(401).json({ error: 'Not authenticated' });
  }
  
  try {
    // Delete all cart items for user
    db.prepare(`
      DELETE FROM cart_items
      WHERE user_id = ?
    `).run(req.session.user_id);
    
    console.log(`Cleared cart for user ${req.session.user_id}`);
    res.json({ success: true });
  } catch (error) {
    console.error('Error clearing cart:', error);
    res.status(500).json({ error: 'Error clearing cart' });
  }
});

// ===== FTP/SFTP INTEGRATION ENDPOINTS =====

// Get Render's outbound IP address
app.get('/api/ftp/render-ip', async (req, res) => {
  if (!req.session.distributor_id || req.session.userType !== 'Admin') {
    return res.status(401).json({ error: 'Not authorized' });
  }

  try {
    console.log('🌐 Getting Render outbound IP...');
    
    // Get external IP by calling a public service
    const response = await fetch('https://api.ipify.org?format=json');
    const data = await response.json();
    
    console.log('🌐 Render outbound IP:', data.ip);
    
    res.json({
      success: true,
      renderIP: data.ip,
      message: `Render is connecting from IP: ${data.ip}`,
      instructions: [
        `Add this IP to your SFTP server's firewall whitelist: ${data.ip}`,
        'Allow inbound connections on port 22 from this IP',
        'If using cloud hosting, add this to your security group rules',
        'Contact your hosting provider if you need help with firewall configuration'
      ]
    });
  } catch (error) {
    console.log('🌐 Failed to get IP:', error.message);
    res.status(500).json({ 
      error: 'Failed to determine Render IP address',
      fallbackInstructions: [
        'Contact your SFTP server hosting provider',
        'Ask them to whitelist Render.com IP ranges',
        'Render typically uses IP ranges in: 216.24.57.0/24'
      ]
    });
  }
});

// Simple network test endpoint
app.post('/api/ftp/test-connection', async (req, res) => {
  if (!req.session.distributor_id || req.session.userType !== 'Admin') {
    return res.status(401).json({ error: 'Not authorized' });
  }

  const { host, port, protocol } = req.body;
  
  try {
    console.log(`🧪 NETWORK TEST: Testing connectivity to ${host}:${port}`);
    
    const testPort = parseInt(port) || (protocol === 'sftp' ? 22 : 21);
    await testTCPConnection(host, testPort);
    
    res.json({ 
      success: true, 
      message: `TCP connection to ${host}:${testPort} successful`,
      environment: {
        nodeVersion: process.version,
        platform: process.platform,
        arch: process.arch,
        env: process.env.NODE_ENV
      }
    });
  } catch (error) {
    console.log('🧪 NETWORK TEST: Failed -', error.message);
    res.status(500).json({ 
      error: `Network test failed: ${error.message}`,
      environment: {
        nodeVersion: process.version,
        platform: process.platform,
        arch: process.arch,
        env: process.env.NODE_ENV
      }
    });
  }
});

// Test basic TCP connectivity first
function testTCPConnection(host, port) {
  return new Promise((resolve, reject) => {
    console.log(`🌐 TCP: Testing basic connectivity to ${host}:${port}...`);
    
    const socket = new net.Socket();
    const timeout = 10000;
    
    socket.setTimeout(timeout);
    
    socket.on('connect', () => {
      console.log('🌐 TCP: Connection successful!');
      socket.destroy();
      resolve(true);
    });
    
    socket.on('timeout', () => {
      console.log('🌐 TCP: Connection timed out');
      socket.destroy();
      reject(new Error('TCP connection timeout'));
    });
    
    socket.on('error', (err) => {
      console.log('🌐 TCP: Connection error:', err.message);
      socket.destroy();
      reject(err);
    });
    
    socket.connect(port, host);
  });
}

// Direct SSH2 connection function as last resort
function connectDirectSSH2(host, port, username, password, directory) {
  return new Promise((resolve, reject) => {
    const conn = new SSH2Client();
    
    console.log('🔒 SSH2: Creating direct connection...');
    
    conn.on('ready', () => {
      console.log('🔒 SSH2: Connection ready, requesting SFTP...');
      
      conn.sftp((err, sftp) => {
        if (err) {
          console.log('🔒 SSH2: SFTP request failed:', err.message);
          reject(err);
          return;
        }
        
        console.log('🔒 SSH2: SFTP ready, listing directory...');
        
        sftp.readdir(directory, (readErr, list) => {
          if (readErr) {
            console.log('🔒 SSH2: Directory listing failed:', readErr.message);
            reject(readErr);
            return;
          }
          
          const files = list.map(item => ({
            name: item.filename,
            type: item.attrs.isDirectory() ? 'directory' : 'file',
            size: item.attrs.size,
            date: new Date(item.attrs.mtime * 1000).toISOString()
          }));
          
          console.log('🔒 SSH2: Directory listing successful:', files.length, 'items');
          conn.end();
          resolve(files);
        });
      });
    });
    
    conn.on('error', (err) => {
      console.log('🔒 SSH2: Connection error:', err.message);
      reject(err);
    });
    
    conn.on('close', () => {
      console.log('🔒 SSH2: Connection closed');
    });
    
    console.log('🔒 SSH2: Connecting with minimal config...');
    conn.connect({
      host: host,
      port: port,
      username: username,
      password: password,
      readyTimeout: 20000,
      algorithms: {
        kex: ['diffie-hellman-group1-sha1', 'diffie-hellman-group14-sha1'],
        serverHostKey: ['ssh-rsa', 'ssh-dss'],
        cipher: ['aes128-cbc', '3des-cbc'],
        hmac: ['hmac-sha1', 'hmac-md5']
      },
      debug: (info) => {
        console.log('🔒 SSH2 DEBUG:', info);
      }
    });
  });
}

// Test FTP connection and list files
app.post('/api/ftp/connect', async (req, res) => {
  if (!req.session.distributor_id || req.session.userType !== 'Admin') {
    return res.status(401).json({ error: 'Not authorized' });
  }

  const { host, port, username, password, protocol, directory } = req.body;
  
  if (!host || !username || !password) {
    return res.status(400).json({ error: 'Host, username, and password are required' });
  }

  console.log(`🔄 Starting ${protocol.toUpperCase()} connection to ${host}:${port} as ${username}`);

  try {
    // First test basic TCP connectivity
    console.log('🌐 Step 1: Testing basic network connectivity...');
    await testTCPConnection(host, parseInt(port) || (protocol === 'sftp' ? 22 : 21));
    console.log('🌐 TCP test passed, proceeding with protocol connection...');
    
    let files = [];

    if (protocol === 'sftp') {
      // SFTP Connection
      const sftp = new SftpClient();
      
      console.log('🔒 SFTP: Creating new client instance');
      console.log('🔒 SFTP: Host:', host);
      console.log('🔒 SFTP: Port:', parseInt(port) || 22);
      console.log('🔒 SFTP: Username:', username);
      console.log('🔒 SFTP: Password length:', password ? password.length : 0);
      console.log('🔒 SFTP: Directory:', directory || '/');
      
      // Add event listeners for debugging
      sftp.client.on('ready', () => {
        console.log('🔒 SFTP EVENT: Client ready');
      });
      
      sftp.client.on('connect', () => {
        console.log('🔒 SFTP EVENT: Client connect');
      });
      
      sftp.client.on('handshake', (info) => {
        console.log('🔒 SFTP EVENT: Handshake completed:', JSON.stringify(info, null, 2));
      });
      
      sftp.client.on('banner', (message) => {
        console.log('🔒 SFTP EVENT: Server banner:', message);
      });
      
      sftp.client.on('error', (err) => {
        console.log('🔒 SFTP EVENT: Client error -', err.message);
        console.log('🔒 SFTP EVENT: Error code -', err.code);
        console.log('🔒 SFTP EVENT: Error level -', err.level);
      });
      
      sftp.client.on('close', () => {
        console.log('🔒 SFTP EVENT: Client closed');
      });
      
      sftp.client.on('keyboard-interactive', (name, instructions, instructionsLang, prompts, finish) => {
        console.log('🔒 SFTP EVENT: Keyboard interactive auth requested');
        console.log('🔒 SFTP EVENT: Name:', name);
        console.log('🔒 SFTP EVENT: Instructions:', instructions);
        console.log('🔒 SFTP EVENT: Prompts:', prompts);
      });
      
      console.log('🔒 SFTP: Attempting connection...');
      
      const connectionConfig = {
        host: host,
        port: parseInt(port) || 22,
        username: username,
        password: password,
        readyTimeout: 15000,
        connTimeout: 15000,
        tryKeyboard: true,
        keepaliveInterval: 5000,
        keepaliveCountMax: 3,
        debug: (info) => {
          console.log('🔒 SFTP DEBUG:', info);
        },
        algorithms: {
          kex: [
            'diffie-hellman-group14-sha1',
            'diffie-hellman-group14-sha256',
            'diffie-hellman-group1-sha1',
            'ecdh-sha2-nistp256',
            'ecdh-sha2-nistp384',
            'ecdh-sha2-nistp521'
          ],
          serverHostKey: ['ssh-rsa', 'ssh-dss'],
          cipher: [
            'aes128-ctr',
            'aes128-cbc',
            'aes192-ctr',
            'aes192-cbc',
            'aes256-ctr',
            'aes256-cbc',
            '3des-cbc'
          ],
          hmac: ['hmac-sha1', 'hmac-sha2-256', 'hmac-sha2-512', 'hmac-md5']
        }
      };
      
      console.log('🔒 SFTP: Connection config (without password):', {
        ...connectionConfig,
        password: '[HIDDEN]'
      });
      
      try {
        await sftp.connect(connectionConfig);
        console.log('🔒 SFTP: Connection established successfully!');
      } catch (primaryError) {
        console.log('🔒 SFTP: Primary connection failed, trying fallback config...');
        console.log('🔒 SFTP: Primary error:', primaryError.message);
        
        // Try a simpler connection with very basic settings
        const fallbackConfig = {
          host: host,
          port: parseInt(port) || 22,
          username: username,
          password: password,
          readyTimeout: 10000,
          connTimeout: 10000,
          forceIPv4: true,
          debug: (info) => {
            console.log('🔒 SFTP FALLBACK DEBUG:', info);
          },
          algorithms: {
            kex: ['diffie-hellman-group1-sha1'],
            serverHostKey: ['ssh-rsa'],
            cipher: ['aes128-cbc'],
            hmac: ['hmac-sha1']
          }
        };
        
        console.log('🔒 SFTP: Trying fallback connection...');
        try {
          await sftp.connect(fallbackConfig);
          console.log('🔒 SFTP: Fallback connection successful!');
        } catch (fallbackError) {
          console.log('🔒 SFTP: Fallback failed, trying direct SSH2 approach...');
          console.log('🔒 SFTP: Fallback error:', fallbackError.message);
          
          // Last resort: direct SSH2 connection
          const directFiles = await connectDirectSSH2(host, parseInt(port) || 22, username, password, directory || '/');
          files = directFiles;
          console.log('🔒 SFTP: Direct SSH2 connection successful!');
        }
      }
      
      // Only list files if we haven't already got them from direct SSH2
      if (files.length === 0) {
        const listing = await sftp.list(directory || '/');
        console.log(`SFTP listing for ${directory || '/'}: ${listing.length} items`);
        
        files = listing.map(item => ({
          name: item.name,
          type: item.type === 'd' ? 'directory' : 'file',
          size: item.size,
          date: new Date(item.modifyTime).toISOString()
        }));

        await sftp.end();
      }
      
    } else {
      // FTP Connection
      const client = new ftp.Client();
      client.ftp.verbose = true;
      
      await client.access({
        host: host,
        port: parseInt(port) || 21,
        user: username,
        password: password,
        secure: false
      });

      console.log('FTP connected successfully');
      
      const listing = await client.list(directory || '/');
      console.log(`FTP listing for ${directory || '/'}: ${listing.length} items`);
      
      files = listing.map(item => ({
        name: item.name,
        type: item.type === 2 ? 'directory' : 'file', // 2 = directory, 1 = file
        size: item.size,
        date: item.date ? item.date.toISOString() : new Date().toISOString()
      }));

      client.close();
    }

    console.log(`Successfully retrieved ${files.length} files/directories`);
    
    res.json({ 
      success: true, 
      message: 'Connected successfully',
      files: files
    });
    
  } catch (error) {
    console.error('FTP/SFTP connection error:', error);
    console.error('Error details:', {
      message: error.message,
      code: error.code,
      stack: error.stack
    });
    
    let errorMessage = 'Failed to connect to FTP/SFTP server.';
    
    if (error.code === 'ENOTFOUND') {
      errorMessage = 'Host not found. Please check the hostname.';
    } else if (error.code === 'ECONNREFUSED') {
      errorMessage = 'Connection refused. Please check the port and host.';
    } else if (error.code === 'ECONNRESET') {
      errorMessage = 'Connection reset. Please check your credentials.';
    } else if (error.code === 'ETIMEDOUT') {
      errorMessage = 'Connection timed out. The server may be busy or unreachable.';
    } else if (error.message && error.message.includes('handshake')) {
      errorMessage = 'SFTP handshake failed. Try using FTP instead or check server SSH configuration.';
    } else if (error.message && error.message.includes('Authentication')) {
      errorMessage = 'Authentication failed. Please check your username and password.';
    } else if (error.message && error.message.includes('timeout')) {
      errorMessage = 'Connection timeout. Server may be slow or blocking connections.';
    } else if (error.message && error.message.includes('algorithms')) {
      errorMessage = 'SSH algorithm mismatch. Server may have strict security settings.';
    } else if (error.message) {
      errorMessage = `Connection failed: ${error.message}`;
    }
    
    res.status(500).json({ error: errorMessage });
  }
});

// Refresh file listing
app.post('/api/ftp/list', async (req, res) => {
  if (!req.session.distributor_id || req.session.userType !== 'Admin') {
    return res.status(401).json({ error: 'Not authorized' });
  }

  const { host, port, username, password, protocol, directory } = req.body;
  
  console.log(`Refreshing file list for ${protocol.toUpperCase()} ${host}:${port}`);
  
  try {
    let files = [];

    if (protocol === 'sftp') {
      // SFTP Connection
      const sftp = new SftpClient();
      
      console.log('Attempting SFTP connection with config:', {
        host: host,
        port: parseInt(port) || 22,
        username: username
      });
      
      await sftp.connect({
        host: host,
        port: parseInt(port) || 22,
        username: username,
        password: password,
        readyTimeout: 20000,
        connTimeout: 20000,
        tryKeyboard: true,
        algorithms: {
          kex: [
            'ecdh-sha2-nistp256',
            'ecdh-sha2-nistp384', 
            'ecdh-sha2-nistp521',
            'diffie-hellman-group14-sha256',
            'diffie-hellman-group14-sha1',
            'diffie-hellman-group-exchange-sha256'
          ],
          serverHostKey: ['ssh-rsa', 'rsa-sha2-512', 'rsa-sha2-256', 'ssh-ed25519'],
          cipher: [
            'aes128-ctr',
            'aes192-ctr', 
            'aes256-ctr',
            'aes128-gcm',
            'aes256-gcm',
            'aes128-cbc',
            'aes192-cbc',
            'aes256-cbc'
          ],
          hmac: ['hmac-sha2-256', 'hmac-sha2-512', 'hmac-sha1']
        }
      });

      const listing = await sftp.list(directory || '/');
      
      files = listing.map(item => ({
        name: item.name,
        type: item.type === 'd' ? 'directory' : 'file',
        size: item.size,
        date: new Date(item.modifyTime).toISOString()
      }));

      await sftp.end();
      
    } else {
      // FTP Connection
      const client = new ftp.Client();
      
      await client.access({
        host: host,
        port: parseInt(port) || 21,
        user: username,
        password: password,
        secure: false
      });

      const listing = await client.list(directory || '/');
      
      files = listing.map(item => ({
        name: item.name,
        type: item.type === 2 ? 'directory' : 'file',
        size: item.size,
        date: item.date ? item.date.toISOString() : new Date().toISOString()
      }));

      client.close();
    }

    console.log(`Refreshed listing: ${files.length} items`);
    
    res.json({ 
      success: true,
      files: files 
    });
    
  } catch (error) {
    console.error('FTP/SFTP refresh error:', error);
    
    let errorMessage = 'Failed to refresh file list.';
    
    if (error.code === 'ENOTFOUND') {
      errorMessage = 'Host not found. Please check the hostname.';
    } else if (error.code === 'ECONNREFUSED') {
      errorMessage = 'Connection refused. Please check the port and host.';
    } else if (error.message && error.message.includes('Authentication')) {
      errorMessage = 'Authentication failed. Please check your credentials.';
    } else if (error.message) {
      errorMessage = `Refresh failed: ${error.message}`;
    }
    
    res.status(500).json({ error: errorMessage });
  }
});

// ===== AI PRICING & PROMO ENGINE ENDPOINTS =====

// Get pricing context data for AI
app.get('/api/pricing-context', (req, res) => {
  console.log('🎯 Pricing context request');
  
  if (!req.session.distributor_id) {
    return res.status(401).json({ error: 'Not authenticated' });
  }
  
  try {
    const distributorId = req.session.distributor_id;
    
    // Get customer attributes
    const customerAttributes = db.prepare(`
      SELECT * FROM custom_attributes_definitions 
      WHERE distributor_id = ? AND entity_type = 'accounts'
    `).all(distributorId);
    
    // Get product attributes
    const productAttributes = db.prepare(`
      SELECT * FROM custom_attributes_definitions 
      WHERE distributor_id = ? AND entity_type = 'products'
    `).all(distributorId);
    
    // Get custom tables
    const customTables = db.prepare(`
      SELECT * FROM custom_tables 
      WHERE distributor_id = ?
    `).all(distributorId);
    
    // Get order history sample (last 100 orders)
    const orderHistory = db.prepare(`
      SELECT orders.*, accounts.name as customer_name
      FROM orders 
      LEFT JOIN accounts ON orders.account_id = accounts.id
      WHERE orders.distributor_id = ?
      ORDER BY orders.created_at DESC
      LIMIT 100
    `).all(distributorId);
    
    const contextData = {
      customerAttributes,
      productAttributes,
      customTables,
      orderHistory
    };
    
    console.log('🎯 Pricing context data:', {
      customerAttributes: customerAttributes.length,
      productAttributes: productAttributes.length,
      customTables: customTables.length,
      orderHistory: orderHistory.length
    });
    
    res.json(contextData);
  } catch (error) {
    console.error('🎯 Error fetching pricing context:', error);
    res.status(500).json({ error: 'Failed to fetch pricing context' });
  }
});

// Get existing pricing rules
app.get('/api/pricing-rules', (req, res) => {
  console.log('🎯 Pricing rules request');
  
  if (!req.session.distributor_id) {
    return res.status(401).json({ error: 'Not authenticated' });
  }
  
  try {
    const distributorId = req.session.distributor_id;
    
    // Get pricing-related logic scripts
    const pricingRules = db.prepare(`
      SELECT * FROM logic_scripts 
      WHERE distributor_id = ? AND (
        description LIKE '%price%' OR 
        description LIKE '%discount%' OR 
        description LIKE '%promo%' OR
        script_content LIKE '%price%' OR
        script_content LIKE '%discount%'
      )
      ORDER BY created_at DESC
    `).all(distributorId);
    
    // Get price history (if we implement price tracking)
    // For now, return empty array
    const priceHistory = [];
    
    console.log('🎯 Found pricing rules:', pricingRules.length);
    
    res.json({
      rules: pricingRules,
      history: priceHistory
    });
  } catch (error) {
    console.error('🎯 Error fetching pricing rules:', error);
    res.status(500).json({ error: 'Failed to fetch pricing rules' });
  }
});

// AI Pricing Engine - Process pricing requests
app.post('/api/ai-pricing', async (req, res) => {
  console.log('🎯 AI Pricing request received');
  
  if (!req.session.distributor_id) {
    return res.status(401).json({ error: 'Not authenticated' });
  }
  
  try {
    const { message, contextData } = req.body;
    const distributorId = req.session.distributor_id;
    
    console.log('🎯 Processing pricing request:', message);
    
    // Build comprehensive context for pricing AI
    const pricingContext = {
      distributor_id: distributorId,
      customer_attributes: contextData.customerAttributes || [],
      product_attributes: contextData.productAttributes || [],
      custom_tables: contextData.customTables || [],
      order_history: contextData.orderHistory || [],
      current_session: {
        user_id: req.session.user_id,
        account_id: req.session.accountId,
        distributor_id: distributorId
      }
    };
    
    // Generate pricing logic using AI
    const pricingResponse = await generatePricingLogic(message, pricingContext);
    
    console.log('🎯 AI Pricing response:', pricingResponse);
    
    res.json({
      response: pricingResponse.response,
      rules: pricingResponse.rules || [],
      changes: pricingResponse.changes || []
    });
    
  } catch (error) {
    console.error('🎯 Error processing pricing request:', error);
    res.status(500).json({ 
      error: 'Failed to process pricing request',
      response: "I encountered an error while processing your pricing request. Please try again."
    });
  }
});

// Delete pricing rule
app.delete('/api/pricing-rules/:id', (req, res) => {
  console.log('🎯 Delete pricing rule request:', req.params.id);
  
  if (!req.session.distributor_id) {
    return res.status(401).json({ error: 'Not authenticated' });
  }
  
  try {
    const ruleId = req.params.id;
    const distributorId = req.session.distributor_id;
    
    const result = db.prepare(`
      DELETE FROM logic_scripts 
      WHERE id = ? AND distributor_id = ?
    `).run(ruleId, distributorId);
    
    if (result.changes > 0) {
      console.log('🎯 Pricing rule deleted successfully');
      res.json({ success: true });
    } else {
      res.status(404).json({ error: 'Pricing rule not found' });
    }
  } catch (error) {
    console.error('🎯 Error deleting pricing rule:', error);
    res.status(500).json({ error: 'Failed to delete pricing rule' });
  }
});

// AI Pricing Logic Generation Function
async function generatePricingLogic(userRequest, pricingContext) {
  console.log('🎯 Generating pricing logic for:', userRequest);
  
  // Build comprehensive system prompt for pricing AI
  const systemPrompt = `You are an expert pricing engine AI. Generate complete JavaScript pricing logic based on user requests.

AVAILABLE CONTEXT:
- Customer Attributes: ${JSON.stringify(pricingContext.customer_attributes, null, 2)}
- Product Attributes: ${JSON.stringify(pricingContext.product_attributes, null, 2)}
- Custom Tables: ${JSON.stringify(pricingContext.custom_tables, null, 2)}
- Current Session: ${JSON.stringify(pricingContext.current_session, null, 2)}

JAVASCRIPT EXECUTION CONTEXT:
Your generated code will have access to these variables:
- customer: Current customer object with attributes
- product: Current product being priced (has: sku, name, category, brand, unitPrice, quantity, etc.)
- cart: Current cart object with:
  * cart.items: Array of all cart items [{sku, name, quantity, unitPrice, category, brand}, ...]
  * cart.totalQuantity: Total quantity of all items in cart
  * cart.totalItems: Number of different items in cart
  * cart.subtotal: Total value of cart before discounts
- customTables: Access to custom table data  
- orderHistory: Customer's order history

QUANTITY-BASED PRICING EXAMPLES:
- Volume discount: if (cart.totalQuantity >= 10) { /* apply discount */ }
- Single SKU volume: if (product.quantity >= 5) { /* apply discount */ }
- Multi-SKU volume: let oilCount = cart.items.filter(i => i.sku.includes('OIL')).reduce((sum, i) => sum + i.quantity, 0); if (oilCount >= 10) { /* discount */ }

CRITICAL INSTRUCTIONS:
1. Generate COMPLETE JavaScript code that directly modifies pricing
2. Your code must check if the product matches the criteria (SKU, category, customer type, etc.)
3. If it matches, return a modified product object with the new unitPrice
4. If it doesn't match, return the original product unchanged
5. Handle ALL natural language requests - you understand intent, not just keywords

JAVASCRIPT TEMPLATE STRUCTURE (EXECUTABLE CODE - NOT FUNCTION DECLARATION):
// Check if this product matches the criteria for this pricing rule
if (/* your matching logic here */) {
  // Apply the price modification
  return {
    ...product,
    unitPrice: /* your new price calculation */,
    originalPrice: product.unitPrice,
    pricingRule: 'Your rule description',
    onSale: true // if applicable
  };
}
// Return unchanged if doesn't match
return product;

CRITICAL: Generate EXECUTABLE CODE that returns a result immediately, NOT a function declaration.

RESPONSE FORMAT - YOU MUST RETURN VALID JSON ONLY:
{
  "response": "Human-readable explanation of what the pricing rule does",
  "rules": [
    {
      "description": "Clear description of the pricing rule",
      "trigger_point": "storefront_load",
      "script_content": "Complete JavaScript code following the template above",
      "active": true
    }
  ]
}

CRITICAL REQUIREMENTS:
- Return ONLY valid JSON - no extra text before or after
- Your JavaScript must be complete and executable
- Always use "trigger_point": "storefront_load" 
- No regex parsing will be done - your code IS the pricing logic`;

  try {
    console.log('🎯 Calling Claude API for pricing logic generation...');
    
    // Call Claude API using the same pattern as ai-customize endpoint
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-3-5-haiku-20241022',
        max_tokens: 2000,
        messages: [{
          role: 'user',
          content: `${systemPrompt}\n\nUser request: ${userRequest}`
        }]
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      
      // Check for 529 overload error
      if (response.status === 529 || errorText.includes('overloaded_error')) {
        console.log('🎯 Claude API overloaded, returning fallback response');
        return {
          response: "Claude API is currently overloaded. Please try again in a moment.",
          rules: []
        };
      }
      
      throw new Error(`Claude API error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    const claudeResponse = data.content[0].text;
    
    console.log('🎯 Raw Claude response:', claudeResponse);
    console.log('🎯 Claude response length:', claudeResponse.length);
    console.log('🎯 Claude response first 500 chars:', claudeResponse.substring(0, 500));
    
    // Parse Claude's JSON response
    let pricingData;
    try {
      // Extract JSON from Claude's response (it might have extra text)
      const jsonMatch = claudeResponse.match(/\{[\s\S]*\}/);
      console.log('🎯 JSON match found:', !!jsonMatch);
      if (jsonMatch) {
        console.log('🎯 Extracted JSON:', jsonMatch[0].substring(0, 200) + '...');
        pricingData = JSON.parse(jsonMatch[0]);
        console.log('🎯 Successfully parsed pricing data:', pricingData);
      } else {
        throw new Error('No JSON found in Claude response');
      }
    } catch (parseError) {
      console.error('🎯 Error parsing Claude response:', parseError);
      console.error('🎯 Raw Claude response was:', claudeResponse);
      
      // Return a fallback with valid JavaScript that does nothing
      pricingData = {
        response: `I encountered an error parsing the pricing rule response. Please try creating the rule again with a simpler request.`,
        rules: [{
          description: `Failed parsing: ${userRequest}`,
          trigger_point: 'storefront_load',
          script_content: `// Error parsing Claude response for: ${userRequest}\n// Please recreate this rule\nreturn product; // Return unchanged`,
          active: false // Don't activate broken rules
        }]
      };
    }
    
    // Save the rules to the database
    const distributorId = pricingContext.distributor_id;
    const savedRules = [];
    
    if (pricingData.rules && pricingData.rules.length > 0) {
      for (const rule of pricingData.rules) {
        const result = db.prepare(`
          INSERT INTO logic_scripts (distributor_id, trigger_point, description, script_content, active, original_prompt)
          VALUES (?, ?, ?, ?, ?, ?)
        `).run(
          distributorId,
          rule.trigger_point || 'storefront_load',
          rule.description,
          rule.script_content,
          rule.active ? 1 : 0,
          userRequest
        );
        
        console.log('🎯 Pricing rule saved with ID:', result.lastInsertRowid);
        savedRules.push({
          ...rule,
          id: result.lastInsertRowid
        });
      }
      
      // Clear pricing engine cache since we added new rules
      pricingEngine.clearCache();
    }
    
    return {
      response: pricingData.response,
      rules: savedRules
    };
    
  } catch (error) {
    console.error('🎯 Error generating pricing logic:', error);
    
    // Return fallback response instead of throwing error
    return {
      response: `I encountered an error while generating the pricing rule. Error: ${error.message}. Please try rephrasing your request.`,
      rules: []
    };
  }
}

// Serve the frontend in production
// Add this near the bottom of your index.js file, before app.listen()
if (process.env.NODE_ENV === 'production') {
  console.log('Setting up production static file serving...');
  
  // Path to your built frontend files (relative to backend/index.js)
  const frontendBuildPath = path.join(__dirname, '..', 'dist');
  console.log('Frontend build path:', frontendBuildPath);
  
  // Check if the directory exists
 if (!fs.existsSync(frontendBuildPath)) {
    console.error('Warning: Frontend build directory does not exist:', frontendBuildPath);
    console.error('Make sure npm run build was executed successfully');
  } else {
    console.log('Frontend build directory exists');
  }
  
  // Serve static files
  app.use(express.static(frontendBuildPath));
  
  // For any non-API route, serve the index.html file
  app.get('*', (req, res) => {
    if (!req.path.startsWith('/api')) {
      console.log('Serving index.html for path:', req.path);
      res.sendFile(path.join(frontendBuildPath, 'index.html'));
    } else {
      // If it's an API endpoint that wasn't matched, return 404
      console.log('API endpoint not found:', req.path);
      res.status(404).json({ error: 'API endpoint not found' });
    }
  });
}





// Start the server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`API endpoints available at http://localhost:${PORT}`);
});
