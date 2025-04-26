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

  const categories = [...new Set(items.map(item => item.category))];

  const filteredItems = categoryFilter
    ? items.filter(item => item.category === categoryFilter)
    : items;

  return (
    <div className="p-6">
      <div className="flex justify-between">
        <h1 className="text-3xl font-bold mb-4">{distributor} - Storefront</h1>
        <div className="space-x-2">
          <button onClick={onHome} className="px-4 py-2 bg-gray-400 text-white rounded">Home</button>
          <button onClick={onLogout} className="px-4 py-2 bg-red-500 text-white rounded">Logout</button>
        </div>
      </div>

      <div className="flex flex-wrap gap-2 mb-6">
        <button onClick={() => setCategoryFilter(null)} className="px-4 py-2 bg-blue-500 text-white rounded">All</button>
        {categories.map(cat => (
          <button
            key={cat}
            onClick={() => setCategoryFilter(cat)}
            className="px-4 py-2 bg-blue-500 text-white rounded"
          >
            {cat}
          </button>
        ))}
      </div>

      {filteredItems.map(item => (
        <div key={item.id} className="border p-4 rounded mb-4">
          <h2 className="text-xl font-semibold">{item.name}</h2>
          <p className="text-gray-600">SKU: {item.sku}</p>
          <p className="text-gray-600">Price: ${item.unitPrice.toFixed(2)}</p>
          <button className="mt-2 px-4 py-2 bg-green-500 text-white rounded">Add to Cart</button>
        </div>
      ))}
    </div>
  );
}
