import { useEffect, useState } from 'react';

export default function Backoffice({ onLogout, onHome }) {
  const [accounts, setAccounts] = useState([]);

  useEffect(() => {
    fetch('https://api.featherstorefront.com/api/accounts', {
      credentials: 'include'
    })
      .then(res => res.json())
      .then(data => setAccounts(data))
      .catch(console.error);
  }, []);

  return (
    <div className="p-8">
      <div className="flex justify-end space-x-2 mb-4">
        <button onClick={onHome} className="bg-gray-400 hover:bg-gray-500 text-white font-bold py-2 px-4 rounded">
          Home
        </button>
        <button onClick={onLogout} className="bg-red-500 hover:bg-red-700 text-white font-bold py-2 px-4 rounded">
          Logout
        </button>
      </div>
      <h1 className="text-2xl font-bold mb-4">Manage Customers</h1>
      <div className="overflow-x-auto">
        <table className="min-w-full bg-white">
          <thead>
            <tr>
              <th className="px-4 py-2">ID</th>
              <th className="px-4 py-2">Name</th>
              <th className="px-4 py-2">Street</th>
              <th className="px-4 py-2">City</th>
              <th className="px-4 py-2">State</th>
              <th className="px-4 py-2">ZIP</th>
              <th className="px-4 py-2">Price Level</th>
              <th className="px-4 py-2">Payment Terms</th>
              <th className="px-4 py-2">Email</th>
            </tr>
          </thead>
          <tbody>
            {accounts.map(account => (
              <tr key={account.id} className="text-center border-t">
                <td className="px-4 py-2">{account.id}</td>
                <td className="px-4 py-2">{account.name}</td>
                <td className="px-4 py-2">{account.street}</td>
                <td className="px-4 py-2">{account.city}</td>
                <td className="px-4 py-2">{account.state}</td>
                <td className="px-4 py-2">{account.zip}</td>
                <td className="px-4 py-2">{account.price_level}</td>
                <td className="px-4 py-2">{account.payment_terms}</td>
                <td className="px-4 py-2">{account.email}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
