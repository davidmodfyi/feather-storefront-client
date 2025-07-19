import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';

// Get distributor info from global scope (set by index.html)
const distributorSlug = window.FEATHER_DISTRIBUTOR || 'default';

console.log(`🔵 LOADING UNIFIED main.jsx - distributorSlug: ${distributorSlug}`);
console.log('File location: src/main.jsx');
console.log('🌍 Feather Storefront with Language Translation - v1.1.0');

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App distributorSlug={distributorSlug} />
  </React.StrictMode>
);