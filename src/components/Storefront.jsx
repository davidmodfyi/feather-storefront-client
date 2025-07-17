import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';

export default function Storefront({ onLogout, onHome, brandName }) {
  const [items, setItems] = useState([]);
  const [distributor, setDistributor] = useState('Storefront');
  const [categoryFilter, setCategoryFilter] = useState(null);
  const [cart, setCart] = useState({});
  const [quantities, setQuantities] = useState({});
  const [loading, setLoading] = useState(true);
  const [selectedItem, setSelectedItem] = useState(null);
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState("");
  const [headerLogo, setHeaderLogo] = useState(null);
  const [customStyles, setCustomStyles] = useState({});
  const [logicScripts, setLogicScripts] = useState({});
  const [customer, setCustomer] = useState({});
  const [dynamicContent, setDynamicContent] = useState({});

  // Function to execute logic scripts
  const executeLogicScripts = async (triggerPoint, context = {}) => {
    const scripts = logicScripts[triggerPoint] || [];
    
    for (const script of scripts) {
      if (!script.active) continue;
      
      try {
        // Create a safe execution context
        const scriptContext = {
          customer: customer,
          cart: {
            items: Object.values(cart),
            total: Object.values(cart).reduce((sum, item) => sum + (item.unitPrice * item.quantity), 0),
            subtotal: Object.values(cart).reduce((sum, item) => sum + (item.unitPrice * item.quantity), 0)
          },
          products: items,
          ...context
        };
        
        // Create function from script content
        const scriptFunction = new Function('customer', 'cart', 'products', script.script_content);
        
        // Execute script with context
        const result = scriptFunction(scriptContext.customer, scriptContext.cart, scriptContext.products);
        
        // Handle script result
        if (result && typeof result === 'object') {
          if (result.allow === false) {
            if (result.message) {
              alert(result.message);
            }
            return false; // Block the action
          }
          
          if (result.modifyCart) {
            // Handle cart modifications if needed
            console.log('Cart modification requested:', result.modifyCart);
          }
        }
        
      } catch (error) {
        console.error(`Error executing logic script ${script.id}:`, error);
      }
    }
    
    return true; // Allow the action
  };

  // Fetch logic scripts
  const fetchLogicScripts = async () => {
    try {
      console.log('🔄 Fetching logic scripts...');
      const response = await fetch('/api/logic-scripts', { credentials: 'include' });
      if (response.ok) {
        const scripts = await response.json();
        console.log('📋 All logic scripts loaded:', scripts);
        
        // Group scripts by trigger point
        const scriptsByTrigger = {};
        scripts.forEach(script => {
          if (!scriptsByTrigger[script.trigger_point]) {
            scriptsByTrigger[script.trigger_point] = [];
          }
          scriptsByTrigger[script.trigger_point].push(script);
        });
        
        console.log('📋 Scripts grouped by trigger point:', scriptsByTrigger);
        console.log('📋 Storefront_load scripts:', scriptsByTrigger['storefront_load']?.length || 0);
        
        setLogicScripts(scriptsByTrigger);
      }
    } catch (error) {
      console.error('Error fetching logic scripts:', error);
    }
  };

  // Fetch user info, items, and cart
  useEffect(() => {
    setLoading(true);
    
    // Fetch distributor name and customer info
    fetch('/api/me', { credentials: 'include' })
      .then(res => res.json())
      .then(data => {
        setDistributor(data.distributorName || 'Storefront');
        setCustomer(data); // Store customer data for scripts
      })
      .catch(console.error);

    // Fetch header logo
    fetch('/api/branding/header-logo', { credentials: 'include' })
      .then(res => res.json())
      .then(data => {
        if (data && data.logo) {
          setHeaderLogo(data.logo);
        }
      })
      .catch(console.error);

    // Fetch custom styles
    fetch('/api/styles', { credentials: 'include' })
      .then(res => res.json())
      .then(data => {
        console.log('🔥 STOREFRONT: Custom styles loaded from database:', data);
        console.log('🔥 STOREFRONT: Style keys:', Object.keys(data));
        setCustomStyles(data);
      })
      .catch(error => {
        console.error('🔥 STOREFRONT: Error loading styles:', error);
      });

    // Fetch dynamic content
    fetch('/api/dynamic-content', { credentials: 'include' })
      .then(res => res.json())
      .then(data => {
        console.log('Dynamic content loaded:', data);
        setDynamicContent(data);
      })
      .catch(console.error);
     
    // Fetch all items
    fetch('/api/items', { credentials: 'include' })
      .then(res => res.json())
      .then(data => {
        setItems(data);
        
        // Initialize quantities for all items to 1
        const initialQuantities = {};
        data.forEach(item => {
          initialQuantities[item.id] = 1;
        });
        setQuantities(initialQuantities);
      })
      .catch(console.error);
    
    // Fetch cart items
    fetchCart();
    
    // Fetch logic scripts
    fetchLogicScripts();
  }, []);

  // Execute storefront_load scripts when component is ready
  useEffect(() => {
    if (!loading && items.length > 0) {
      executeLogicScripts('storefront_load');
    }
  }, [loading, items, logicScripts]);

  
  useEffect(() => {
    document.title = `${distributor} - Storefront`;
  }, [distributor]);
  
  // Fetch cart items from the server
  const fetchCart = () => {
    fetch('/api/cart', { credentials: 'include' })
      .then(res => {
        if (!res.ok) throw new Error('Failed to fetch cart');
        return res.json();
      })
      .then(data => {
        // Convert array to object with product_id as key
        const cartObj = {};
        data.forEach(item => {
          cartObj[item.id] = {
            ...item,
            quantity: item.quantity
          };
          
          // Update quantities state to match cart
          setQuantities(prev => ({
            ...prev,
            [item.id]: item.quantity
          }));
        });
        
        setCart(cartObj);
        setLoading(false);
      })
      .catch(error => {
        console.error('Error fetching cart:', error);
        setLoading(false);
      });
  };

  function handleLogout() {
    fetch('/api/logout', { method: 'POST', credentials: 'include' })
      .then(() => onLogout());
  }

  function goToCart() {
    navigate('/cart');
  }

  async function handleQuantityChange(itemId, newQuantity) {
    // Ensure quantity is at least 1
    newQuantity = Math.max(1, newQuantity);
    
    // Execute quantity_change scripts
    const allowed = await executeLogicScripts('quantity_change', {
      itemId: itemId,
      newQuantity: newQuantity,
      oldQuantity: quantities[itemId] || 1
    });
    
    if (allowed) {
      setQuantities(prev => ({
        ...prev,
        [itemId]: newQuantity
      }));
    }
  }

  async function handleAddToCart(item) {
    // Check if item has a numeric ID
    if (!item.id || typeof item.id !== 'number') {
      console.error('Invalid product ID:', item.id);
      alert('Product has an invalid ID. Please try another product.');
      return;
    }

    const quantity = quantities[item.id] || 1;
    
    // Execute add_to_cart scripts
    const allowed = await executeLogicScripts('add_to_cart', {
      item: item,
      quantity: quantity
    });
    
    if (!allowed) {
      return; // Script blocked the action
    }
    
    // Use the numeric ID directly now
    const payload = {
      product_id: item.id,
      quantity: quantity
    };
    
    console.log('Cart payload:', payload);
    
    fetch('/api/cart', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(payload)
    })
      .then(res => {
        console.log('Response status:', res.status);
        if (!res.ok) {
          return res.text().then(text => {
            console.error('Error response:', text);
            throw new Error('Failed to update cart');
          });
        }
        return res.json();
      })
      .then(data => {
        console.log('Success:', data);
        
        // Update local cart state
        setCart(prevCart => {
          const updatedCart = { ...prevCart };
          updatedCart[item.id] = {
            ...item,
            quantity
          };
          return updatedCart;
        });
        
        // Refresh cart data
        fetchCart();
      })
      .catch(error => {
        console.error('Cart error:', error);
        alert('Could not update cart. Please try again.');
      });
  }

  function getCartItemCount() {
    return Object.keys(cart).length;
  }

  function isItemInCart(itemId) {
    return !!cart[itemId];
  }

  function getButtonText(itemId) {
    if (!isItemInCart(itemId)) {
      return "Add to Cart";
    }
    
    const cartQuantity = cart[itemId]?.quantity;
    const currentQuantity = quantities[itemId] || 1;
    
    if (cartQuantity !== currentQuantity) {
      return "Update Cart";
    }
    
    return "In Cart";
  }

  function getButtonClass(itemId) {
    if (!isItemInCart(itemId)) {
      return "bg-green-500 hover:bg-green-600";
    }
    
    const cartQuantity = cart[itemId]?.quantity;
    const currentQuantity = quantities[itemId] || 1;
    
    if (cartQuantity !== currentQuantity) {
      return "bg-yellow-500 hover:bg-yellow-600";
    }
    
    return "bg-blue-500 hover:bg-blue-600";
  }

  // Open product detail modal
  function openProductDetails(item) {
    setSelectedItem(item);
  }

  // Close product detail modal
  function closeProductDetails() {
    setSelectedItem(null);
  }

  const categories = [...new Set(items.map(item => item.category))];
  const filteredItems = items.filter(item => {
    // First apply category filter
    if (categoryFilter && item.category !== categoryFilter) return false;
    
    // Then apply search filter if there's a query
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      return (
        item.name.toLowerCase().includes(query) ||
        item.sku.toLowerCase().includes(query) ||
        (item.description && item.description.toLowerCase().includes(query))
      );
    }
    
    return true;
  });

  const getCustomStyle = (elementSelector) => {
    console.log('🎨 getCustomStyle called for:', elementSelector);
    console.log('🎨 Available custom styles:', Object.keys(customStyles));
    console.log('🎨 Style for', elementSelector, ':', customStyles[elementSelector]);
    return customStyles[elementSelector] || {};
  };

  // Render dynamic content for a specific zone
  const renderDynamicContent = (zoneName) => {
    const zoneContent = dynamicContent[zoneName] || [];
    
    return zoneContent.map((content, index) => {
      if (content.type === 'banner') {
        return (
          <div key={content.id || index} style={content.data} className="dynamic-banner">
            {content.data.text}
          </div>
        );
      } else if (content.type === 'message') {
        return (
          <div key={content.id || index} style={content.data} className="dynamic-message">
            {content.data.text}
          </div>
        );
      } else if (content.type === 'form-field') {
        if (content.data.fieldType === 'dropdown') {
          return (
            <div key={content.id || index} style={content.data.containerStyle} className="dynamic-form-field">
              <label style={content.data.labelStyle}>{content.data.label}</label>
              <select style={content.data.inputStyle}>
                {content.data.options && content.data.options.map((option, i) => (
                  <option key={i} value={option}>{option}</option>
                ))}
              </select>
            </div>
          );
        }
      } else if (content.type === 'custom-html') {
        return (
          <div 
            key={content.id || index} 
            style={content.data.containerStyle}
            dangerouslySetInnerHTML={{ __html: content.data.html }}
          />
        );
      }
      return null;
    });
  };

  // Apply price modifications from storefront_load scripts
