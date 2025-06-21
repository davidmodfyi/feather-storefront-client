import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

export default function Backoffice({ onLogout, onHome, brandName }) {
  // Set title directly at component level
  document.title = brandName ? `${brandName} - Customers` : 'Customers - Feather';
  
  const [accounts, setAccounts] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [connectedAccounts, setConnectedAccounts] = useState({});
  const [cardConfiguration, setCardConfiguration] = useState([]);
  const [customAttributes, setCustomAttributes] = useState([]);
  const [attributeDefinitions, setAttributeDefinitions] = useState([]);
  const navigate = useNavigate();

  // Remove the useEffect that was setting the title and keep the rest

  // The remaining useEffect for data fetching
  useEffect(() => {
    // Fetch ALL accounts with CAV data (no limit)
    fetch('/api/accounts-with-cav', { credentials: 'include' })
      .then(res => res.json())
      .then(data => {
        setAccounts(data.accounts || []);
        setCustomAttributes(data.customAttributes || []);
        setAttributeDefinitions(data.attributeDefinitions || []);
      })
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

    // Fetch customer card configuration
    fetch('/api/customer-card-config', { credentials: 'include' })
      .then(res => res.json())
      .then(data => {
        setCardConfiguration(data);
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
    
    // Create custom context menu
    const menu = document.createElement('div');
    menu.className = 'absolute bg-white shadow-lg rounded py-2 z-50';
    menu.style.left = `${e.pageX}px`;
    menu.style.top = `${e.pageY}px`;
    
    // Add Configure option (always available)
    const configureOption = document.createElement('div');
    configureOption.className = 'px-4 py-2 hover:bg-gray-100 cursor-pointer flex items-center gap-2';
    configureOption.innerHTML = `
      <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"></path>
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path>
      </svg>
      Configure Cards
    `;
    configureOption.onclick = () => {
      navigate('/backoffice/customers/configure');
      document.body.removeChild(menu);
    };
    
    menu.appendChild(configureOption);
    
    // Add Connect option if not already connected
    if (!connectedAccounts[account.id]) {
      const connectOption = document.createElement('div');
      connectOption.className = 'px-4 py-2 hover:bg-blue-100 cursor-pointer flex items-center gap-2';
      connectOption.innerHTML = `
        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"></path>
        </svg>
        Connect for ordering
      `;
      connectOption.onclick = () => {
        connectAccount(account);
        document.body.removeChild(menu);
      };
      
      menu.appendChild(connectOption);
    }
    
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

  // Function to render customer card fields based on configuration
  const renderCustomerFields = (account) => {
    if (cardConfiguration.length === 0) {
      // Default display if no configuration loaded yet
      return (
        <>
          <p>{account.street}, {account.city}, {account.state} {account.zip}</p>
          <p>Email: {account.email}</p>
        </>
      );
    }

    return cardConfiguration.map((fieldConfig, index) => {
      if (!fieldConfig.is_visible) return null;
      
      let fieldValue = account[fieldConfig.field_name];
      
      // If not found in account object, check if it's a CAV field
      if ((fieldValue === undefined || fieldValue === null) && fieldConfig.is_custom) {
        // Look for this field in customAttributes
        const cavValue = customAttributes.find(attr => 
          attr.entity_id === account.id && 
          attr.attribute_name === fieldConfig.field_name
        );
        if (cavValue) {
          fieldValue = cavValue.attribute_value;
        }
      }
      
      // Skip fields that don't have values
      if (!fieldValue && fieldValue !== 0) return null;
      
      return (
        <div key={index} className="flex justify-between">
          <span className="font-medium text-gray-700">{fieldConfig.display_label}:</span>
          <span className="text-gray-600">{fieldValue}</span>
        </div>
      );
    }).filter(Boolean);
  };

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
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold">Manage Customers</h1>
          <button 
            onClick={() => navigate('/backoffice/customers/configure')}
            className="p-2 bg-gray-100 hover:bg-gray-200 rounded-full transition-colors"
            title="Configure customer card layout"
          >
            <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </button>
        </div>
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
              <div className="flex justify-between items-start mb-3">
                <h2 className="text-xl font-bold">{account.name}</h2>
                {connectedAccounts[account.id] && (
                  <span className="text-green-500 flex items-center">
                    ✅ Connected
                  </span>
                )}
              </div>
              <div className="space-y-1">
                {renderCustomerFields(account)}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}