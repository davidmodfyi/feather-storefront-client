import { useEffect, useState } from 'react';

export default function Storefront({ onLogout, onHome }) {
  const [items, setItems] = useState([]);
  const [distributor, setDistributor] = useState('Storefront');
  const [categoryFilter, setCategoryFilter] = useState(null);

  useEffect(() => {
    fetch('https://api.featherstorefront.com/api/me', { credentials: 'include' })
      .then(res => res.json())
      .then(data => setDistributor(data.distributorName || 'Storefront'))
      .catch(console.error);

    fetch('https://api.featherstorefront.com/api/items', { credentials: 'include' })
      .then(res => res.json())
      .then(data => setItems(data))
      .catch(console.error);
  }, []);

  function handleLogout() {
    fetch('https://api.featherstorefront.com/api/logout', { method: 'POST', credentials: 'include' })
      .then(() => onLogout());
  }

  const categories = [...new Set(items.map(item => item.category))];
  const filteredItems = categoryFilter ? items.filter(item => item.category === categoryFilter) : items;

  return (
    <div className="p-6">
      <div className="flex justify-between mb-4">
        <h1 className="text-2xl font-bold">{distributor} - Storefront</h1>
        <div className="flex gap-2">
          <button onClick={onHome} className="px-3 py-1 bg-gray-400 text-white rounded">Home</button>
          <button onClick={handleLogout} className="px-3 py-1 bg-red-500 text-white rounded">Logout</button>
        </div>
      </div>
      <div className="flex gap-2 mb-6 flex-wrap">
        <button onClick={() => setCategoryFilter(null)} className="px-4 py-2 bg-blue-500 text-white rounded">All</button>
        {categories.map(cat => (
          <button key={cat} onClick={() => setCategoryFilter(cat)} className="px-4 py-2 bg-blue-500 text-white rounded">{cat}</button>
        ))}
      </div>
      <div className="grid gap-4">
        {filteredItems.map(item => (
          <div key={item.id} className="border p-4 rounded">
            <h2 className="text-xl font-bold mb-2">{item.name}</h2>
            <p>SKU: {item.sku}</p>
            <p>Price: ${item.unitPrice}</p>
            <button className="mt-2 px-4 py-2 bg-green-500 text-white rounded">Add to Cart</button>
          </div>
        ))}
      </div>
    </div>
  );
}