const getProductPricing = (item) => {
  console.log('🔍 Getting product pricing for:', item.sku, 'original price:', item.unitPrice);
  
  let modifiedProduct = { ...item };
  
  // Execute storefront_load scripts to get price modifications
  const storefrontScripts = logicScripts['storefront_load'] || [];
  console.log('📋 Storefront_load scripts found:', storefrontScripts.length);
  
  for (const script of storefrontScripts) {
    if (!script.active) continue;
    
    console.log('🔄 Processing script:', script.id);
    console.log('📝 Script content:', script.script_content);

    try {
      // Create execution context for Claude's JavaScript
      const customer = {}; // Will be enhanced later
      const cartContext = {
        items: Object.values(cart),
        total: 0,
        subtotal: 0
      };
      const customTables = {}; // Will be enhanced later
      const orderHistory = []; // Will be enhanced later
      
      // Execute Claude's JavaScript directly - same as backend pricing engine
      const scriptFunction = new Function(
        'customer', 'product', 'cart', 'customTables', 'orderHistory',
        `
        try {
          ${script.script_content}
        } catch (error) {
          console.error('Pricing script execution error:', error);
          return product; // Return unchanged if error
        }
        `
      );
      
      const result = scriptFunction(customer, modifiedProduct, cartContext, customTables, orderHistory);
      
      console.log('✅ Claude script result:', result);
      
      // Check if the script returned a modified product (Claude's format)
      if (result && typeof result === 'object' && result.sku === item.sku) {
        console.log('💰 Product modified by Claude script:', {
          sku: result.sku,
          originalPrice: modifiedProduct.unitPrice,
          newPrice: result.unitPrice,
          onSale: result.onSale,
          pricingRule: result.pricingRule
        });
        modifiedProduct = result;
      }
      
    } catch (error) {
      console.error('❌ Error executing pricing script', script.id, ':', error);
    }
  }
  
  console.log('🏁 Final product pricing for', item.sku, ':', modifiedProduct);
  return modifiedProduct;
};

