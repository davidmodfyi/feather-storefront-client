import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';

// Custom Table Dropdown Component
const CustomTableDropdown = ({ 
  content, 
  customTableData, 
  fetchCustomTableData, 
  dynamicFormValues, 
  setDynamicFormValues, 
  currentUser 
}) => {
  const [loading, setLoading] = useState(false);
  const [options, setOptions] = useState([]);
  
  useEffect(() => {
    const loadTableData = async () => {
      const tableId = content.data.tableId;
      const displayField = content.data.displayField || 'name';
      const valueField = content.data.valueField || 'id';
      
      console.log('🔍 CustomTableDropdown loading data:', {
        tableId,
        displayField,
        valueField,
        contentData: content.data
      });
      
      if (!tableId) return;
      
      setLoading(true);
      
      // Check if we already have the data
      let tableData = customTableData[tableId];
      
      if (!tableData) {
        // Fetch the data
        tableData = await fetchCustomTableData(tableId);
      }
      
      console.log('📊 Raw table data:', tableData);
      
      if (tableData && tableData.data) {
        // Convert table data to dropdown options with intelligent fallbacks
        const dropdownOptions = tableData.data.map(row => {
          console.log('🔄 Processing row:', row);
          
          // Try to find the best display value using fallback logic
          let displayValue = row[displayField];
          if (!displayValue) {
            // Fallback: try common field names
            const commonFields = ['name', 'title', 'description', 'method', 'option', 'label', 'type'];
            for (const field of commonFields) {
              if (row[field]) {
                displayValue = row[field];
                console.log(`🔄 Using fallback field '${field}' for display:`, displayValue);
                break;
              }
            }
          }
          
          // Final fallback: use first non-id, non-account_id field
          if (!displayValue) {
            const availableFields = Object.keys(row).filter(key => 
              key !== 'id' && key !== 'account_id' && key !== 'created_at'
            );
            if (availableFields.length > 0) {
              displayValue = row[availableFields[0]];
              console.log(`🔄 Using first available field '${availableFields[0]}' for display:`, displayValue);
            }
          }
          
          return {
            value: row[valueField] || row.id,
            label: displayValue || `Row ${row.id}`
          };
        });
        console.log('📋 Dropdown options generated:', dropdownOptions);
        setOptions(dropdownOptions);
      } else {
        console.log('⚠️ No table data found or data is empty');
      }
      
      setLoading(false);
    };
    
    loadTableData();
  }, [content.data.tableId, customTableData, fetchCustomTableData]);
  
  if (loading) {
    return (
      <div style={content.data.containerStyle || {marginBottom: '1rem'}} className="dynamic-form-field">
        <label style={content.data.labelStyle || {fontWeight: 'bold', marginBottom: '0.5rem', display: 'block'}}>
          {content.data.label}
        </label>
        <div style={{padding: '0.5rem', border: '1px solid #ccc', borderRadius: '4px', width: '100%'}}>
          Loading...
        </div>
      </div>
    );
  }
  
  return (
    <div style={content.data.containerStyle || {marginBottom: '1rem'}} className="dynamic-form-field">
      <label style={content.data.labelStyle || {fontWeight: 'bold', marginBottom: '0.5rem', display: 'block'}}>
        {content.data.label}
      </label>
      <select 
        style={content.data.inputStyle || {padding: '0.5rem', border: '1px solid #ccc', borderRadius: '4px', width: '100%'}}
        name={content.data.label}
        value={dynamicFormValues[content.data.label] || ''}
        onChange={(e) => setDynamicFormValues(prev => ({
          ...prev,
          [content.data.label]: e.target.value
        }))}
      >
        <option value="">Select {content.data.label}</option>
        {options.map((option, i) => (
          <option key={i} value={option.value}>{option.label}</option>
        ))}
      </select>
    </div>
  );
};

