import React, { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import AdminLogin from './AdminLogin';
import Storefront from './Storefront';
import Backoffice from './Backoffice';
import BackofficeOptions from './BackofficeOptions';
import Cart from './Cart';
import OrderHistory from './OrderHistory';
import Branding from './Branding';
import { useNavigate } from 'react-router-dom';

// Header Component with Logo
function Header({ brandName }) {
  const [headerLogo, setHeaderLogo] = useState(null);
  
  useEffect(() => {
    fetch('/api/branding/header-logo', { credentials: 'include' })
      .then(res => res.json())
      .then(data => {
        console.log("Header logo full response:", JSON.stringify(data));
        if (data && data.logo) {
          setHeaderLogo(data.logo);
        }
      })
      .catch(err => console.error("Header logo error:", err));
  }, []);
  
  // Always render for testing
  return (
    <div style={{
      position: 'fixed',
      top: '10px',
      left: '10px',
      zIndex: 9999,
      border: '2px solid red',
      background: '#fff',
      padding: '5px'
    }}>
      {headerLogo ? (
        <img 
          src={headerLogo} 
          alt="Header Logo" 
          style={{ height: '40px', width: 'auto' }}
        />
      ) : (
        <span>No Logo Found</span>
      )}
    </div>
  );
}

// Portal selection page component
function PortalPage({ brandName, onLogout, userType }) {
  const navigate = useNavigate();
  const [logo, setLogo] = useState(null);
  
  useEffect(() => {
    // Fetch logo if available
    fetch('/api/branding/logo', {
      credentials: 'include'
    })
      .then(res => res.json())
      .then(data => {
        if (data.logo) {
          setLogo(data.logo);
        }
      })
      .catch(console.error);
  }, []);
  
  // Different view based on user type
  if (userType === 'Customer') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-6 relative">
        <Header brandName={brandName} />
        
        {logo ? (
          <img src={logo} alt={brandName} className="mb-4 max-h-32 object-contain" />
        ) : (
          <h1 className="text-2xl font-bold mb-4">{brandName || 'Feather Storefront'}</h1>
        )}
        <p className="mb-6">Welcome! What would you like to do?</p>
        <div className="flex gap-4">
          <button 
            onClick={() => navigate('/storefront')}
            className="px-6 py-3 bg-blue-500 hover:bg-blue-600 text-white font-bold rounded"
          >
            Storefront
          </button>
          <button 
            onClick={() => navigate('/orders')}
            className="px-6 py-3 bg-purple-500 hover:bg-purple-600 text-white font-bold rounded"
          >
            Order History
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
  
  // Default Admin view
  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 relative">
      <Header brandName={brandName} />
      
      {logo ? (
        <img src={logo} alt={brandName} className="mb-4 max-h-32 object-contain" />
      ) : (
        <h1 className="text-2xl font-bold mb-4">{brandName || 'Feather Storefront'}</h1>
      )}
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
          onClick={() => navigate('/orders')}
          className="px-6 py-3 bg-purple-500 hover:bg-purple-600 text-white font-bold rounded"
        >
          Order History
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
  const [userType, setUserType] = useState('');
  const [loading, setLoading] = useState(true);

  // Check if user is already logged in on component mount
  useEffect(() => {
    async function checkLoginStatus() {
      try {
        const res = await fetch('/api/me', {
          credentials: 'include'
        });
        
        if (res.ok) {
          const data = await res.json();
          setLoggedIn(true);
          setBrandName(data.distributorName || '');
          setUserType(data.userType || 'Admin'); // Default to Admin if not specified
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
  const handleLoginSuccess = (data) => {
    setLoggedIn(true);
    setBrandName(data.distributorName || '');
    setUserType(data.userType || 'Admin');
    window.location.href = '/'; // Refresh the page to trigger the useEffect
  };

  // Logout handler
  const handleLogout = async () => {
    try {
      await fetch('/api/logout', {
        method: 'POST',
        credentials: 'include'
      });
    } catch (error) {
      console.error('Logout request failed:', error);
    } finally {
      setLoggedIn(false);
      setBrandName('');
      setUserType('');
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
          element={<PortalPage brandName={brandName} onLogout={handleLogout} userType={userType} />}
        />
        <Route
          path="/storefront"
          element={
            <>
              <Header brandName={brandName} />
              <Storefront brandName={brandName} onLogout={handleLogout} onHome={handleHome} userType={userType} />
            </>
          }
        />
        <Route
          path="/cart"
          element={
            <>
              <Header brandName={brandName} />
              <Cart brandName={brandName} onLogout={handleLogout} onHome={handleHome} userType={userType} />
            </>
          }
        />
        {/* Protect backoffice routes from Customer users */}
        <Route
          path="/backoffice"
          element={
            userType === 'Customer' 
              ? <Navigate to="/" replace /> 
              : (
                <>
                  <Header brandName={brandName} />
                  <BackofficeOptions brandName={brandName} onLogout={handleLogout} onHome={handleHome} />
                </>
              )
          }
        />
        <Route
          path="/orders"
          element={
            <>
              <Header brandName={brandName} />
              <OrderHistory 
                brandName={brandName} 
                onLogout={handleLogout} 
                onHome={handleHome} 
                userType={userType} 
              />
            </>
          }
        />
        <Route
          path="/backoffice/customers"
          element={
            userType === 'Customer' 
              ? <Navigate to="/" replace /> 
              : (
                <>
                  <Header brandName={brandName} />
                  <Backoffice brandName={brandName} onLogout={handleLogout} onHome={handleHome} />
                </>
              )
          }
        />
        <Route
          path="/backoffice/branding"
          element={
            userType === 'Customer' 
              ? <Navigate to="/" replace /> 
              : (
                <>
                  <Header brandName={brandName} />
                  <Branding brandName={brandName} onLogout={handleLogout} onHome={handleHome} />
                </>
              )
          }
        />
        {/* Redirect any unknown routes to home */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;