import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

function Backoffice({ brandName, onLogout }) {
  const navigate = useNavigate();
  const [accounts, setAccounts] = useState([]);

  useEffect(() => {
    // Fetch account or admin data (requires valid session)
    const fetchAccounts = async () => {
      try {
        const res = await fetch('/api/accounts', {
          credentials: 'include'
        });
        if (res.status === 401) {
          // Session invalid or expired, log out and redirect to login
          onLogout();
          return;
        }
        const data = await res.json();
        // If data is not an array or valid data, treat as unauthorized
        if (!Array.isArray(data)) {
          onLogout();
          return;
        }
        setAccounts(data);
      } catch (error) {
        console.error('Failed to fetch accounts:', error);
        // (Optional) handle fetch errors, e.g., display a message
      }
    };
    fetchAccounts();
  }, [onLogout]);

  return (
    <div className="backoffice-page">
      {/* Header with brand name and portal name */}
      <h1>{brandName} - Backoffice</h1>
      {/* Navigation buttons */}
      <div className="portal-nav">
        <button className="home-btn" onClick={() => navigate('/')}>Home</button>
        <button className="logout-btn" onClick={onLogout}>Logout</button>
      </div>

      {/* Accounts or admin data list */}
      <div className="account-list">
        {accounts.map(account => (
          <div key={account.id} className="account-card">
            <h3>{account.name}</h3>
            <p>ID: {account.id}</p>
          </div>
        ))}
        {accounts.length === 0 && (
          <p>No account data available.</p>
        )}
      </div>
    </div>
  );
}

export default Backoffice;
