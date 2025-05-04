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
    <div className="min-h-screen flex flex-col items-center justify-center p-6">
      <h1 className="text-2xl font-bold mb-4">{brandName || 'Feather Storefront'}</h1>
      <p className="mb-6">Select a portal to continue</p>
      <div className="flex gap-4">
        <button 
          onClick={() => navigate('/storefront')}
          className="px-6 py-3 bg-blue-500 hover:bg-blue-600 text-white font-bold rounded"
        >
          Storefront
        </button>
        <button 
          onClick={() => navigate('/backoffice')}
          className="px-6 py-3 bg-green-500 hover:bg-green-600 text-white font-bold rounded"
        >
          Backoffice
        </button>
      </div>
    </div>
  );
}

function App() {
  const [loggedIn, setLoggedIn] = useState(false);
  const [brandName, setBrandName] = useState('');

  // Callback for successful login (to be passed to AdminLogin component)
  const handleLoginSuccess = (name) => {
    // Set logged-in state and store brand name (if provided) after login
    console.log("Login successful, brand name:", name);
    setLoggedIn(true);
    setBrandName(name || '');
  };

  // Logout handler to destroy session and reset state
  const handleLogout = async () => {
    try {
      // Request the backend to destroy session and clear cookie
      await fetch('https://api.featherstorefront.com/api/logout', {
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

  // Function for home button
  const handleHome = () => {
    // Navigate to home portal selection page
    window.location.href = '/';
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
              ? <Storefront brandName={brandName} onLogout={handleLogout} onHome={handleHome} />
              : <Navigate to="/login" replace />
          }
        />
        {/* Backoffice route, protected */}
        <Route
          path="/backoffice"
          element={
            loggedIn
              ? <Backoffice brandName={brandName} onLogout={handleLogout} onHome={handleHome} />
              : <Navigate to="/login" replace />
          }
        />
      </Routes>
    </BrowserRouter>
  );
}

export default App;