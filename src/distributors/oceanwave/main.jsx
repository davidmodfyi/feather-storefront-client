// Template for src/distributors/[DISTRIBUTOR]/main.jsx
// Copy this content to each distributor's main.jsx file

import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';

// Get distributor info from global scope (set by index.html)
const distributorSlug = window.FEATHER_DISTRIBUTOR || 'default';

console.log(`Initializing Feather Storefront for: ${distributorSlug}`);

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App distributorSlug={distributorSlug} />
  </React.StrictMode>
);
