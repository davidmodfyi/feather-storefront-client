import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';

export default function Cart({ onLogout, onHome, brandName }) {
  const [cart, setCart] = useState({});
  const [distributor, setDistributor] = useState('Storefront');
  const [quantities, setQuantities] = useState({});
  const navigate = useNavigate();

  useEffect(() => {
    // Load cart from localStorage
    const savedCart = localStorage.getItem('featherStorefrontCart');
    if (savedCart) {
      try {
        const parsedCart = JSON.parse(savedCart);
        setCart(parsedCart);
        
        // Initialize quantities based on cart
        const initialQuantities = {};
        Object.keys(parsedCart).forEach(itemId => {
          initialQuantities[itemId] = parsedCart[itemId].quantity;
        });
        setQuantities(initialQuantities);
      } catch (err) {
        console.error('Error parsing saved cart:', err);
      }
    }
    
    // Fetch user info
    fetch('https://api.featherstorefront.com/api/me', { credentials: 'include' })
      .then(res => res.json())
      .then(data => setDistributor(data.distributorName || 'Storefront'))
      .catch(console.error);
  }, []);

  // Save cart to localStorage whenever it changes
  useEffect(() => {
    localStorage.setItem('featherStorefrontCart', JSON.stringify(cart));
  }, [cart]);

  function handleLogout() {
    fetch('https://api.featherstorefront.com/api/logout', { method: 'POST', credentials: 'include' })
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
    
    setCart(prevCart => {
      const updatedCart = { ...prevCart };
      
      if (quantity < 1) {
        // Remove item if quantity is zero or negative
        delete updatedCart[itemId];
      } else {
        // Update quantity
        updatedCart[itemId] = {
          ...updatedCart[itemId],
          quantity
        };
      }
      
      return updatedCart;
    });
  }

  function handleRemoveFromCart(itemId) {
    setCart(prevCart => {
      const updatedCart = { ...prevCart };
      delete updatedCart[itemId];
      return updatedCart;
    });
  }

  function calculateSubtotal() {
    return Object.values(cart).reduce((total, item) => {
      return total + (item.unitPrice * item.quantity);
    }, 0);
  }

  function getCartItemCount() {
    return Object.keys(cart).length;
  }

  const cartItems = Object.values(cart).filter(item => item.quantity > 0);
  const subtotal = calculateSubtotal();

  return (
    <div className="p-6">
      <div className="flex justify-between mb-4">
        <h1 className="text-2xl font-bold">{distributor} - My Cart</h1>
        <div className="flex gap-2">
          <button onClick={onHome} className="px-3 py-1 bg-gray-400 text-white rounded">Home</button>
          <button onClick={goToStorefront} className="px-3 py-1 bg-blue-500 text-white rounded">Continue Shopping</button>
          <button onClick={handleLogout} className="px-3 py-1 bg-red-500 text-white rounded">Logout</button>
        </div>
      </div>
      
      {cartItems.length === 0 ? (
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
          <div className="mb-4">
            <h2 className="text-lg font-semibold mb-2">Cart Summary</h2>
            <p className="text-gray-700">{getCartItemCount()} item(s) in your cart</p>
          </div>
          
          <div className="mb-6">
            {cartItems.map(item => (
              <div key={item.id} className="border p-4 rounded shadow mb-4 flex flex-col md:flex-row md:items-center md:justify-between">
                <div className="mb-3 md:mb-0">
                  <h3 className="text-lg font-bold">{item.name}</h3>
                  <p className="text-sm">SKU: {item.sku}</p>
                  <p className="text-sm">Price: ${item.unitPrice.toFixed(2)}</p>
                </div>
                
                <div className="flex flex-col md:flex-row items-start md:items-center gap-3">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">Quantity:</span>
                    <button 
                      onClick={() => handleQuantityChange(item.id, quantities[item.id] - 1)}
                      className="px-2 py-1 bg-gray-200 rounded"
                    >
                      -
                    </button>
                    
                    <input
                      type="number"
                      min="1"
                      value={quantities[item.id] || item.quantity}
                      onChange={(e) => handleQuantityChange(item.id, parseInt(e.target.value) || 1)}
                      className="w-12 text-center border rounded"
                    />
                    
                    <button 
                      onClick={() => handleQuantityChange(item.id, quantities[item.id] + 1)}
                      className="px-2 py-1 bg-gray-200 rounded"
                    >
                      +
                    </button>
                  </div>
                  
                  <div className="flex gap-2">
                    {quantities[item.id] !== item.quantity && (
                      <button 
                        onClick={() => handleUpdateCart(item.id)}
                        className="px-3 py-1 bg-blue-500 text-white rounded text-sm"
                      >
                        Update
                      </button>
                    )}
                    
                    <button 
                      onClick={() => handleRemoveFromCart(item.id)}
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
              onClick={() => alert('Checkout functionality coming soon!')}
            >
              Proceed to Checkout
            </button>
          </div>
        </>
      )}
    </div>
  );
}