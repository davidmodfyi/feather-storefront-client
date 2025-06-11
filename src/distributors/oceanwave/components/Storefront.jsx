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
      const response = await fetch('/api/logic-scripts', { credentials: 'include' });
      if (response.ok) {
        const scripts = await response.json();
        
        // Group scripts by trigger point
        const scriptsByTrigger = {};
        scripts.forEach(script => {
          if (!scriptsByTrigger[script.trigger_point]) {
            scriptsByTrigger[script.trigger_point] = [];
          }
          scriptsByTrigger[script.trigger_point].push(script);
        });
        
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
        console.log('Custom styles loaded:', data);
        setCustomStyles(data);
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
    return customStyles[elementSelector] || {};
  };

  // Apply price modifications from storefront_load scripts
const getDisplayPrice = (item) => {
  let modifiedPrice = item.unitPrice;
  
  // Execute storefront_load scripts to get price modifications
  const storefrontScripts = logicScripts['storefront_load'] || [];
  
  for (const script of storefrontScripts) {
    if (!script.active) continue;
    
    try {
      // Create execution context
      const scriptContext = {
        customer: customer,
        cart: {
          items: Object.values(cart),
          total: Object.values(cart).reduce((sum, item) => sum + (item.unitPrice * item.quantity), 0),
          subtotal: Object.values(cart).reduce((sum, item) => sum + (item.unitPrice * item.quantity), 0)
        },
        products: items,
        currentProduct: item // Add the current product to context
      };
      
      // Create function from script content
      const scriptFunction = new Function(
        'customer', 
        'cart', 
        'products', 
        'currentProduct',
        script.script_content
      );
      
      // Execute script
      const result = scriptFunction(
        scriptContext.customer, 
        scriptContext.cart, 
        scriptContext.products,
        scriptContext.currentProduct
      );
      
      // Handle price modifications
      if (result && typeof result === 'object' && result.modifyPrice !== undefined) {
        modifiedPrice = result.modifyPrice;
      }
      
    } catch (error) {
      console.error(`Error executing pricing script ${script.id}:`, error);
    }
  }
  
  return modifiedPrice;
};
	
  return (
    <div className="p-6" style={getCustomStyle('page-background')}>
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
      
      {loading ? (
        <div className="text-center py-8">
          <p>Loading products...</p>
        </div>
      ) : (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3" style={getCustomStyle('product-grid')}>
          {filteredItems.map(item => {
            const displayPrice = getDisplayPrice(item);
            return (
              <div key={item.id} className="border p-4 rounded shadow hover:shadow-md transition-shadow" style={getCustomStyle('product-card')}>
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
                    ${displayPrice.toFixed(2)}
                    {displayPrice !== item.unitPrice && (
                      <span className="ml-2 text-sm text-gray-500 line-through">${item.unitPrice.toFixed(2)}</span>
                    )}
                  </p>
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
                  <p className="text-2xl font-bold mb-4">
                    ${getDisplayPrice(selectedItem).toFixed(2)}
                    {getDisplayPrice(selectedItem) !== selectedItem.unitPrice && (
                      <span className="ml-2 text-lg text-gray-500 line-through">${selectedItem.unitPrice.toFixed(2)}</span>
                    )}
                  </p>
                  
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
