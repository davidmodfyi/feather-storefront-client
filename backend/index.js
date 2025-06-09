const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const database = require('./database');
const session = require('express-session');
const MemoryStore = require('memorystore')(session);
const multer = require('multer');
const Anthropic = require('@anthropic-ai/sdk');
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
    
    if (!fs.promises.existsSync(absolutePath)) {
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

app.get('/api/debug/logo-paths', (req, res) => {
  if (!req.session.distributor_id) {
    return res.status(401).json({ error: 'Not authenticated' });
  }
  
  try {
    const distributor = db.prepare(`
      SELECT logo_path FROM distributors WHERE id = ?
    `).get(req.session.distributor_id);
    
    const diagnostics = {
      logo_path_in_db: distributor?.logo_path,
      public_dir: path.join(__dirname, 'public'),
      public_dir_exists: fs.promises.existsSync(path.join(__dirname, 'public')),
      uploads_dir: path.join(__dirname, 'public', 'uploads'),
      uploads_dir_exists: fs.promises.existsSync(path.join(__dirname, 'public', 'uploads')),
      working_directory: process.cwd(),
      __dirname: __dirname
    };
    
    if (distributor?.logo_path) {
      const relativePath = distributor.logo_path.startsWith('/') 
        ? distributor.logo_path.substring(1) 
        : distributor.logo_path;
      
      const absolutePath = path.join(__dirname, 'public', relativePath);
      diagnostics.absolute_logo_path = absolutePath;
      diagnostics.logo_file_exists = fs.promises.existsSync(absolutePath);
      
      if (diagnostics.logo_file_exists) {
        diagnostics.logo_file_stats = fs.promises.statSync(absolutePath);
      }
    }
    
    res.json(diagnostics);
  } catch (error) {
    console.error('Error in logo diagnostics:', error);
    res.status(500).json({ error: error.message });
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
    
    if (!fs.promises.existsSync(absolutePath)) {
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
      SELECT id, trigger_point, description, sequence_order, active, created_at
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
    const { trigger_point, script_content, description } = req.body;
    
    // Get next sequence order for this trigger point
    const maxOrderStmt = db.prepare(`
      SELECT COALESCE(MAX(sequence_order), 0) as max_order 
      FROM logic_scripts 
      WHERE distributor_id = ? AND trigger_point = ?
    `);
    
    const maxOrderResult = maxOrderStmt.get(distributorId, trigger_point);
    const nextOrder = maxOrderResult.max_order + 1;
    
    const insertStmt = db.prepare(`
      INSERT INTO logic_scripts (distributor_id, trigger_point, script_content, description, sequence_order, active)
      VALUES (?, ?, ?, ?, ?, 1)
    `);
    
    const result = insertStmt.run(distributorId, trigger_point, script_content, description, nextOrder);
    
    res.json({ success: true, id: result.lastInsertRowid });
  } catch (error) {
    console.error('Error creating logic script:', error);
    res.status(500).json({ error: 'Failed to create logic script' });
  }
});


// Update script order

app.put('/api/logic-scripts/reorder', async (req, res) => {

  if (!req.session.distributor_id || req.session.userType !== 'Admin') {
    return res.status(401).json({ error: 'Not authorized' });
  }

  try {
    const distributorId = req.session.distributor_id;
    const { scripts } = req.body; // Array of { id, sequence_order }
    
    // Update all scripts in a transaction
   const updateStmt = db.prepare(`UPDATE ... WHERE id = ? AND distributor_id = ?`);
	for (const script of scripts) {
	  updateStmt.run(script.sequence_order, script.id, distributorId);
	}
    
    for (const script of scripts) {
      await db.prepare(`
        UPDATE logic_scripts 
        SET sequence_order = ? 
        WHERE id = ? AND distributor_id = ?
      `, [script.sequence_order, script.id, distributorId]);
    }
    
    await db.prepare('COMMIT');
    res.json({ success: true });
  } catch (error) {
    await db.prepare('ROLLBACK');
    console.error('Error reordering scripts:', error);
    res.status(500).json({ error: 'Failed to reorder scripts' });
  }
});

app.put('/api/logic-scripts/:id', async (req, res) => {

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
	
	await db.prepare(`
	  UPDATE logic_scripts 
	  SET ${updateFields.join(', ')}, updated_at = CURRENT_TIMESTAMP
	  WHERE id = ? AND distributor_id = ?
	`, updateValues);
	
	res.json({ success: true });
	} catch (error) {
	  console.error('Error updating script:', error);
	  res.status(500).json({ error: 'Failed to update script' });
	}
});
// Delete logic script


app.delete('/api/logic-scripts/:id', async (req, res) => {

  if (!req.session.distributor_id || req.session.userType !== 'Admin') {
    return res.status(401).json({ error: 'Not authorized' });
  }
  try {
    const distributorId = req.session.distributor_id;
    const scriptId = req.params.id;
    
    await db.prepare(`
      DELETE FROM logic_scripts 
      WHERE id = ? AND distributor_id = ?
    `, [scriptId, distributorId]);
    
    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting script:', error);
    res.status(500).json({ error: 'Failed to delete script' });
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
app.post('/api/execute-logic-scripts', async (req, res) => {
  try {
    const { distributor_id, trigger_point, context } = req.body;
    
    // Get all active scripts for this trigger point
    const scripts = await db.prepare(`
      SELECT script_content, description 
      FROM logic_scripts 
      WHERE distributor_id = ? AND trigger_point = ? AND active = TRUE
      ORDER BY sequence_order
    `, [distributor_id, trigger_point]);
    
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
    const { message, customerAttributes, triggerPoints } = req.body;
    
    const systemPrompt = `You are an expert at creating JavaScript logic scripts for e-commerce storefronts. 

AVAILABLE CUSTOMER ATTRIBUTES: ${customerAttributes.join(', ')}

AVAILABLE TRIGGER POINTS:
- storefront_load: When customer first visits the store
- quantity_change: When customer changes item quantities  
- add_to_cart: When customer adds items to cart
- submit: Before order is submitted

CONTEXT OBJECTS AVAILABLE IN SCRIPTS:
- customer: Object with all customer attributes (${customerAttributes.join(', ')})
- cart: Object with {items: [{product_id, name, price, quantity}], total, subtotal}
- products: Array of all available products

SCRIPT REQUIREMENTS:
1. Return an object: {allow: true/false, message?: "popup text", modifyCart?: {}}
2. Use only safe JavaScript - no external API calls, no dangerous operations
3. Be precise and handle edge cases
4. Always include clear error handling

IMPORTANT: When providing a complete script, format it EXACTLY like this:

SCRIPT_START
trigger_point: [trigger_point_key]
description: [Brief description of what this script does]

[Your JavaScript code here]

SCRIPT_END

Example script format:
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

When user requests logic, follow this process:
1. Understand the requirement clearly
2. Ask clarifying questions if needed
3. Determine the appropriate trigger point
4. Generate the JavaScript code using the SCRIPT_START/SCRIPT_END format
5. Provide a clear description and examples
6. Ask for confirmation before finalizing

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
      throw new Error('Claude API request failed');
    }

    const data = await response.json();
    const claudeResponse = data.content[0].text;

    // Extract script using the new format
    let script = null;
    const scriptMatch = claudeResponse.match(/SCRIPT_START\s*\ntrigger_point:\s*([^\n]+)\s*\ndescription:\s*([^\n]+)\s*\n```javascript\s*\n([\s\S]*?)\n```\s*\nSCRIPT_END/);
    
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
  console.log('AI Customization request received');
  
  if (!req.session.distributor_id || req.session.userType !== 'Admin') {
    return res.status(401).json({ error: 'Not authorized' });
  }
  
  const { message, distributorSlug } = req.body;
  
  if (!message || !distributorSlug) {
    return res.status(400).json({ error: 'Message and distributor slug are required' });
  }
  
  try {
    console.log(`AI customization request for ${distributorSlug}: ${message}`);
    
    // Define the distributor's source directory
    const distributorDir = __dirname + '/../src/distributors/' + distributorSlug;
    
    // Check if distributor directory exists
    if (!await directoryExists(distributorDir)) {
      return res.status(404).json({ error: 'Distributor directory not found' });
    }
    
    // Use Claude AI to parse the request and generate modifications
    const modifications = await parseAIRequestWithClaude(message, distributorDir);
    
    if (modifications.length === 0) {
      return res.json({
        response: "I understand your request, but I couldn't determine specific code changes to make. Could you be more specific about what visual or functional changes you'd like? For example:\n\n• 'Make the Add to Cart buttons blue with rounded corners'\n• 'Add a promotional banner at the top of the page'\n• 'Create a dark mode toggle in the header'",
        changes: []
      });
    }
    
    // Apply the modifications
    const appliedChanges = [];
    const errors = [];
    
    for (const mod of modifications) {
      try {
        await applyModification(mod, req.session.distributor_id);
        appliedChanges.push(mod.description);
        console.log(`Applied: ${mod.description}`);
      } catch (error) {
        console.error(`Failed to apply modification: ${mod.description}`, error);
        errors.push(`Failed: ${mod.description} - ${error.message}`);
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
    console.error('AI customization error:', error);
    res.status(500).json({ 
      error: 'Error processing customization request',
      response: "I encountered an error while processing your request. Please try again or contact support."
    });
  }
});

// Claude AI-powered request parser
async function parseAIRequestWithClaude(userRequest, distributorDir) {
  console.log('Processing AI customization request with Claude...');
  
  // Enhanced system prompt with all available elements and advanced styling capabilities
  const systemPrompt = `You are an AI assistant that helps customize storefront appearance. 

AVAILABLE ELEMENTS TO STYLE:
- "page-background" - main page container
- "header-nav" - top navigation area with title and buttons
- "category-filter-container" - container holding all category buttons
- "category-buttons" - individual category filter buttons (All, Olive Oils, etc.)
- "search-bar" - search input field
- "product-grid" - grid container holding all products
- "product-card" - individual product cards
- "product-image" - product images
- "product-title" - product names/titles
- "product-sku" - SKU text
- "product-price" - price text
- "product-description" - product descriptions
- "quantity-controls" - quantity selector container
- "quantity-button" - +/- quantity buttons
- "quantity-input" - quantity number input
- "add-to-cart-button" - add to cart buttons
- "modal-overlay" - product detail modal background
- "modal-content" - product detail modal content

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
- "Make buttons black" → category-buttons: {backgroundColor: '#000000'}
- "Hide the search bar" → search-bar: {display: 'none'}
- "Center the category buttons" → category-filter-container: {justifyContent: 'center'}
- "Make product cards bigger" → product-card: {transform: 'scale(1.1)'}
- "Arrange category buttons vertically" → category-filter-container: {flexDirection: 'column', alignItems: 'flex-start'}

Parse the user request and return a JSON object with modifications array. Each modification should have:
- elementSelector: the exact element name from the list above
- cssProperties: object with CSS property names as keys and values as strings
- description: human-readable description of the change

User request: "${userRequest}"

Return ONLY a valid JSON object in this format:
{
  "modifications": [
    {
      "elementSelector": "element-name",
      "cssProperties": {
        "cssProperty": "value"
      },
      "description": "Description of change"
    }
  ],
  "summary": "Brief summary of all changes"
}`;

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-3-5-haiku-20241022',
        max_tokens: 1000,
        messages: [{
          role: 'user',
          content: systemPrompt
        }]
      })
    });

    if (!response.ok) {
      throw new Error(`Claude API error: ${response.status}`);
    }

    const data = await response.json();
    const claudeResponse = data.content[0].text;
    
    console.log('Received response from Claude AI');
    
    try {
      const parsed = JSON.parse(claudeResponse);
      console.log('Claude understanding:', parsed);
      
      if (parsed.modifications && Array.isArray(parsed.modifications)) {
        console.log(`Generated ${parsed.modifications.length} modifications`);
        return parsed.modifications;
      } else {
        console.log('No valid modifications found in Claude response');
        return [];
      }
    } catch (parseError) {
      console.error('Failed to parse Claude response as JSON:', parseError);
      console.log('Raw Claude response:', claudeResponse);
      return [];
    }
    
  } catch (error) {
    console.error('Error calling Claude API:', error);
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
  try {
    // Claude sometimes includes explanation before/after JSON, so extract just the JSON
    const jsonMatch = claudeResponse.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.error('No valid JSON found in Claude response');
      return [];
    }
    
    const parsed = JSON.parse(jsonMatch[0]);
    console.log('Claude understanding:', parsed);
    
    return parsed.modifications || [];
    
  } catch (error) {
    console.error('Error parsing Claude response:', error);
    return [];
  }
}

// Enhanced applyModification function
async function applyModification(modification, distributorId) {
  try {
    // Insert or update the style directly in the database
    db.prepare(`
      INSERT OR REPLACE INTO distributor_styles (distributor_id, element_selector, css_properties, updated_at)
      VALUES (?, ?, ?, CURRENT_TIMESTAMP)
    `).run(
      distributorId,
      modification.elementSelector,
      JSON.stringify(modification.cssProperties)
    );

    console.log(`Successfully saved style for: ${modification.elementSelector}`);
    
  } catch (error) {
    console.error(`Failed to save style for ${modification.elementSelector}:`, error);
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
  console.log('Styles request');
  
  if (!req.session.distributor_id) {
    return res.status(401).json({ error: 'Not authenticated' });
  }
  
  try {
    const styles = db.prepare(`
      SELECT element_selector, css_properties 
      FROM distributor_styles 
      WHERE distributor_id = ?
    `).all(req.session.distributor_id);
    
    // Convert to a more usable format
    const styleMap = {};
    styles.forEach(style => {
      try {
        styleMap[style.element_selector] = JSON.parse(style.css_properties);
      } catch (e) {
        console.error('Error parsing CSS properties:', e);
      }
    });
    
    res.json(styleMap);
  } catch (error) {
    console.error('Error fetching styles:', error);
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

 

// Add this to your backend/index.js (NO IMPORTS - just the endpoint and functions)

// AI Customization endpoint
app.post('/api/ai-customize', async (req, res) => {
  console.log('AI Customization request received');
  
  if (!req.session.distributor_id || req.session.userType !== 'Admin') {
    return res.status(401).json({ error: 'Not authorized' });
  }
  
  const { message, distributorSlug } = req.body;
  
  if (!message || !distributorSlug) {
    return res.status(400).json({ error: 'Message and distributor slug are required' });
  }
  
  try {
    console.log(`AI customization request for ${distributorSlug}: ${message}`);
    
    // Define the distributor's source directory
    const distributorDir = path.join(__dirname, '..', 'src', 'distributors', distributorSlug);
    
    // Check if distributor directory exists
    if (!await directoryExists(distributorDir)) {
      return res.status(404).json({ error: 'Distributor directory not found' });
    }
    
    // Parse the AI request and determine what files to modify
    const modifications = await parseAIRequest(message, distributorDir);
    
    if (modifications.length === 0) {
      return res.json({
        response: "I understand your request, but I'm not sure how to implement that change. Could you be more specific? For example:\n\n• 'Make the Add to Cart buttons brown'\n• 'Change the background color to blue'\n• 'Make the product cards have rounded corners'",
        changes: []
      });
    }
    
    // Apply the modifications
    const appliedChanges = [];
    for (const mod of modifications) {
      try {
        await applyModification(mod);
        appliedChanges.push(mod.description);
        console.log(`Applied: ${mod.description}`);
      } catch (error) {
        console.error(`Failed to apply modification: ${mod.description}`, error);
      }
    }
    
    const response = appliedChanges.length > 0 
      ? `Great! I've successfully applied the following changes:\n\n${appliedChanges.map(change => `• ${change}`).join('\n')}\n\nThe changes should be visible after refreshing your storefront. Is there anything else you'd like me to customize?`
      : "I encountered some issues applying your requested changes. Please try being more specific or contact support if the problem persists.";
    
    res.json({
      response: response,
      changes: appliedChanges
    });
    
  } catch (error) {
    console.error('AI customization error:', error);
    res.status(500).json({ 
      error: 'Error processing customization request',
      response: "I encountered an error while processing your request. Please try again or contact support."
    });
  }
});

// Helper function to check if directory exists
async function directoryExists(dirPath) {
  try {
    const stats = await fs.promises.stat(dirPath);
    return stats.isDirectory();
  } catch {
    return false;
  }
}

// Helper function to parse AI requests and determine modifications
async function parseAIRequest(message, distributorDir) {
  const modifications = [];
  const lowerMessage = message.toLowerCase();
  
  // Define color mappings
  const colorMappings = {
    'brown': 'bg-amber-700',
    'blue': 'bg-blue-500',
    'red': 'bg-red-500',
    'green': 'bg-green-500',
    'yellow': 'bg-yellow-500',
    'purple': 'bg-purple-500',
    'pink': 'bg-pink-500',
    'gray': 'bg-gray-500',
    'black': 'bg-black',
    'white': 'bg-white'
  };
  
  // Pattern: "make the [element] [color]"
  // Example: "make the add to cart buttons brown"
  if (lowerMessage.includes('add to cart') && lowerMessage.includes('button')) {
    for (const [colorName, colorClass] of Object.entries(colorMappings)) {
      if (lowerMessage.includes(colorName)) {
        modifications.push({
          type: 'color_change',
          file: path.join(distributorDir, 'components', 'Storefront.jsx'),
          find: /bg-green-\d+/g,
          replace: colorClass,
          description: `Changed Add to Cart buttons to ${colorName}`,
          context: 'Add to Cart button styling'
        });
        break;
      }
    }
  }
  
  // Pattern: "make the background [color]"
  if (lowerMessage.includes('background') && (lowerMessage.includes('color') || lowerMessage.includes('blue') || lowerMessage.includes('red'))) {
    for (const [colorName, colorClass] of Object.entries(colorMappings)) {
      if (lowerMessage.includes(colorName)) {
        modifications.push({
          type: 'background_change',
          file: path.join(distributorDir, 'components', 'Storefront.jsx'),
          find: /className="p-6"/g,
          replace: `className="p-6 ${colorClass}"`,
          description: `Changed page background to ${colorName}`,
          context: 'Page background styling'
        });
        break;
      }
    }
  }
  
  // Pattern: "make [something] rounded" or "add rounded corners"
  if (lowerMessage.includes('rounded') || lowerMessage.includes('round')) {
    if (lowerMessage.includes('product') || lowerMessage.includes('card')) {
      modifications.push({
        type: 'border_change',
        file: path.join(distributorDir, 'components', 'Storefront.jsx'),
        find: /className="border p-4 rounded/g,
        replace: 'className="border p-4 rounded-xl',
        description: 'Added rounded corners to product cards',
        context: 'Product card border styling'
      });
    }
  }
  
  // Pattern: "add shadow" or "make [something] have shadow"
  if (lowerMessage.includes('shadow')) {
    if (lowerMessage.includes('navigation') || lowerMessage.includes('nav') || lowerMessage.includes('header')) {
      modifications.push({
        type: 'shadow_change',
        file: path.join(distributorDir, 'components', 'Storefront.jsx'),
        find: /className="flex justify-between mb-4/g,
        replace: 'className="flex justify-between mb-4 shadow-lg p-4 bg-white rounded-lg',
        description: 'Added shadow to navigation header',
        context: 'Navigation header styling'
      });
    } else if (lowerMessage.includes('product') || lowerMessage.includes('card')) {
      modifications.push({
        type: 'shadow_change',
        file: path.join(distributorDir, 'components', 'Storefront.jsx'),
        find: /hover:shadow-md/g,
        replace: 'hover:shadow-xl shadow-lg',
        description: 'Enhanced shadows on product cards',
        context: 'Product card shadow effects'
      });
    }
  }
  
  return modifications;
}

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
    const { items } = req.body;
    
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
    
    // Generate CSV content
    const orderDate = new Date().toISOString().split('T')[0];
    let csvContent = 'Order Date,Customer ID,Customer Name,Customer Email,Product SKU,Product Name,Quantity,Unit Price,Total\n';
    
    items.forEach(item => {
      const lineTotal = item.quantity * item.unitPrice;
      csvContent += `${orderDate},${user.account_id || 'N/A'},${user.customer_name || user.username},${user.username},${item.sku},"${item.name}",${item.quantity},${item.unitPrice.toFixed(2)},${lineTotal.toFixed(2)}\n`;
    });
    
    // Calculate order total
    const orderTotal = items.reduce((total, item) => {
      return total + (item.quantity * item.unitPrice);
    }, 0);
    
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
    
    items.forEach(item => {
      insertOrderItem.run(
        orderId,
        item.id,
        item.quantity,
        item.unitPrice
      );
    });
    
    // Create a temporary file for the CSV
    const fs = require('fs');
    const path = require('path');
    const csvFilePath = path.join(__dirname, `order_${orderId}_${orderDate}.csv`);
    
    fs.promises.writeFileSync(csvFilePath, csvContent);
    
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
    
    // Delete temporary CSV file
    fs.promises.unlinkSync(csvFilePath);
    
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
  
  res.json(products);
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
  
  try {
    // Get cart items with product details
    const cartItems = db.prepare(`
      SELECT ci.id as cart_item_id, ci.quantity, p.*
      FROM cart_items ci
      JOIN products p ON ci.product_id = p.id
      WHERE ci.user_id = ?
    `).all(req.session.user_id);
    
    console.log(`Found ${cartItems.length} cart items for user ${req.session.user_id}`);
    res.json(cartItems);
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
