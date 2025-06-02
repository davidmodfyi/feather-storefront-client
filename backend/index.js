const express = require('express');
const cors = require('cors');
const database = require('./database');
const session = require('express-session');
const MemoryStore = require('memorystore')(session);
const multer = require('multer');
const path = require('path');
const fs = require('fs');

require('dotenv').config();

const DISTRIBUTOR_MAPPING = {
  1: 'oceanwave',    // Ocean Wave Foods
  2: 'palma',        // Palma Cigars
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
console.log('Using uploads directory:', uploadsDir);

if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
  console.log('Created uploads directory');
}
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
      public_dir_exists: fs.existsSync(path.join(__dirname, 'public')),
      uploads_dir: path.join(__dirname, 'public', 'uploads'),
      uploads_dir_exists: fs.existsSync(path.join(__dirname, 'public', 'uploads')),
      working_directory: process.cwd(),
      __dirname: __dirname
    };
    
    if (distributor?.logo_path) {
      const relativePath = distributor.logo_path.startsWith('/') 
        ? distributor.logo_path.substring(1) 
        : distributor.logo_path;
      
      const absolutePath = path.join(__dirname, 'public', relativePath);
      diagnostics.absolute_logo_path = absolutePath;
      diagnostics.logo_file_exists = fs.existsSync(absolutePath);
      
      if (diagnostics.logo_file_exists) {
        diagnostics.logo_file_stats = fs.statSync(absolutePath);
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

// Upload header logo endpoint
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
    
    // Store relative path from public directory - use the path that multer created
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
        if (fs.existsSync(oldLogoPath)) {
          fs.unlinkSync(oldLogoPath);
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
        if (fs.existsSync(oldLogoPath)) {
          fs.unlinkSync(oldLogoPath);
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
      publicDirExists: fs.existsSync(publicDir),
      uploadsDirExists: fs.existsSync(uploadsDir),
      publicDirContents: [],
      uploadsDirContents: []
    };
    
    if (result.publicDirExists) {
      try {
        result.publicDirContents = fs.readdirSync(publicDir);
      } catch (err) {
        result.publicDirError = err.message;
      }
    }
    
    if (result.uploadsDirExists) {
      try {
        result.uploadsDirContents = fs.readdirSync(uploadsDir);
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
          exists: fs.existsSync(publicDir),
          writable: false, // We'll set this below
          contents: []
        },
        uploads_dir: {
          path: uploadsDir,
          exists: fs.existsSync(uploadsDir),
          writable: false, // We'll set this below
          contents: []
        },
        render_mount: {
          path: renderMountDir,
          exists: fs.existsSync(renderMountDir),
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
        fs.writeFileSync(testFile, 'test');
        fs.unlinkSync(testFile);
        result.directories.public_dir.writable = true;
        
        // Get directory contents
        result.directories.public_dir.contents = fs.readdirSync(publicDir);
      }
    } catch (e) {
      result.directories.public_dir.error = e.message;
    }
    
    try {
      if (result.directories.uploads_dir.exists) {
        const testFile = path.join(uploadsDir, '.write-test-' + Date.now());
        fs.writeFileSync(testFile, 'test');
        fs.unlinkSync(testFile);
        result.directories.uploads_dir.writable = true;
        
        result.directories.uploads_dir.contents = fs.readdirSync(uploadsDir);
      }
    } catch (e) {
      result.directories.uploads_dir.error = e.message;
    }
    
    try {
      if (result.directories.render_mount.exists) {
        const testFile = path.join(renderMountDir, '.write-test-' + Date.now());
        fs.writeFileSync(testFile, 'test');
        fs.unlinkSync(testFile);
        result.directories.render_mount.writable = true;
        
        result.directories.render_mount.contents = fs.readdirSync(renderMountDir);
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
        exists: fs.existsSync(p),
        size: fs.existsSync(p) ? fs.statSync(p).size : null
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
    if (fs.existsSync(logoPath)) {
      fs.unlinkSync(logoPath);
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

      // NEW APPROACH: Return redirect URL instead of success
      const redirectUrl = distributorSlug !== 'default' ? `/?dist=${distributorSlug}` : '/';
      
      return res.json({
        status: 'logged_in',
        user_id: dbUser.id,
        distributorName: dbUser.distributor_name,
        userType: dbUser.type || 'Admin',
        accountId: dbUser.account_id,
        distributorSlug: distributorSlug,
        redirectUrl: redirectUrl  // NEW: Tell frontend where to redirect
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
    
    // Delete temporary CSV file
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
