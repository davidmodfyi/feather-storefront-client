import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';

export default function Storefront({ onLogout, onHome, brandName }) {
  const [items, setItems] = useState([]);
  const [distributor, setDistributor] = useState('Storefront');
  const [categoryFilter, setCategoryFilter] = useState(null);
  const [cart, setCart] = useState({});
  const [quantities, setQuantities] = useState({});
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  // Fetch user info, items, and cart
  useEffect(() => {
    setLoading(true);
    
    // Fetch distributor name
    fetch('https://api.featherstorefront.com/api/me', { credentials: 'include' })
      .then(res => res.json())
      .then(data => setDistributor(data.distributorName || 'Storefront'))
      .catch(console.error);

    // Fetch all items
    fetch('https://api.featherstorefront.com/api/items', { credentials: 'include' })
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
  }, []);

  // Fetch cart items from the server
  const fetchCart = () => {
    fetch('https://api.featherstorefront.com/api/cart', { credentials: 'include' })
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
    fetch('https://api.featherstorefront.com/api/logout', { method: 'POST', credentials: 'include' })
      .then(() => onLogout());
  }

  function goToCart() {
    navigate('/cart');
  }

  function handleQuantityChange(itemId, newQuantity) {
    // Ensure quantity is at least 1
    newQuantity = Math.max(1, newQuantity);
    
    setQuantities(prev => ({
      ...prev,
      [itemId]: newQuantity
    }));
  }

  // Add or update cart item
  function handleAddToCart(item) {
    const quantity = quantities[item.id] || 1;
    
    fetch('https://api.featherstorefront.com/api/cart', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ 
        product_id: item.id, 
        quantity 
      })
    })
      .then(res => {
        if (!res.ok) throw new Error('Failed to update cart');
        return res.json();
      })
      .then(() => {
        // Update local cart state
        setCart(prevCart => {
          const updatedCart = { ...prevCart };
          updatedCart[item.id] = {
            ...item,
            quantity
          };
          return updatedCart;
        });
      })
      .catch(error => {
        console.error('Error updating cart:', error);
        alert('There was an error updating your cart. Please try again.');
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