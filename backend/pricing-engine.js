// pricing-engine.js - Centralized pricing logic for backend (SYNCHRONOUS VERSION)
// This module handles executing logic scripts and applying price modifications
// to ensure consistent pricing across all API endpoints for each distributor

class PricingEngine {
  constructor(db) {
    this.db = db;
    this.scriptCache = new Map();
    this.cacheExpiry = 5 * 60 * 1000; // 5 minutes
  }

  // Get active logic scripts from database with caching (distributor-specific, SYNC)
  getActiveLogicScripts(distributorId) {
    const cacheKey = `scripts_${distributorId}`;
    const now = Date.now();
    const cached = this.scriptCache.get(cacheKey);
    
    if (cached && (now - cached.timestamp) < this.cacheExpiry) {
      return cached.scripts;
    }

    try {
      // Use synchronous database calls like your working pattern
      const stmt = this.db.prepare(`
        SELECT id, trigger_point, script_content, description, active, created_at
        FROM logic_scripts 
        WHERE active = 1 AND distributor_id = ?
        ORDER BY created_at ASC
      `);
      const scripts = stmt.all(distributorId);

      // Group scripts by trigger point
      const scriptsByTrigger = {};
      scripts.forEach(script => {
        if (!scriptsByTrigger[script.trigger_point]) {
          scriptsByTrigger[script.trigger_point] = [];
        }
        scriptsByTrigger[script.trigger_point].push(script);
      });

      // Cache the results by distributor
      this.scriptCache.set(cacheKey, {
        scripts: scriptsByTrigger,
        timestamp: now
      });

      return scriptsByTrigger;
    } catch (error) {
      console.error('Error fetching logic scripts:', error);
      return {};
    }
  }

  // Clear the script cache (call this when scripts are modified)
  clearCache() {
    this.scriptCache.clear();
  }

  // Execute logic scripts for a specific trigger point and distributor (SYNC)
  executeLogicScripts(triggerPoint, distributorId, context = {}) {
    const scriptsByTrigger = this.getActiveLogicScripts(distributorId);
    const scripts = scriptsByTrigger[triggerPoint] || [];

    for (const script of scripts) {
      try {
        // Create a safe execution context
        const scriptContext = {
          customer: context.customer || {},
          cart: context.cart || { items: [], total: 0, subtotal: 0 },
          products: context.products || [],
          distributor_id: distributorId,
          ...context
        };

        // Create function from script content with error handling
        const scriptFunction = new Function(
          'customer', 
          'cart', 
          'products', 
          'distributor_id',
          `
          try {
            ${script.script_content}
          } catch (error) {
            console.error('Script execution error:', error);
            return { allow: true };
          }
          `
        );

        // Execute script with context
        const result = scriptFunction(
          scriptContext.customer, 
          scriptContext.cart, 
          scriptContext.products,
          scriptContext.distributor_id
        );

        // Handle script result
        if (result && typeof result === 'object') {
          if (result.allow === false) {
            return {
              allowed: false,
              message: result.message || 'Action blocked by business rule'
            };
          }

          // Handle any other modifications the script might return
          if (result.modifyCart || result.modifyProducts) {
            // Future: Handle cart/product modifications
          }
        }

      } catch (error) {
        console.error(`Error executing logic script ${script.id}:`, error);
        // Continue with other scripts even if one fails
      }
    }

    return { allowed: true };
  }

  // Apply pricing modifications to a single product (distributor-specific, SYNC)
  applyProductPricing(product, distributorId, customer = {}) {
    const scripts = this.getActiveLogicScripts(distributorId);
    const storefrontScripts = scripts['storefront_load'] || [];

    // Apply price modifications from storefront_load scripts for this distributor
    let modifiedPrice = product.unitPrice;
    
    for (const script of storefrontScripts) {
      try {
        // Check if this script modifies this specific product
        if (script.description.includes(product.sku)) {
          // Simple pattern matching for price changes
          // This could be made more sophisticated
          const priceMatch = script.description.match(/\$(\d+(?:\.\d{2})?)/);
          if (priceMatch) {
            modifiedPrice = parseFloat(priceMatch[1]);
            break; // Apply first matching script
          }
        }
      } catch (error) {
        console.error(`Error applying pricing script ${script.id}:`, error);
      }
}

    return {
      ...product,
      unitPrice: modifiedPrice,
      originalPrice: product.unitPrice !== modifiedPrice ? product.unitPrice : undefined
    };
  }
  applyProductsPricing(products, distributorId, customer = {}) {
    const modifiedProducts = [];
    
    for (const product of products) {
      const modifiedProduct = this.applyProductPricing(product, distributorId, customer);
      modifiedProducts.push(modifiedProduct);
    }
    
    return modifiedProducts;
  }

