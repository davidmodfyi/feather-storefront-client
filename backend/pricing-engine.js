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

  // Check if a product matches the criteria in a pricing rule description
  productMatchesCriteria(product, description) {
    const lowerDesc = description.toLowerCase();
    const lowerSku = product.sku.toLowerCase();
    const lowerName = (product.name || '').toLowerCase();
    const lowerCategory = (product.category || '').toLowerCase();
    const lowerBrand = (product.brand || '').toLowerCase();

    // Check for "all products" or "all items"
    if (lowerDesc.includes('all product') || lowerDesc.includes('all item')) {
      return true;
    }

    // Check for specific SKU match
    if (lowerDesc.includes(lowerSku)) {
      return true;
    }

    // Check for brand match (e.g., "Apply 20% discount to Nike products")
    if (lowerBrand && lowerDesc.includes(lowerBrand)) {
      return true;
    }

    // Check for category match (e.g., "Apply $10 off all Electronics")
    if (lowerCategory && lowerDesc.includes(lowerCategory)) {
      return true;
    }

    // Check for name match
    if (lowerName && lowerDesc.includes(lowerName)) {
      return true;
    }

    // Check for comma-separated SKU list (e.g., "Apply discount to SKU-001, SKU-002, SKU-003")
    const skuMatches = lowerDesc.match(/sku[:\s]*([a-z0-9\-,\s]+)/i);
    if (skuMatches) {
      const skuList = skuMatches[1].split(',').map(s => s.trim().toLowerCase());
      if (skuList.includes(lowerSku)) {
        return true;
      }
    }

    return false;
  }

  // Parse and apply pricing rule from description
  applyPricingRule(originalPrice, description) {
    const lowerDesc = description.toLowerCase();
    
    try {
      // 1. Percentage discount (e.g., "Apply 20% discount", "20% off")
      const percentMatch = lowerDesc.match(/(\d+(?:\.\d+)?)%\s*(?:discount|off)/);
      if (percentMatch) {
        const discountPercent = parseFloat(percentMatch[1]);
        const newPrice = originalPrice * (1 - discountPercent / 100);
        return {
          newPrice: Math.max(0, newPrice),
          type: 'percentage_discount',
          value: discountPercent
        };
      }

      // 2. Dollar amount off (e.g., "$5 off", "Apply $10 discount")
      const dollarOffMatch = lowerDesc.match(/\$(\d+(?:\.\d{2})?)\s*(?:off|discount)/);
      if (dollarOffMatch) {
        const discountAmount = parseFloat(dollarOffMatch[1]);
        const newPrice = originalPrice - discountAmount;
        return {
          newPrice: Math.max(0, newPrice),
          type: 'dollar_discount',
          value: discountAmount
        };
      }

      // 3. Set specific price (e.g., "Set price to $25.99", "Price at $15")
      const setPriceMatch = lowerDesc.match(/(?:set price to|price at|new price)\s*\$(\d+(?:\.\d{2})?)/);
      if (setPriceMatch) {
        const newPrice = parseFloat(setPriceMatch[1]);
        return {
          newPrice: Math.max(0, newPrice),
          type: 'set_price',
          value: newPrice
        };
      }

      // 4. Percentage markup (e.g., "Add 15% markup", "15% markup")
      const markupMatch = lowerDesc.match(/(?:add\s*)?(\d+(?:\.\d+)?)%\s*markup/);
      if (markupMatch) {
        const markupPercent = parseFloat(markupMatch[1]);
        const newPrice = originalPrice * (1 + markupPercent / 100);
        return {
          newPrice: newPrice,
          type: 'percentage_markup',
          value: markupPercent
        };
      }

      // 5. Dollar amount added (e.g., "Add $5", "$3 additional")
      const dollarAddMatch = lowerDesc.match(/(?:add\s*)?\$(\d+(?:\.\d{2})?)\s*(?:additional)?/);
      if (dollarAddMatch) {
        const addAmount = parseFloat(dollarAddMatch[1]);
        const newPrice = originalPrice + addAmount;
        return {
          newPrice: newPrice,
          type: 'dollar_addition',
          value: addAmount
        };
      }

    } catch (error) {
      console.error('Error parsing pricing rule:', error);
    }

    return null; // No pricing rule found
  }

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

    var modifiedPrice = product.unitPrice;
    var appliedRules = [];

    for (const script of storefrontScripts) {
      try {
        // Check if this script applies to this product
        if (this.productMatchesCriteria(product, script.description)) {
          console.log('Product', product.sku, 'matches criteria for script:', script.description);
          
          const pricingResult = this.applyPricingRule(modifiedPrice, script.description);
          if (pricingResult) {
            modifiedPrice = pricingResult.newPrice;
            appliedRules.push({
              description: script.description,
              type: pricingResult.type,
              value: pricingResult.value,
              oldPrice: product.unitPrice,
              newPrice: modifiedPrice
            });
            console.log('Applied pricing rule to', product.sku, ':', pricingResult.type, pricingResult.value, '-> new price:', modifiedPrice);
          }
        }
      } catch (error) {
        console.error(`Error applying pricing script ${script.id}:`, error);
      }
    }

    console.log('Final price for', product.sku, ':', modifiedPrice);
    
    return {
      ...product,
      unitPrice: modifiedPrice,
      originalPrice: product.unitPrice !== modifiedPrice ? product.unitPrice : undefined,
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
