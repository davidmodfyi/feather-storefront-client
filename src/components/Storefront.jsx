import { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import CustomerHeader from './CustomerHeader';

export default function Storefront({ onLogout, onHome, brandName }) {
  const [items, setItems] = useState([]);
  const [distributor, setDistributor] = useState('Storefront');
  const [categoryFilter, setCategoryFilter] = useState(null);
  const [cart, setCart] = useState({});
  const [quantities, setQuantities] = useState({});
  const [loading, setLoading] = useState(true);
  const [selectedItem, setSelectedItem] = useState(null);
  const navigate = useNavigate();
  const location = useLocation();
  const [searchQuery, setSearchQuery] = useState("");
  const [headerLogo, setHeaderLogo] = useState(null);
  const [customStyles, setCustomStyles] = useState({});
  const [logicScripts, setLogicScripts] = useState({});
  const [customer, setCustomer] = useState({});
  const [dynamicContent, setDynamicContent] = useState({});
  const [realtimePricing, setRealtimePricing] = useState({});
  const [refreshCartCount, setRefreshCartCount] = useState(null);

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

  // Update real-time pricing for a specific item
  const updateRealtimePricing = async (itemId, newQuantity) => {
    try {
      console.log('🔄 Calculating real-time pricing for item:', itemId, 'quantity:', newQuantity);
      
      const response = await fetch('/api/calculate-pricing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          items: [{ product_id: itemId, quantity: newQuantity }]
        })
      });
      
      if (response.ok) {
        const data = await response.json();
        console.log('💰 Real-time pricing response:', data);
        
        if (data.success && data.items && data.items.length > 0) {
          const pricedItem = data.items[0];
          
          // Update the real-time pricing state
          setRealtimePricing(prev => ({
            ...prev,
            [itemId]: {
              unitPrice: pricedItem.unitPrice,
              originalPrice: pricedItem.originalPrice,
              onSale: pricedItem.onSale,
              pricingRule: pricedItem.pricingRule,
              quantity: newQuantity
            }
          }));
          
          console.log('✅ Real-time pricing updated for', itemId, ':', pricedItem.unitPrice);
        }
      } else {
        console.error('Failed to calculate real-time pricing:', response.status);
      }
    } catch (error) {
      console.error('Error calculating real-time pricing:', error);
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
        
        // Initialize quantities for all items to 1, but this will be overridden by cart data
        const initialQuantities = {};
        data.forEach(item => {
          initialQuantities[item.id] = 1;
        });
        setQuantities(initialQuantities);
        
        // Fetch cart items AFTER setting initial quantities
        fetchCart();
      })
      .catch(console.error);
    
    // Fetch logic scripts
    fetchLogicScripts();
  }, []);

  // Execute storefront_load scripts when component is ready
  useEffect(() => {
    if (!loading && items.length > 0) {
      executeLogicScripts('storefront_load');
    }
  }, [loading, items, logicScripts]);

  // Refresh cart data when returning to storefront (for "Continue Shopping" scenario)
  useEffect(() => {
    console.log('🔄 Storefront component effect triggered, refreshing cart...');
    fetchCart();
  }, [location?.pathname]); // Dependency on location path to trigger when navigating back

  
  useEffect(() => {
    document.title = `${distributor} - Storefront`;
  }, [distributor]);
  
  // Fetch cart items from the server
  const fetchCart = () => {
    console.log('🛒 Fetching cart data...');
    fetch('/api/cart', { credentials: 'include' })
      .then(res => {
        if (!res.ok) throw new Error('Failed to fetch cart');
        return res.json();
      })
      .then(data => {
        console.log('🛒 Cart data received:', data);
        
        // Convert array to object with product_id as key
        const cartObj = {};
        const cartQuantities = {};
        
        data.forEach(item => {
          cartObj[item.id] = {
            ...item,
            quantity: item.quantity
          };
          cartQuantities[item.id] = item.quantity;
        });
        
        console.log('🛒 Cart quantities to apply:', cartQuantities);
        
        // Update quantities state to match cart - use setQuantities with a function to ensure we get the current state
        setQuantities(prev => {
          const newQuantities = { ...prev, ...cartQuantities };
          console.log('🛒 Updated quantities state:', newQuantities);
          return newQuantities;
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
      
      // Call real-time pricing API to update prices immediately
      await updateRealtimePricing(itemId, newQuantity);
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
        
        // Refresh cart count in header
        if (refreshCartCount) {
          refreshCartCount();
        }
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
    
    // Default styles for product content - center-aligned by default
    const defaultStyles = {
      'product-title': { textAlign: 'center' },
      'product-sku': { textAlign: 'center' },
      'product-price': { textAlign: 'center' },
      'product-description': { textAlign: 'center' },
      'product-category': { textAlign: 'center' },
      'product-description-title': { textAlign: 'center' },
      'quantity-input': { 
        textAlign: 'center', 
        fontWeight: 'bold',
        WebkitAppearance: 'none',
        MozAppearance: 'textfield'
      },
      'cart-quantity-input': { 
        textAlign: 'center', 
        fontWeight: 'bold',
        WebkitAppearance: 'none',
        MozAppearance: 'textfield'
      }
    };
    
    // Custom styles override defaults (AI Assistant functionality preserved)
    const customStyle = customStyles[elementSelector] || {};
    const defaultStyle = defaultStyles[elementSelector] || {};
    
    // Merge default with custom (custom takes precedence)
    return { ...defaultStyle, ...customStyle };
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

  // Products have pricing applied by backend, but check if we need sale indicators
const getProductPricing = (item) => {
  console.log('🔍 Product already priced by backend:', item.sku, 'price:', item.unitPrice);
  
  // Check if we have real-time pricing for this item
  const realtimePrice = realtimePricing[item.id];
  if (realtimePrice && realtimePrice.quantity === (quantities[item.id] || 1)) {
    console.log('⚡ Using real-time pricing for', item.sku, ':', realtimePrice);
    return {
      ...item,
      unitPrice: realtimePrice.unitPrice,
      originalPrice: realtimePrice.originalPrice || item.unitPrice,
      onSale: realtimePrice.onSale,
      pricingRule: realtimePrice.pricingRule
    };
  }
  
  // If backend already set sale indicators, use them
  if (item.onSale !== undefined || item.pricingRule !== undefined || item.originalPrice !== undefined) {
    console.log('🎯 Backend provided sale indicators:', {
      onSale: item.onSale,
      pricingRule: item.pricingRule,
      originalPrice: item.originalPrice
    });
    return item;
  }
  
  // If no sale indicators but price seems modified (for backward compatibility)
  // Note: This is a simple heuristic - backend should ideally provide sale indicators
  return item;
};

// Convenience function for backward compatibility
const getDisplayPrice = (item) => {
  return item.unitPrice;
};
	
  return (
    <div className="min-h-screen bg-gray-50">
      <CustomerHeader 
        brandName={brandName} 
        onLogout={onLogout} 
        onHome={onHome} 
        onCartCountChange={setRefreshCartCount}
      />
      
      <div className="p-6" style={getCustomStyle('page-background')}>
        {/* Dynamic content zone: header-top */}
        {renderDynamicContent('storefront-header-top')}
        
        <div className="mb-4">
          <h1 className="text-2xl font-bold">{distributor} - Storefront</h1>
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
              <div key={item.id} className="border p-4 rounded shadow hover:shadow-md transition-shadow relative flex flex-col h-full" style={getCustomStyle('product-card')}>
                {/* Sale Badge */}
                {pricedProduct.onSale && (
                  <div className="absolute top-2 right-2 bg-green-500 text-white px-2 py-1 rounded-full text-xs font-bold z-10">
                    SALE
                  </div>
                )}
                
                {/* Content that can grow */}
                <div className="flex-1 cursor-pointer" onClick={() => openProductDetails(item)}>
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
                  
                  {/* Price row with inline sale text */}
                  <div className="mb-3">
                    <div className="text-lg font-semibold text-center" style={getCustomStyle('product-price')}>
                      <span className={pricedProduct.onSale ? 'text-green-600 font-bold' : ''}>
                        ${displayPrice.toFixed(2)}
                      </span>
                      {pricedProduct.originalPrice && pricedProduct.originalPrice !== displayPrice && (
                        <span className="ml-2 text-sm text-gray-500 line-through">${pricedProduct.originalPrice.toFixed(2)}</span>
                      )}
                    </div>
                    {pricedProduct.onSale && pricedProduct.pricingRule && (
                      <p className="text-xs text-green-600 font-medium text-left mt-1">
                        🎉 {pricedProduct.pricingRule}
                      </p>
                    )}
                  </div>
                  
                  {item.description && (
                    <p className="mb-3 text-sm text-gray-700 line-clamp-2" style={getCustomStyle('product-description')}>{item.description}</p>
                  )}
                </div>
                
                {/* Centered quantity selector and Add to Cart button on same line */}
                <div className="flex items-center justify-center mt-3">
                  {/* Clean quantity selector */}
                  <div className="flex items-center border border-gray-300 rounded-l-md bg-white h-9">
                    <button 
                      onClick={() => handleQuantityChange(item.id, (quantities[item.id] || 1) - 1)}
                      className="w-8 h-9 flex items-center justify-center text-gray-600 hover:text-gray-800 hover:bg-gray-50 border-r border-gray-300"
                      style={getCustomStyle('quantity-button')}
                    >
                      −
                    </button>
                    
                    <input
                      type="number"
                      min="1"
                      value={quantities[item.id] || 1}
                      onChange={(e) => handleQuantityChange(item.id, parseInt(e.target.value) || 1)}
                      className="w-12 h-9 text-center font-bold border-0 bg-transparent focus:outline-none focus:ring-0 quantity-input-custom"
                      style={{
                        ...getCustomStyle('quantity-input'),
                        WebkitAppearance: 'none',
                        MozAppearance: 'textfield',
                        appearance: 'none',
                        textAlign: 'center',
                        paddingLeft: '0px',
                        paddingRight: '0px',
                        margin: '0px',
                        lineHeight: '1',
                        fontSize: '14px'
                      }}
                      onWheel={(e) => e.preventDefault()}
                    />
                    
                    <button 
                      onClick={() => handleQuantityChange(item.id, (quantities[item.id] || 1) + 1)}
                      className="w-8 h-9 flex items-center justify-center text-gray-600 hover:text-gray-800 hover:bg-gray-50 border-l border-gray-300"
                      style={getCustomStyle('quantity-button')}
                    >
                      +
                    </button>
                  </div>
                  
                  {/* Add to Cart button touching the quantity selector */}
                  <button 
                    onClick={() => handleAddToCart(item)}
                    className={`px-3 h-9 text-sm text-white rounded-r-md flex items-center justify-center ${
                      !isItemInCart(item.id) ? 'bg-black hover:bg-gray-800' : 
                      cart[item.id]?.quantity !== (quantities[item.id] || 1) ? 'bg-yellow-600 hover:bg-yellow-700' : 
                      'bg-blue-600 hover:bg-blue-700'
                    }`}
                    style={getCustomStyle('add-to-cart-button')}
                  >
                    {getButtonText(item.id)}
                  </button>
                </div>
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
                  <p className="text-gray-600 mb-2" style={getCustomStyle('product-sku')}>SKU: {selectedItem.sku}</p>
                  <p className="text-gray-600 mb-2" style={getCustomStyle('product-category')}>Category: {selectedItem.category}</p>
                  {(() => {
                    const pricedProduct = getProductPricing(selectedItem);
                    return (
                      <>
                        <p className="text-2xl font-bold mb-4" style={getCustomStyle('product-price')}>
                          <span className={pricedProduct.onSale ? 'text-green-600' : ''}>
                            ${pricedProduct.unitPrice.toFixed(2)}
                          </span>
                          {pricedProduct.originalPrice && pricedProduct.originalPrice !== pricedProduct.unitPrice && (
                            <span className="ml-2 text-lg text-gray-500 line-through">${pricedProduct.originalPrice.toFixed(2)}</span>
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
                      <h3 className="text-lg font-semibold mb-2" style={getCustomStyle('product-description-title')}>Description</h3>
                      <p className="text-gray-700" style={getCustomStyle('product-description')}>{selectedItem.description}</p>
                    </div>
                  )}
                  
                  <div className="flex items-center gap-3 mb-4">
                    <span className="text-sm font-medium">Quantity:</span>
                    {/* Clean quantity selector for modal */}
                    <div className="flex items-center border border-gray-300 rounded-l-md bg-white h-9">
                      <button 
                        onClick={() => handleQuantityChange(selectedItem.id, (quantities[selectedItem.id] || 1) - 1)}
                        className="w-8 h-9 flex items-center justify-center text-gray-600 hover:text-gray-800 hover:bg-gray-50 border-r border-gray-300"
                      >
                        −
                      </button>
                      
                      <input
                        type="number"
                        min="1"
                        value={quantities[selectedItem.id] || 1}
                        onChange={(e) => handleQuantityChange(selectedItem.id, parseInt(e.target.value) || 1)}
                        className="w-12 h-9 text-center font-bold border-0 bg-transparent focus:outline-none focus:ring-0 quantity-input-custom"
                        style={{
                          WebkitAppearance: 'none',
                          MozAppearance: 'textfield'
                        }}
                      />
                      
                      <button 
                        onClick={() => handleQuantityChange(selectedItem.id, (quantities[selectedItem.id] || 1) + 1)}
                        className="w-8 h-9 flex items-center justify-center text-gray-600 hover:text-gray-800 hover:bg-gray-50 border-l border-gray-300"
                      >
                        +
                      </button>
                    </div>
                    
                    {/* Add to Cart button touching the quantity selector in modal */}
                    <button 
                      onClick={() => {
                        handleAddToCart(selectedItem);
                        closeProductDetails();
                      }}
                      className={`px-3 h-9 text-sm text-white rounded-r-md flex items-center justify-center ${
                        !isItemInCart(selectedItem.id) ? 'bg-black hover:bg-gray-800' : 
                        cart[selectedItem.id]?.quantity !== (quantities[selectedItem.id] || 1) ? 'bg-yellow-600 hover:bg-yellow-700' : 
                        'bg-blue-600 hover:bg-blue-700'
                      }`}
                    >
                      {getButtonText(selectedItem.id)}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
      </div>
    </div>
  );
}
