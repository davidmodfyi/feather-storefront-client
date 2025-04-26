import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

function Storefront({ brandName, onLogout }) {
  const navigate = useNavigate();
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState(['All']);
  const [selectedCategory, setSelectedCategory] = useState('All');

  useEffect(() => {
    // Fetch products for the storefront (requires valid session cookie)
    const fetchProducts = async () => {
      try {
        const res = await fetch('/api/products', {
          credentials: 'include'
        });
        if (res.status === 401) {
          // Session is not valid or expired, force logout and redirect to login
          onLogout();
          return;
        }
        const data = await res.json();
        // If data is not an array (e.g., an error or empty object), treat as unauthorized
        if (!Array.isArray(data)) {
          onLogout();
          return;
        }
        // Update product list state
        setProducts(data);
        // Derive categories from products
        const cats = Array.from(new Set(data.map(p => p.category))).sort();
        setCategories(['All', ...cats]);
      } catch (error) {
        console.error('Failed to fetch products:', error);
        // Optionally handle fetch errors (e.g., network issues)
      }
    };
    fetchProducts();
  }, [onLogout]);

  // Filter products based on selected category
  const displayedProducts = selectedCategory === 'All'
    ? products
    : products.filter(p => p.category === selectedCategory);

  return (
    <div className="storefront-page">
      {/* Header with brand name and portal name */}
      <h1>{brandName} - Storefront</h1>
      {/* Navigation buttons */}
      <div className="portal-nav">
        <button className="home-btn" onClick={() => navigate('/')}>Home</button>
        <button className="logout-btn" onClick={onLogout}>Logout</button>
      </div>

      {/* Category filter buttons */}
      <div className="category-filter">
        {categories.map(cat => (
          <button
            key={cat}
            className={selectedCategory === cat ? 'active' : ''}
            onClick={() => setSelectedCategory(cat)}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Product list */}
      <div className="product-list">
        {displayedProducts.map(product => (
          <div key={product.id} className="product-card">
            <h3>{product.name}</h3>
            <p>SKU: {product.sku}</p>
            <p>Price: ${product.unitPrice}</p>
            <button>Add to Cart</button>
          </div>
        ))}
        {displayedProducts.length === 0 && (
          <p>No products available.</p>
        )}
      </div>
    </div>
  );
}

export default Storefront;