export default function Cart({ onLogout, onHome, brandName }) {
  const [cartItems, setCartItems] = useState([]);
  const [distributor, setDistributor] = useState('Storefront');
  const [quantities, setQuantities] = useState({});
  const [loading, setLoading] = useState(true);
  const [customStyles, setCustomStyles] = useState({});
  const [dynamicContent, setDynamicContent] = useState({});
  const [dynamicFormValues, setDynamicFormValues] = useState({});
  const [customTableData, setCustomTableData] = useState({});
  const [currentUser, setCurrentUser] = useState({});
  const navigate = useNavigate();

 
  useEffect(() => {
    // Fetch user info
    fetch('/api/me', { credentials: 'include' })
      .then(res => res.json())
      .then(data => {
        setDistributor(data.distributorName || 'Storefront');
        setCurrentUser(data);
      })
      .catch(console.error);

    // Fetch custom styles
    fetch('/api/styles', { credentials: 'include' })
      .then(res => res.json())
      .then(data => {
        console.log('Cart custom styles loaded:', data);
        setCustomStyles(data);
      })
      .catch(console.error);

    // Fetch dynamic content
    fetch('/api/dynamic-content', { credentials: 'include' })
      .then(res => res.json())
      .then(data => {
        console.log('Cart dynamic content loaded:', data);
        setDynamicContent(data);
      })
      .catch(console.error);
    
    // Fetch cart items
    fetchCart();
  }, []);

useEffect(() => {
  document.title = `${distributor} - Cart`;
}, [distributor]);

  // Fetch cart items from the server
  const fetchCart = () => {
    setLoading(true);
    fetch('/api/cart', { credentials: 'include' })
      .then(res => {
        if (!res.ok) throw new Error('Failed to fetch cart');
        return res.json();
      })
      .then(data => {
        console.log('Cart data received:', data);
        setCartItems(data);
        
        // Initialize quantities state based on cart items
        const initialQuantities = {};
        data.forEach(item => {
          initialQuantities[item.cart_item_id] = item.quantity;
        });
        setQuantities(initialQuantities);
        
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

  function goToStorefront() {
    navigate('/storefront');
  }

  function handleQuantityChange(itemId, newQuantity) {
    // Ensure quantity is at least 1
    newQuantity = Math.max(1, newQuantity);
    
    setQuantities(prev => ({
      ...prev,
      [itemId]: newQuantity
    }));
  }

  function handleUpdateCart(itemId) {
    const quantity = quantities[itemId] || 1;
    
    fetch(`/api/cart/${itemId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ quantity })
    })
      .then(res => {
        if (!res.ok) throw new Error('Failed to update cart');
        return res.json();
      })
      .then(() => {
        // Update local state
        setCartItems(prevItems => {
          return prevItems.map(item => {
            if (item.cart_item_id === itemId) {
              return { ...item, quantity };
            }
            return item;
          });
        });
      })
      .catch(error => {
        console.error('Error updating cart:', error);
        alert('There was an error updating your cart. Please try again.');
      });
  }

  function handleRemoveFromCart(itemId) {
    fetch(`/api/cart/${itemId}`, {
      method: 'DELETE',
      credentials: 'include'
    })
      .then(res => {
        if (!res.ok) throw new Error('Failed to remove item from cart');
        return res.json();
      })
      .then(() => {
        // Update local state
        setCartItems(prevItems => prevItems.filter(item => item.cart_item_id !== itemId));
      })
      .catch(error => {
        console.error('Error removing item from cart:', error);
        alert('There was an error removing the item from your cart. Please try again.');
      });
  }

  function handleClearCart() {
    if (!window.confirm('Are you sure you want to clear your cart?')) {
      return;
    }
    
    fetch('/api/cart', {
      method: 'DELETE',
      credentials: 'include'
    })
      .then(res => {
        if (!res.ok) throw new Error('Failed to clear cart');
        return res.json();
      })
      .then(() => {
        setCartItems([]);
      })
      .catch(error => {
        console.error('Error clearing cart:', error);
        alert('There was an error clearing your cart. Please try again.');
      });
  }

const handleSubmitOrder = async () => {
  console.log('🚀 ORDER SUBMISSION STARTED');
  
  if (cartItems.length === 0) {
    alert('Your cart is empty. Please add items before submitting an order.');
    return;
  }

  console.log('📝 Current dynamicFormValues:', dynamicFormValues);
  console.log('📋 Current dynamicContent:', dynamicContent);

  // Validate required dynamic form fields
  const requiredFields = [];
  Object.entries(dynamicContent).forEach(([zone, content]) => {
    content.forEach(item => {
      if (item.type === 'form-field' && item.data.required) {
        requiredFields.push(item.data.label);
      }
    });
  });

  console.log('📋 Found required fields:', requiredFields);

  // Check if any required fields are empty
  for (const fieldLabel of requiredFields) {
    if (!dynamicFormValues[fieldLabel] || dynamicFormValues[fieldLabel].trim() === '') {
      console.log(`❌ VALIDATION FAILED: ${fieldLabel} is empty`);
      alert(`Please select/enter a value for ${fieldLabel} before submitting your order.`);
      return;
    }
  }

  // Special case: if there's an OrderType field, make it required regardless of backend setting
  // This is a temporary fix until the validation rules are properly configured
  const hasOrderType = Object.entries(dynamicContent).some(([zone, content]) => 
    content.some(item => item.type === 'form-field' && item.data.label.toLowerCase().includes('ordertype'))
  );
  
  console.log('🔍 OrderType field exists:', hasOrderType);
  if (hasOrderType) {
    console.log('📝 OrderType value:', dynamicFormValues['OrderType']);
  }
  
  if (hasOrderType && (!dynamicFormValues['OrderType'] || dynamicFormValues['OrderType'].trim() === '')) {
    console.log('❌ ORDERTYPE VALIDATION FAILED: Field is empty');
    alert('Please select an OrderType before submitting your order.');
    return;
  }

  console.log('✅ ALL FRONTEND VALIDATION PASSED');

  try {
    // Prepare order data with dynamic form values
    console.log('Dynamic form values at submit:', dynamicFormValues);
    
	const orderData = { 
	  items: cartItems, 
	  total: subtotal,      // For the validation script
	  subtotal: subtotal,   // In case something else needs it
	  email: "david@mod.fyi",
	  dynamicFormValues: dynamicFormValues  // Include form field values
	};

    // Submit order to backend
    const response = await fetch('/api/submit-order', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(orderData)
    });

    const result = await response.json();

    if (!response.ok) {
      // Show the actual error message from the server
      alert(result.error || 'Failed to submit order');
      return;
    }
    
    if (result.success) {
      alert('Your order has been submitted successfully! A confirmation email has been sent.');
      // Clear cart after successful order
      handleClearCart();
    } else {
      alert(`Error: ${result.error}`);
    }
  } catch (error) {
    console.error('Error submitting order:', error);
    alert('There was an error submitting your order. Please try again.');
  }
};

  function calculateSubtotal() {
    return cartItems.reduce((total, item) => {
      return total + (item.unitPrice * item.quantity);
    }, 0);
  }

  const subtotal = calculateSubtotal();

  const getCustomStyle = (elementSelector) => {
    return customStyles[elementSelector] || {};
  };

  // Fetch custom table data
  const fetchCustomTableData = async (tableId) => {
    try {
      const accountId = currentUser.accountId;
      const url = accountId 
        ? `/api/custom-tables/${tableId}/data?account_id=${accountId}`
        : `/api/custom-tables/${tableId}/data`;
      
      console.log('🔍 Fetching custom table data:', {
        tableId,
        accountId,
        url,
        currentUser
      });
      
      const response = await fetch(url, { credentials: 'include' });
      if (response.ok) {
        const data = await response.json();
        console.log('✅ Custom table data received:', data);
        setCustomTableData(prev => ({
          ...prev,
          [tableId]: data
        }));
        return data;
      } else {
        console.error('❌ Failed to fetch custom table data:', response.status, await response.text());
      }
    } catch (error) {
      console.error('❌ Error fetching custom table data:', error);
    }
    return null;
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
            <div key={content.id || index} style={content.data.containerStyle || {marginBottom: '1rem'}} className="dynamic-form-field">
              <label style={content.data.labelStyle || {fontWeight: 'bold', marginBottom: '0.5rem', display: 'block'}}>{content.data.label}</label>
              <select 
                style={content.data.inputStyle || {padding: '0.5rem', border: '1px solid #ccc', borderRadius: '4px', width: '100%'}}
                name={content.data.label}
                value={dynamicFormValues[content.data.label] || ''}
                onChange={(e) => setDynamicFormValues(prev => ({
                  ...prev,
                  [content.data.label]: e.target.value
                }))}
              >
                <option value="">Select {content.data.label}</option>
                {content.data.options && content.data.options.map((option, i) => (
                  <option key={i} value={option}>{option}</option>
                ))}
              </select>
            </div>
          );
        } else if (content.data.fieldType === 'text') {
          return (
            <div key={content.id || index} style={content.data.containerStyle || {marginBottom: '1rem'}} className="dynamic-form-field">
              <label style={content.data.labelStyle || {fontWeight: 'bold', marginBottom: '0.5rem', display: 'block'}}>{content.data.label}</label>
              <input 
                type="text"
                style={content.data.inputStyle || {padding: '0.5rem', border: '1px solid #ccc', borderRadius: '4px', width: '100%'}}
                name={content.data.label}
                value={dynamicFormValues[content.data.label] || ''}
                onChange={(e) => setDynamicFormValues(prev => ({
                  ...prev,
                  [content.data.label]: e.target.value
                }))}
                placeholder={content.data.placeholder || `Enter ${content.data.label}`}
              />
            </div>
          );
        }
      } else if (content.type === 'custom-table-dropdown') {
        return (
          <CustomTableDropdown
            key={content.id || index}
            content={content}
            customTableData={customTableData}
            fetchCustomTableData={fetchCustomTableData}
            dynamicFormValues={dynamicFormValues}
            setDynamicFormValues={setDynamicFormValues}
            currentUser={currentUser}
          />
        );
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

  return (
    <div className="p-6" style={getCustomStyle('cart-page-background')}>
      {/* Dynamic content zone: header-top */}
      {renderDynamicContent('cart-header-top')}

		<div className="flex justify-between mb-4 ml-14" style={getCustomStyle('cart-header-nav')}>
		  <h1 className="text-2xl font-bold" style={getCustomStyle('cart-page-title')}>{distributor} - My Cart</h1>
        <div className="flex gap-2">
          <button onClick={onHome} className="px-3 py-1 bg-gray-400 text-white rounded" style={getCustomStyle('cart-home-button')}>Home</button>
          <button onClick={goToStorefront} className="px-3 py-1 bg-blue-500 text-white rounded" style={getCustomStyle('cart-continue-shopping-button')}>Continue Shopping</button>
          <button onClick={handleLogout} className="px-3 py-1 bg-red-500 text-white rounded" style={getCustomStyle('cart-logout-button')}>Logout</button>
        </div>
      </div>

      {/* Dynamic content zone: header-bottom */}
      {renderDynamicContent('cart-header-bottom')}
      
      {loading ? (
        <div className="text-center py-8" style={getCustomStyle('cart-loading-container')}>
          <p style={getCustomStyle('cart-loading-text')}>Loading your cart...</p>
        </div>
      ) : cartItems.length === 0 ? (
        <div className="text-center py-12" style={getCustomStyle('cart-empty-container')}>
          <p className="text-xl mb-4" style={getCustomStyle('cart-empty-text')}>Your cart is empty</p>
          <button 
            onClick={goToStorefront}
            className="px-4 py-2 bg-blue-500 text-white rounded"
            style={getCustomStyle('cart-browse-products-button')}
          >
            Browse Products
          </button>
        </div>
      ) : (
        <>
          <div className="flex gap-6">
            {/* Left sidebar zone */}
            <div className="flex-shrink-0">
              {renderDynamicContent('cart-sidebar-left')}
            </div>

            {/* Main cart content */}
            <div className="flex-1">
              <div className="mb-4 flex justify-between items-center" style={getCustomStyle('cart-summary-container')}>
                <div>
                  <h2 className="text-lg font-semibold mb-2" style={getCustomStyle('cart-summary-title')}>Cart Summary</h2>
                  <p className="text-gray-700" style={getCustomStyle('cart-summary-text')}>{cartItems.length} item(s) in your cart</p>
                </div>
                <button 
                  onClick={handleClearCart}
                  className="px-3 py-1 bg-red-500 text-white rounded"
                  style={getCustomStyle('cart-clear-button')}
                >
                  Clear Cart
                </button>
              </div>
              
              {/* Dynamic content zone: before-items */}
              {renderDynamicContent('cart-before-items')}
              
              <div className="mb-6" style={getCustomStyle('cart-items-container')}>
                {cartItems.map(item => (
              <div key={item.cart_item_id} className="border p-4 rounded shadow mb-4 flex flex-col md:flex-row md:items-center md:justify-between" style={getCustomStyle('cart-item-card')}>
                <div className="mb-3 md:mb-0 flex">
                  {/* Safely display image only if it exists */}
                  {item.image_url && (
                    <div className="mr-4" style={getCustomStyle('cart-item-image-container')}>
                      <img 
                        src={item.image_url} 
                        alt={item.name || 'Product'} 
                        className="w-20 h-20 object-cover rounded"
                        style={getCustomStyle('cart-item-image')}
                        onError={(e) => {
                          console.log('Image failed to load:', item.image_url);
                          e.target.style.display = 'none';
                        }}
                      />
                    </div>
                  )}
                  <div style={getCustomStyle('cart-item-details')}>
                    <h3 className="text-lg font-bold" style={getCustomStyle('cart-item-name')}>{item.name}</h3>
                    <p className="text-sm" style={getCustomStyle('cart-item-sku')}>SKU: {item.sku}</p>
                    <p className="text-sm" style={getCustomStyle('cart-item-price')}>Price: ${item.unitPrice.toFixed(2)}</p>
                    {item.description && <p className="text-sm text-gray-600 mt-1" style={getCustomStyle('cart-item-description')}>{item.description}</p>}
                  </div>
                </div>
                
                <div className="flex flex-col md:flex-row items-start md:items-center gap-3" style={getCustomStyle('cart-item-controls')}>
                  <div className="flex items-center gap-3" style={getCustomStyle('cart-quantity-controls')}>
                    <span className="text-sm font-medium" style={getCustomStyle('cart-quantity-label')}>Quantity:</span>
                    {/* Clean quantity selector for cart */}
                    <div className="flex items-center border border-gray-300 rounded-md bg-white h-9">
                      <button 
                        onClick={() => handleQuantityChange(item.cart_item_id, (quantities[item.cart_item_id] || item.quantity) - 1)}
                        className="w-8 h-9 flex items-center justify-center text-gray-600 hover:text-gray-800 hover:bg-gray-50 border-r border-gray-300"
                        style={getCustomStyle('cart-quantity-button')}
                      >
                        −
                      </button>
                      
                      <input
                        type="number"
                        min="1"
                        value={quantities[item.cart_item_id] || item.quantity}
                        onChange={(e) => handleQuantityChange(item.cart_item_id, parseInt(e.target.value) || 1)}
                        className="w-12 h-9 text-center font-bold border-0 bg-transparent focus:outline-none focus:ring-0 quantity-input-custom"
                        style={{
                          ...getCustomStyle('cart-quantity-input'),
                          WebkitAppearance: 'none',
                          MozAppearance: 'textfield'
                        }}
                      />
                      
                      <button 
                        onClick={() => handleQuantityChange(item.cart_item_id, (quantities[item.cart_item_id] || item.quantity) + 1)}
                        className="w-8 h-9 flex items-center justify-center text-gray-600 hover:text-gray-800 hover:bg-gray-50 border-l border-gray-300"
                        style={getCustomStyle('cart-quantity-button')}
                      >
                        +
                      </button>
                    </div>
                  </div>
                  
                  <div className="flex gap-2" style={getCustomStyle('cart-item-actions')}>
                    {quantities[item.cart_item_id] !== item.quantity && (
                      <button 
                        onClick={() => handleUpdateCart(item.cart_item_id)}
                        className="px-3 py-1 bg-blue-500 text-white rounded text-sm"
                        style={getCustomStyle('cart-update-button')}
                      >
                        Update
                      </button>
                    )}
                    
                    <button 
                      onClick={() => handleRemoveFromCart(item.cart_item_id)}
                      className="px-3 py-1 bg-red-500 text-white rounded text-sm"
                      style={getCustomStyle('cart-remove-button')}
                    >
                      Remove
                    </button>
                  </div>
                  
                  <div className="font-bold ml-0 md:ml-4 mt-2 md:mt-0" style={getCustomStyle('cart-item-total')}>
                    ${(item.unitPrice * item.quantity).toFixed(2)}
                  </div>
                </div>
              </div>
            ))}
              </div>
              
              {/* Dynamic content zone: after-items */}
              {renderDynamicContent('cart-after-items')}
              
              {/* Dynamic content zone: before-total */}
              {renderDynamicContent('cart-before-total')}
              
              <div className="border-t pt-4 flex justify-between items-center" style={getCustomStyle('cart-total-container')}>
                <div>
                  <p className="text-xl font-bold" style={getCustomStyle('cart-subtotal')}>Subtotal: ${subtotal.toFixed(2)}</p>
                </div>
                
            
            <button 
              className="px-4 py-2 bg-green-600 text-white rounded"
              onClick={handleSubmitOrder}
              style={getCustomStyle('cart-submit-order-button')}
            >
              Submit Order
            </button>
              </div>
              
              {/* Dynamic content zone: after-total */}
              {renderDynamicContent('cart-after-total')}
            </div>

            {/* Right sidebar zone */}
            <div className="flex-shrink-0">
              {renderDynamicContent('cart-sidebar-right')}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
