import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';

export default function Backoffice({ onLogout, onHome }) {
  const [accounts, setAccounts] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
  const navigate = useNavigate();

  useEffect(() => {
    fetch('https://api.featherstorefront.com/api/accounts', { credentials: 'include' })
      .then(res => res.json())
      .then(data => setAccounts(data))
      .catch(console.error);
  }, []);

  function handleLogout() {
    fetch('https://api.featherstorefront.com/api/logout', { method: 'POST', credentials: 'include' })
      .then(() => onLogout());
  }

  function goToBackoffice() {
    navigate('/backoffice');
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
            <div key={account.id} className="border p-4 rounded shadow">
              <h2 className="text-xl font-bold mb-2">{account.name}</h2>
              <p>{account.street}, {account.city}, {account.state} {account.zip}</p>
              <p>Email: {account.email}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}