// Convenience function for backward compatibility
const getDisplayPrice = (item) => {
  const pricedProduct = getProductPricing(item);
  return pricedProduct.unitPrice;
};
	
  return (
    <div className="p-6" style={getCustomStyle('page-background')}>
      {/* Dynamic content zone: header-top */}
      {renderDynamicContent('storefront-header-top')}
      
      {/* Header with logo */}
      {headerLogo && (
        <div className="absolute top-2 left-2" style={{ maxWidth: '40px', maxHeight: '40px' }}>
          <img 
            src={headerLogo} 
            alt={distributor} 
            className="h-auto w-full object-contain"
          />
        </div>
      )}
      
      <div className="flex justify-between mb-4 ml-20" style={getCustomStyle('header-nav')}>
        <h1 className="text-2xl font-bold">{distributor} - Storefront</h1>
        <div className="flex gap-2 items-center">
          <button onClick={onHome} className="px-3 py-1 bg-gray-400 text-white rounded">Home</button>
          <button 
            onClick={goToCart} 
            className="px-3 py-1 bg-blue-500 text-white rounded flex items-center gap-1"
          >
            🛒 My Cart ({getCartItemCount()})
          </button>
          <button onClick={handleLogout} className="px-3 py-1 bg-red-500 text-white rounded">Logout</button>
        </div>
      </div>

      {/* Dynamic content zone: header-bottom */}
      {renderDynamicContent('storefront-header-bottom')}
      
      {/* Dynamic content zone: before-categories */}
      {renderDynamicContent('storefront-before-categories')}
      
      <div className="flex gap-2 mb-6 flex-wrap" style={getCustomStyle('category-filter-container')}>
        <button 
          onClick={() => setCategoryFilter(null)} 
          className={`px-4 py-2 ${!categoryFilter ? 'bg-blue-700' : 'bg-blue-500'} text-white rounded`}
          style={getCustomStyle('category-buttons')}
        >
          All
        </button>
        {categories.map(cat => (
          <button 
            key={cat} 
            onClick={() => setCategoryFilter(cat)} 
            className={`px-4 py-2 ${categoryFilter === cat ? 'bg-blue-700' : 'bg-blue-500'} text-white rounded`}
            style={getCustomStyle('category-buttons')}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Dynamic content zone: after-categories */}
      {renderDynamicContent('storefront-after-categories')}

      <div className="mb-6">
        <input
          type="text"
          placeholder="Search by name, SKU or description"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full px-4 py-2 border rounded"
          style={getCustomStyle('search-bar')}
        />
      </div>
      
      {/* Dynamic content zone: before-products */}
      {renderDynamicContent('storefront-before-products')}

      <div className="flex gap-6">
        {/* Left sidebar zone */}
        <div className="flex-shrink-0">
          {renderDynamicContent('storefront-sidebar-left')}
        </div>

        {/* Main products area */}
        <div className="flex-1">
          {loading ? (
            <div className="text-center py-8">
              <p>Loading products...</p>
            </div>
          ) : (
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3" style={getCustomStyle('product-grid')}>
              {filteredItems.map(item => {
            const pricedProduct = getProductPricing(item);
            const displayPrice = pricedProduct.unitPrice;
            return (
              <div key={item.id} className="border p-4 rounded shadow hover:shadow-md transition-shadow relative" style={getCustomStyle('product-card')}>
                {/* Sale Badge */}
                {pricedProduct.onSale && (
                  <div className="absolute top-2 right-2 bg-green-500 text-white px-2 py-1 rounded-full text-xs font-bold z-10">
                    SALE
                  </div>
                )}
                
                <div className="cursor-pointer" onClick={() => openProductDetails(item)}>
                  {item.image_url && (
                    <div className="mb-3">
                      <img 
                        src={item.image_url} 
                        alt={item.name} 
                        className="w-full h-auto object-contain rounded max-h-48"
                        style={getCustomStyle('product-image')}
                      />
                    </div>
                  )}
                  <h2 className="text-xl font-bold mb-2 hover:text-blue-600" style={getCustomStyle('product-title')}>{item.name}</h2>
                  <p className="mb-1 text-gray-600" style={getCustomStyle('product-sku')}>SKU: {item.sku}</p>
                  <p className="mb-3 text-lg font-semibold" style={getCustomStyle('product-price')}>
                    <span className={pricedProduct.onSale ? 'text-green-600 font-bold' : ''}>
                      ${displayPrice.toFixed(2)}
                    </span>
                    {displayPrice !== item.unitPrice && (
                      <span className="ml-2 text-sm text-gray-500 line-through">${item.unitPrice.toFixed(2)}</span>
                    )}
                  </p>
                  {pricedProduct.onSale && pricedProduct.pricingRule && (
                    <p className="mb-2 text-xs text-green-600 font-medium">
                      🎉 {pricedProduct.pricingRule}
                    </p>
                  )}
                  {item.description && (
                    <p className="mb-3 text-sm text-gray-700 line-clamp-2" style={getCustomStyle('product-description')}>{item.description}</p>
                  )}
                </div>
                
                <div className="flex items-center gap-2 mb-3" style={getCustomStyle('quantity-controls')}>
                  <span className="text-sm font-medium">Quantity:</span>
                  <button 
                    onClick={() => handleQuantityChange(item.id, (quantities[item.id] || 1) - 1)}
                    className="px-2 py-1 bg-gray-200 rounded"
                    style={getCustomStyle('quantity-button')}
                  >
                    -
                  </button>
                  
                  <input
                    type="number"
                    min="1"
                    value={quantities[item.id] || 1}
                    onChange={(e) => handleQuantityChange(item.id, parseInt(e.target.value) || 1)}
                    className="w-12 text-center border rounded"
                    style={getCustomStyle('quantity-input')}
                  />
                  
                  <button 
                    onClick={() => handleQuantityChange(item.id, (quantities[item.id] || 1) + 1)}
                    className="px-2 py-1 bg-gray-200 rounded"
                    style={getCustomStyle('quantity-button')}
                  >
                    +
                  </button>
                </div>
                
                <button 
                  onClick={() => handleAddToCart(item)}
                  className={`w-full mt-2 px-4 py-2 ${getButtonClass(item.id)} text-white rounded`}
                  style={getCustomStyle('add-to-cart-button')}
                >
                  {getButtonText(item.id)}
                </button>
              </div>
            );
          })}
            </div>
          )}
        </div>

        {/* Right sidebar zone */}
        <div className="flex-shrink-0">
          {renderDynamicContent('storefront-sidebar-right')}
        </div>
      </div>
      
      {/* Dynamic content zone: after-products */}
      {renderDynamicContent('storefront-after-products')}
      
      {/* Product Detail Modal */}
      {selectedItem && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50" style={getCustomStyle('modal-overlay')}>
          <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto" style={getCustomStyle('modal-content')}>
            <div className="p-6">
              <div className="flex justify-between items-start mb-4">
                <h2 className="text-2xl font-bold">{selectedItem.name}</h2>
                <button 
                  onClick={closeProductDetails}
                  className="text-gray-500 hover:text-gray-700 text-2xl"
                >
                  &times;
                </button>
              </div>
              
              <div className="grid md:grid-cols-2 gap-6">
                <div>
                  {selectedItem.image_url ? (
                    <img 
                      src={selectedItem.image_url} 
                      alt={selectedItem.name} 
                      className="w-full h-auto rounded"
                    />
                  ) : (
                    <div className="bg-gray-200 h-64 flex items-center justify-center rounded">
                      <p className="text-gray-500">No image available</p>
                    </div>
                  )}
                </div>
                
                <div>
                  <p className="text-gray-600 mb-2">SKU: {selectedItem.sku}</p>
                  <p className="text-gray-600 mb-2">Category: {selectedItem.category}</p>
                  {(() => {
                    const pricedProduct = getProductPricing(selectedItem);
                    return (
                      <>
                        <p className="text-2xl font-bold mb-4">
                          <span className={pricedProduct.onSale ? 'text-green-600' : ''}>
                            ${pricedProduct.unitPrice.toFixed(2)}
                          </span>
                          {pricedProduct.unitPrice !== selectedItem.unitPrice && (
                            <span className="ml-2 text-lg text-gray-500 line-through">${selectedItem.unitPrice.toFixed(2)}</span>
                          )}
                          {pricedProduct.onSale && (
                            <span className="ml-3 bg-green-500 text-white px-2 py-1 rounded-full text-sm font-bold">
                              ON SALE
                            </span>
                          )}
                        </p>
                        {pricedProduct.onSale && pricedProduct.pricingRule && (
                          <p className="mb-4 text-sm text-green-600 font-medium bg-green-50 p-2 rounded">
                            🎉 {pricedProduct.pricingRule}
                          </p>
                        )}
                      </>
                    );
                  })()}
                  
                  {selectedItem.description && (
                    <div className="mb-6">
                      <h3 className="text-lg font-semibold mb-2">Description</h3>
                      <p className="text-gray-700">{selectedItem.description}</p>
                    </div>
                  )}
                  
                  <div className="flex items-center gap-2 mb-4">
                    <span className="text-sm font-medium">Quantity:</span>
                    <button 
                      onClick={() => handleQuantityChange(selectedItem.id, (quantities[selectedItem.id] || 1) - 1)}
                      className="px-3 py-1 bg-gray-200 rounded"
                    >
                      -
                    </button>
                    
                    <input
                      type="number"
                      min="1"
                      value={quantities[selectedItem.id] || 1}
                      onChange={(e) => handleQuantityChange(selectedItem.id, parseInt(e.target.value) || 1)}
                      className="w-16 text-center border rounded px-2 py-1"
                    />
                    
                    <button 
                      onClick={() => handleQuantityChange(selectedItem.id, (quantities[selectedItem.id] || 1) + 1)}
                      className="px-3 py-1 bg-gray-200 rounded"
                    >
                      +
                    </button>
                  </div>
                  
                  <button 
                    onClick={() => {
                      handleAddToCart(selectedItem);
                      closeProductDetails();
                    }}
                    className={`w-full mt-2 px-4 py-2 ${getButtonClass(selectedItem.id)} text-white rounded`}
                  >
                    {getButtonText(selectedItem.id)}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
