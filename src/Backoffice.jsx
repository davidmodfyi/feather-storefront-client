import { useState } from 'react';

export default function Backoffice({ onLogout, onHome }) {
  const [view, setView] = useState(null);
  const [customers, setCustomers] = useState([]);

  const loadCustomers = () => {
    fetch('https://api.featherstorefront.com/api/accounts', {
      credentials: 'include'
    })
      .then(res => res.json())
      .then(data => {
        setCustomers(data);
        setView('customers');
      });
  };

  if (view === 'customers') {
    return (
      <div className="p-6">
        <div className="flex justify-between mb-4">
          <h1 className="text-2xl font-bold">Manage Customers</h1>
          <div className="flex gap-2">
            <button onClick={onHome} className="px-3 py-1 bg-gray-400 text-white rounded">Home</button>
            <button onClick={onLogout} className="px-3 py-1 bg-red-500 text-white rounded">Logout</button>
          </div>
        </div>
        <table className="w-full table-auto border">
          <thead>
            <tr className="bg-gray-100">
              <th className="border px-2 py-1">ID</th>
              <th className="border px-2 py-1">Name</th>
              <th className="border px-2 py-1">Street</th>
              <th className="border px-2 py-1">City</th>
              <th className="border px-2 py-1">State</th>
              <th className="border px-2 py-1">ZIP</th>
              <th className="border px-2 py-1">Price Level</th>
              <th className="border px-2 py-1">Payment Terms</th>
              <th className="border px-2 py-1">Email</th>
            </tr>
          </thead>
          <tbody>
            {customers.map(c => (
              <tr key={c.id}>
                <td className="border px-2 py-1">{c.id}</td>
                <td className="border px-2 py-1">{c.name}</td>
                <td className="border px-2 py-1">{c.street}</td>
                <td className="border px-2 py-1">{c.city}</td>
                <td className="border px-2 py-1">{c.state}</td>
                <td className="border px-2 py-1">{c.zip}</td>
                <td className="border px-2 py-1">{c.price_level}</td>
                <td className="border px-2 py-1">{c.payment_terms}</td>
                <td className="border px-2 py-1">{c.email}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  return (
    <div className="p-10 text-center space-y-4">
      <h1 className="text-3xl font-bold mb-6">Backoffice</h1>
      <button onClick={loadCustomers} className="px-4 py-2 bg-blue-600 text-white rounded">Manage Customers</button>
      <div className="mt-6 flex justify-center gap-4">
        <button onClick={onHome} className="px-4 py-2 bg-gray-400 text-white rounded">Home</button>
        <button onClick={onLogout} className="px-4 py-2 bg-red-600 text-white rounded">Logout</button>
      </div>
    </div>
  );
}