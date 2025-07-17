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

      console.log('Found scripts for distributor', distributorId, ':', scripts);

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

  // LEGACY METHODS REMOVED - Claude's JavaScript handles all pricing logic directly
  // No more regex parsing needed! Claude understands natural language and generates appropriate JavaScript.

  // Apply pricing modifications to a single product (distributor-specific, SYNC)
  applyProductPricing(product, distributorId, customer = {}) {
    console.log('=== Processing product:', product.sku, 'Original price:', product.unitPrice);
    
    const scripts = this.getActiveLogicScripts(distributorId);
    console.log('All scripts found:', Object.keys(scripts));
    
    const storefrontScripts = scripts['storefront_load'] || [];
    console.log('Storefront scripts count:', storefrontScripts.length);
    
    if (storefrontScripts.length > 0) {
      console.log('First script description:', storefrontScripts[0].description);
    }

    let modifiedProduct = { ...product };
    const appliedRules = [];

    for (const script of storefrontScripts) {
      try {
        console.log('🎯 Executing pricing script:', script.description);
        console.log('🎯 Script content:', script.script_content);
        
        // Create execution context for Claude's JavaScript
        const scriptContext = {
          customer: customer || {},
          product: modifiedProduct,
          cart: { items: [], total: 0, subtotal: 0 }, // Will be enhanced later
          customTables: {}, // Will be enhanced later
          orderHistory: [], // Will be enhanced later
          distributor_id: distributorId
        };

        // Execute Claude's JavaScript directly
        const scriptFunction = new Function(
          'customer', 
          'product', 
          'cart', 
          'customTables',
          'orderHistory',
          'distributor_id',
          `
          try {
            ${script.script_content}
          } catch (error) {
            console.error('Pricing script execution error:', error);
            return product; // Return unchanged if error
          }
          `
        );

        // Execute the script with the current product
        const result = scriptFunction(
          scriptContext.customer,
          scriptContext.product,
          scriptContext.cart,
          scriptContext.customTables,
          scriptContext.orderHistory,
          scriptContext.distributor_id
        );

        // Check if the script returned a modified product
        if (result && typeof result === 'object' && result.sku === product.sku) {
          console.log('🎯 Script returned modified product:', {
            sku: result.sku,
            originalPrice: modifiedProduct.unitPrice,
            newPrice: result.unitPrice,
            pricingRule: result.pricingRule
          });
          
          // Track the applied rule
          if (result.unitPrice !== modifiedProduct.unitPrice) {
            appliedRules.push({
              description: script.description,
              type: 'claude_generated',
              oldPrice: modifiedProduct.unitPrice,
              newPrice: result.unitPrice,
              pricingRule: result.pricingRule || script.description
            });
          }
          
          modifiedProduct = result;
        } else {
          console.log('🎯 Script returned unchanged product or invalid result');
        }

      } catch (error) {
        console.error(`🎯 Error executing pricing script ${script.id}:`, error);
        // Continue with other scripts even if one fails
      }
    }

    console.log('Final price for', product.sku, ':', modifiedProduct.unitPrice);
    
    return {
      ...modifiedProduct,
      appliedPricingRules: appliedRules.length > 0 ? appliedRules : undefined
    };
  }

  // Apply pricing modifications to multiple products (distributor-specific, SYNC)
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

module.exports = {
  PricingEngine
};