  // Apply pricing to cart items (distributor-specific, SYNC)
  applyCartPricing(cartItems, distributorId, customer = {}) {
    const modifiedItems = [];
    
    for (const item of cartItems) {
      const modifiedItem = this.applyProductPricing(item, distributorId, customer);
      modifiedItems.push(modifiedItem);
    }
    
    return modifiedItems;
  }

  // Validate an action (like add to cart, quantity change, etc.) for a distributor (SYNC)
  validateAction(triggerPoint, distributorId, context) {
    return this.executeLogicScripts(triggerPoint, distributorId, context);
  }

  
}
// Example usage in your API routes:

// In your main server file, create a global pricing engine instance
// const pricingEngine = new PricingEngine(db);

// Modified /api/items endpoint (distributor-aware)
async function getItemsWithPricing(req, res) {
  try {
    // Get customer info from session (includes distributor)
    const customer = req.session.user || {};
    const distributorId = customer.distributorId;
    
    if (!distributorId) {
      return res.status(400).json({ error: 'No distributor found for user' });
    }
    
    // Fetch base products from database for this distributor
    const items = await db.all(`
      SELECT * FROM products 
      WHERE distributor_id = ? 
      ORDER BY name
    `, [distributorId]);
    
    // Apply pricing logic for this distributor
    const itemsWithPricing = await pricingEngine.applyProductsPricing(items, distributorId, customer);
    
    res.json(itemsWithPricing);
  } catch (error) {
    console.error('Error fetching items:', error);
    res.status(500).json({ error: 'Failed to fetch items' });
  }
}

// Modified /api/cart endpoint (distributor-aware)
async function getCartWithPricing(req, res) {
  try {
    const customer = req.session.user || {};
    const distributorId = customer.distributorId;
    
    if (!distributorId) {
      return res.status(400).json({ error: 'No distributor found for user' });
    }
    
    // Fetch cart items from database for this user and distributor
    const cartItems = await db.all(`
      SELECT ci.id as cart_item_id, ci.quantity, 
             p.id, p.name, p.sku, p.unitPrice, p.description, p.image_url, p.category
      FROM cart_items ci
      JOIN products p ON ci.product_id = p.id
      WHERE ci.user_id = ? AND p.distributor_id = ?
    `, [req.session.user.id, distributorId]);
    
    // Apply pricing logic to cart items for this distributor
    const cartWithPricing = await pricingEngine.applyCartPricing(cartItems, distributorId, customer);
    
    res.json(cartWithPricing);
  } catch (error) {
    console.error('Error fetching cart:', error);
    res.status(500).json({ error: 'Failed to fetch cart' });
  }
}

// Modified add to cart endpoint with validation (distributor-aware)
async function addToCartWithValidation(req, res) {
  try {
    const { product_id, quantity } = req.body;
    const customer = req.session.user || {};
    const distributorId = customer.distributorId;
    
    if (!distributorId) {
      return res.status(400).json({ error: 'No distributor found for user' });
    }
    
    // Get product details (ensure it belongs to this distributor)
    const product = await db.get(`
      SELECT * FROM products 
      WHERE id = ? AND distributor_id = ?
    `, [product_id, distributorId]);
    
    if (!product) {
      return res.status(404).json({ error: 'Product not found for this distributor' });
    }
    
    // Apply pricing to get current price for this distributor
    const productWithPricing = await pricingEngine.applyProductPricing(product, distributorId, customer);
    
    // Validate the action with logic scripts for this distributor
    const validation = await pricingEngine.validateAction('add_to_cart', distributorId, {
      customer,
      item: productWithPricing,
      quantity
    });
    
    if (!validation.allowed) {
      return res.status(400).json({ 
        error: validation.message || 'Action not allowed' 
      });
    }
    
    // Proceed with adding to cart using current price
    // ... rest of add to cart logic
    
    res.json({ success: true });
  } catch (error) {
    console.error('Error adding to cart:', error);
    res.status(500).json({ error: 'Failed to add to cart' });
  }
}

// Helper function to invalidate pricing cache when scripts change (distributor-specific)
async function onLogicScriptChanged(distributorId) {
  const cacheKey = `scripts_${distributorId}`;
  pricingEngine.scriptCache.delete(cacheKey);
}

module.exports = {
  PricingEngine
};
