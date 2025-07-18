const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(__dirname, 'featherstorefront.db');
const db = new Database(dbPath);

// Create homepage_config table
db.exec(`
  CREATE TABLE IF NOT EXISTS homepage_config (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    distributor_id INTEGER NOT NULL,
    
    -- Banner configuration
    banner_message TEXT DEFAULT 'END OF SEASON SOON',
    banner_link_text TEXT DEFAULT 'LAST CHANCE',
    banner_bg_color TEXT DEFAULT '#000000',
    banner_text_color TEXT DEFAULT '#ffffff',
    countdown_end_date TEXT DEFAULT '',
    
    -- Logo configuration
    logo_url TEXT DEFAULT '',
    logo_alt_text TEXT DEFAULT 'Logo',
    
    -- Hero section configuration
    hero_title TEXT DEFAULT 'ENGINEERED FOR EVERYDAY',
    hero_description TEXT DEFAULT 'Our latest collection balances functionality and aesthetics in the space of traditional workwear, lifestyle and activewear.',
    hero_button_text TEXT DEFAULT 'SHOP NOW',
    hero_button_bg_color TEXT DEFAULT '#ffffff',
    hero_button_text_color TEXT DEFAULT '#000000',
    
    -- Hero images (JSON array)
    hero_images TEXT DEFAULT '[]',
    
    -- Font configuration
    title_font TEXT DEFAULT 'Arial, sans-serif',
    title_font_size TEXT DEFAULT '48px',
    title_font_weight TEXT DEFAULT 'bold',
    body_font TEXT DEFAULT 'Arial, sans-serif',
    body_font_size TEXT DEFAULT '16px',
    
    -- General styling
    overlay_bg_color TEXT DEFAULT 'rgba(0, 0, 0, 0.3)',
    
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (distributor_id) REFERENCES distributors(id)
  )
`);

// Create a default configuration for each existing distributor
const distributors = db.prepare('SELECT id FROM distributors').all();

for (const distributor of distributors) {
  // Check if config already exists
  const existingConfig = db.prepare('SELECT id FROM homepage_config WHERE distributor_id = ?').get(distributor.id);
  
  if (!existingConfig) {
    // Create default configuration
    db.prepare(`
      INSERT INTO homepage_config (
        distributor_id,
        countdown_end_date,
        hero_images
      ) VALUES (?, ?, ?)
    `).run(
      distributor.id,
      new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(), // 7 days from now
      JSON.stringify(['/placeholder-hero.jpg']) // Default placeholder image
    );
  }
}

console.log('✅ Homepage config table created successfully');
console.log('📊 Default configurations added for existing distributors');

db.close();