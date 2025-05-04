import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';

export default function Backoffice({ onLogout, onHome }) {
  const [accounts, setAccounts] = useState([]);
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
      
      {accounts.length === 0 ? (
        <div className="text-center py-8">
          <p className="text-gray-500">Loading customer accounts...</p>
        </div>
      ) : (
        <div className="grid gap-4">
          {accounts.map(account => (
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