import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';

export default function Cart({ onLogout, onHome, brandName }) {
  const [cartItems, setCartItems] = useState([]);
  const [distributor, setDistributor] = useState('Storefront');
  const [quantities, setQuantities] = useState({});
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    // Fetch user info
    fetch('/api/me', { credentials: 'include' })
      .then(res => res.json())
      .then(data => setDistributor(data.distributorName || 'Storefront'))
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
		  if (cartItems.length === 0) {
			alert('Your cart is empty. Please add items before submitting an order.');
			return;
		  }

		  try {
			// Prepare order data
			const orderData = {
			  items: cartItems,
			  subtotal: subtotal,
			  email: "david@mod.fyi" // Hard-coded recipient email as requested
			};

			// Submit order to backend
			const response = await fetch('/api/submit-order', {
			  method: 'POST',
			  headers: { 'Content-Type': 'application/json' },
			  credentials: 'include',
			  body: JSON.stringify(orderData)
			});

			if (!response.ok) {
			  throw new Error('Failed to submit order');
			}

			const result = await response.json();
			
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

  return (
    <div className="p-6">
		<div className="flex justify-between mb-4 ml-14">
		  <h1 className="text-2xl font-bold">{distributor} - My Cart</h1>
        <div className="flex gap-2">
          <button onClick={onHome} className="px-3 py-1 bg-gray-400 text-white rounded">Home</button>
          <button onClick={goToStorefront} className="px-3 py-1 bg-blue-500 text-white rounded">Continue Shopping</button>
          <button onClick={handleLogout} className="px-3 py-1 bg-red-500 text-white rounded">Logout</button>
        </div>
      </div>
      
      {loading ? (
        <div className="text-center py-8">
          <p>Loading your cart...</p>
        </div>
      ) : cartItems.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-xl mb-4">Your cart is empty</p>
          <button 
            onClick={goToStorefront}
            className="px-4 py-2 bg-blue-500 text-white rounded"
          >
            Browse Products
          </button>
        </div>
      ) : (
        <>
          <div className="mb-4 flex justify-between items-center">
            <div>
              <h2 className="text-lg font-semibold mb-2">Cart Summary</h2>
              <p className="text-gray-700">{cartItems.length} item(s) in your cart</p>
            </div>
            <button 
              onClick={handleClearCart}
              className="px-3 py-1 bg-red-500 text-white rounded"
            >
              Clear Cart
            </button>
          </div>
          
          <div className="mb-6">
            {cartItems.map(item => (
              <div key={item.cart_item_id} className="border p-4 rounded shadow mb-4 flex flex-col md:flex-row md:items-center md:justify-between">
                <div className="mb-3 md:mb-0 flex">
                  {/* Safely display image only if it exists */}
                  {item.image_url && (
                    <div className="mr-4">
                      <img 
                        src={item.image_url} 
                        alt={item.name || 'Product'} 
                        className="w-20 h-20 object-cover rounded"
                        onError={(e) => {
                          console.log('Image failed to load:', item.image_url);
                          e.target.style.display = 'none';
                        }}
                      />
                    </div>
                  )}
                  <div>
                    <h3 className="text-lg font-bold">{item.name}</h3>
                    <p className="text-sm">SKU: {item.sku}</p>
                    <p className="text-sm">Price: ${item.unitPrice.toFixed(2)}</p>
                    {item.description && <p className="text-sm text-gray-600 mt-1">{item.description}</p>}
                  </div>
                </div>
                
                <div className="flex flex-col md:flex-row items-start md:items-center gap-3">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">Quantity:</span>
                    <button 
                      onClick={() => handleQuantityChange(item.cart_item_id, (quantities[item.cart_item_id] || item.quantity) - 1)}
                      className="px-2 py-1 bg-gray-200 rounded"
                    >
                      -
                    </button>
                    
                    <input
                      type="number"
                      min="1"
                      value={quantities[item.cart_item_id] || item.quantity}
                      onChange={(e) => handleQuantityChange(item.cart_item_id, parseInt(e.target.value) || 1)}
                      className="w-12 text-center border rounded"
                    />
                    
                    <button 
                      onClick={() => handleQuantityChange(item.cart_item_id, (quantities[item.cart_item_id] || item.quantity) + 1)}
                      className="px-2 py-1 bg-gray-200 rounded"
                    >
                      +
                    </button>
                  </div>
                  
                  <div className="flex gap-2">
                    {quantities[item.cart_item_id] !== item.quantity && (
                      <button 
                        onClick={() => handleUpdateCart(item.cart_item_id)}
                        className="px-3 py-1 bg-blue-500 text-white rounded text-sm"
                      >
                        Update
                      </button>
                    )}
                    
                    <button 
                      onClick={() => handleRemoveFromCart(item.cart_item_id)}
                      className="px-3 py-1 bg-red-500 text-white rounded text-sm"
                    >
                      Remove
                    </button>
                  </div>
                  
                  <div className="font-bold ml-0 md:ml-4 mt-2 md:mt-0">
                    ${(item.unitPrice * item.quantity).toFixed(2)}
                  </div>
                </div>
              </div>
            ))}
          </div>
          
          <div className="border-t pt-4 flex justify-between items-center">
            <div>
              <p className="text-xl font-bold">Subtotal: ${subtotal.toFixed(2)}</p>
            </div>
            
	
		<button 
		  className="px-4 py-2 bg-green-600 text-white rounded"
		  onClick={handleSubmitOrder}
		>
		  Submit Order
		</button>
          </div>
        </>
      )}
    </div>
  );
}