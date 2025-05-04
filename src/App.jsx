import React, { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import AdminLogin from './AdminLogin';
import Storefront from './Storefront';
import Backoffice from './Backoffice';
import { useNavigate } from 'react-router-dom';

// Portal selection page component
function PortalPage({ brandName, onLogout }) {
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
        <button 
          onClick={onLogout}
          className="px-6 py-3 bg-red-500 hover:bg-red-600 text-white font-bold rounded"
        >
          Logout
        </button>
      </div>
    </div>
  );
}

function App() {
  const [loggedIn, setLoggedIn] = useState(false);
  const [brandName, setBrandName] = useState('');
  const [loading, setLoading] = useState(true);

  // Check if user is already logged in on component mount
  useEffect(() => {
    async function checkLoginStatus() {
      try {
        const res = await fetch('https://api.featherstorefront.com/api/me', {
          credentials: 'include'
        });
        
        if (res.ok) {
          const data = await res.json();
          setLoggedIn(true);
          setBrandName(data.distributorName || '');
        }
      } catch (err) {
        console.error('Error checking login status:', err);
      } finally {
        setLoading(false);
      }
    }
    
    checkLoginStatus();
  }, []);

  // Callback for successful login
  const handleLoginSuccess = () => {
    setLoggedIn(true);
    window.location.href = '/'; // Refresh the page to trigger the useEffect
  };

  // Logout handler
  const handleLogout = async () => {
    try {
      await fetch('https://api.featherstorefront.com/api/logout', {
        method: 'POST',
        credentials: 'include'
      });
    } catch (error) {
      console.error('Logout request failed:', error);
    } finally {
      setLoggedIn(false);
      setBrandName('');
      window.location.href = '/';
    }
  };

  // Function for home button
  const handleHome = () => {
    window.location.href = '/';
  };

  // Show loading spinner while checking login status
  if (loading) {
    return <div className="min-h-screen flex items-center justify-center">Loading...</div>;
  }

  // If not logged in, show login screen
  if (!loggedIn) {
    return <AdminLogin onLogin={handleLoginSuccess} />;
  }

  // If logged in, show the app with routes
  return (
    <BrowserRouter>
      <Routes>
        <Route
          path="/"
          element={<PortalPage brandName={brandName} onLogout={handleLogout} />}
        />
        <Route
          path="/storefront"
          element={<Storefront brandName={brandName} onLogout={handleLogout} onHome={handleHome} />}
        />
        <Route
          path="/backoffice"
          element={<Backoffice brandName={brandName} onLogout={handleLogout} onHome={handleHome} />}
        />
      </Routes>
    </BrowserRouter>
  );
}

export default App;