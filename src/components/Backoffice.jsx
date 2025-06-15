import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

export default function Backoffice({ onLogout, onHome, brandName }) {
  // Set title directly at component level
  document.title = brandName ? `${brandName} - Customers` : 'Customers - Feather';
  
  const [accounts, setAccounts] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [connectedAccounts, setConnectedAccounts] = useState({});
  const navigate = useNavigate();

  // Remove the useEffect that was setting the title and keep the rest

  // The remaining useEffect for data fetching
  useEffect(() => {
    // Fetch accounts
    fetch('/api/accounts', { credentials: 'include' })
      .then(res => res.json())
      .then(data => setAccounts(data))
      .catch(console.error);

    // Fetch connected accounts info
    fetch('/api/connected-accounts', { credentials: 'include' })
      .then(res => res.json())
      .then(data => {
        // Convert array to object with account_id as key for easy lookup
        const connected = {};
        data.forEach(account => {
          connected[account.account_id] = true;
        });
        setConnectedAccounts(connected);
      })
      .catch(console.error);
  }, []);

  function handleLogout() {
    fetch('/api/logout', { method: 'POST', credentials: 'include' })
      .then(() => onLogout());
  }

  function goToBackoffice() {
    navigate('/backoffice');
  }

  // Connect account for ordering
  function connectAccount(account) {
    fetch('/api/connect-account', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ accountId: account.id, email: account.email })
    })
      .then(res => res.json())
      .then(data => {
        if (data.success) {
          // Show password to admin
          alert(`Customer successfully connected!\nTemporary password: ${data.password}\n\nPlease provide this password to the customer.`);
          
          // Update local state to show account as connected
          setConnectedAccounts(prev => ({
            ...prev,
            [account.id]: true
          }));
        } else {
          alert(`Error: ${data.error}`);
        }
      })
      .catch(error => {
        console.error('Error connecting account:', error);
        alert('There was an error connecting the account. Please try again.');
      });
  }

  // Context menu handler
  function handleContextMenu(e, account) {
    e.preventDefault();
    
    // Don't show connect option if already connected
    if (connectedAccounts[account.id]) return;
    
    // Create custom context menu
    const menu = document.createElement('div');
    menu.className = 'absolute bg-white shadow-lg rounded py-2 z-50';
    menu.style.left = `${e.pageX}px`;
    menu.style.top = `${e.pageY}px`;
    
    // Add menu option
    const option = document.createElement('div');
    option.className = 'px-4 py-2 hover:bg-blue-100 cursor-pointer';
    option.textContent = 'Connect for ordering';
    option.onclick = () => {
      connectAccount(account);
      document.body.removeChild(menu);
    };
    
    menu.appendChild(option);
    document.body.appendChild(menu);
    
    // Remove menu on click outside
    const removeMenu = () => {
      if (document.body.contains(menu)) {
        document.body.removeChild(menu);
      }
      document.removeEventListener('click', removeMenu);
    };
    document.addEventListener('click', removeMenu);
  }

  // Filter accounts based on search query
  const filteredAccounts = searchQuery 
    ? accounts.filter(account => 
        account.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
        account.email.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : accounts;

  return (
    <div className="p-6">
      <div className="flex justify-between mb-4">
        <h1 className="text-2xl font-bold">Manage Customers</h1>
        <div className="flex gap-2">
          <button onClick={goToBackoffice} className="px-3 py-1 bg-blue-500 text-white rounded">Back</button>
          <button onClick={onHome} className="px-3 py-1 bg-gray-400 text-white rounded">Home</button>
          <button onClick={handleLogout} className="px-3 py-1 bg-red-500 text-white rounded">Logout</button>
        </div>
      </div>
      
      {/* Search Bar */}
      <div className="mb-4">
        <input
          type="text"
          placeholder="Search customers by name or email"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full px-4 py-2 border rounded"
        />
      </div>
      
      {filteredAccounts.length === 0 ? (
        <div className="text-center py-8">
          {accounts.length === 0 ? (
            <p className="text-gray-500">Loading customer accounts...</p>
          ) : (
            <p className="text-gray-500">No customers found matching your search.</p>
          )}
        </div>
      ) : (
        <div className="grid gap-4">
          {filteredAccounts.map(account => (
            <div 
              key={account.id} 
              className="border p-4 rounded shadow" 
              onContextMenu={(e) => handleContextMenu(e, account)}
            >
              <div className="flex justify-between">
                <h2 className="text-xl font-bold mb-2">{account.name}</h2>
                {connectedAccounts[account.id] && (
                  <span className="text-green-500 flex items-center">
                    ✅ Connected
                  </span>
                )}
              </div>
              <p>{account.street}, {account.city}, {account.state} {account.zip}</p>
              <p>Email: {account.email}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}