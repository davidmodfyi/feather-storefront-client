import React, { useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import AdminLogin from './AdminLogin';
import Storefront from './Storefront';
import Backoffice from './Backoffice';
import { useNavigate } from 'react-router-dom';

// Portal selection page component (shown after login)
function PortalPage({ brandName }) {
  const navigate = useNavigate();
  return (
    <div className="portal-selection">
      <h1>{brandName || 'Feather Storefront'}</h1>
      <p>Select a portal to continue</p>
      <button onClick={() => navigate('/storefront')}>Storefront</button>
      <button onClick={() => navigate('/backoffice')}>Backoffice</button>
    </div>
  );
}

function App() {
  const [loggedIn, setLoggedIn] = useState(false);
  const [brandName, setBrandName] = useState('');

  // Callback for successful login (to be passed to AdminLogin component)
  const handleLoginSuccess = (name) => {
    // Set logged-in state and store brand name (if provided) after login
    setLoggedIn(true);
    setBrandName(name || '');
  };

  // Logout handler to destroy session and reset state
  const handleLogout = async () => {
    try {
      // Request the backend to destroy session and clear cookie
      await fetch('/api/logout', {
        method: 'POST',
        credentials: 'include'
      });
    } catch (error) {
      console.error('Logout request failed:', error);
    } finally {
      // Regardless of request success, reset app state
      setLoggedIn(false);
      setBrandName('');
    }
  };

  return (
    <BrowserRouter>
      <Routes>
        {/* Admin Login route */}
        <Route
          path="/login"
          element={
            loggedIn
              ? <Navigate to="/" replace />
              : <AdminLogin onLoginSuccess={handleLoginSuccess} />
          }
        />
        {/* Portal selection (home) route, accessible only if logged in */}
        <Route
          path="/"
          element={
            loggedIn
              ? <PortalPage brandName={brandName} />
              : <Navigate to="/login" replace />
          }
        />
        {/* Storefront route, protected */}
        <Route
          path="/storefront"
          element={
            loggedIn
              ? <Storefront brandName={brandName} onLogout={handleLogout} />
              : <Navigate to="/login" replace />
          }
        />
        {/* Backoffice route, protected */}
        <Route
          path="/backoffice"
          element={
            loggedIn
              ? <Backoffice brandName={brandName} onLogout={handleLogout} />
              : <Navigate to="/login" replace />
          }
        />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
