import { useEffect, useState } from 'react';

export default function Storefront({ onLogout, onHome }) {
  const [items, setItems] = useState([]);
  const [distributor, setDistributor] = useState('Storefront');
  const [categoryFilter, setCategoryFilter] = useState(null);

  useEffect(() => {
    fetch('https://api.featherstorefront.com/api/me', {
      credentials: 'include'
    })
      .then(res => res.json())
      .then(data => setDistributor(data.distributorName || 'Storefront'))
      .catch(console.error);

    fetch('https://api.featherstorefront.com/api/items', {
      credentials: 'include'
    })
      .then(res => res.json())
      .then(data => {
        console.log('Fetched products:', data);
        setItems(data);
      })
      .catch(console.error);
  }, []);

  const categories = Array.from(new Set(items.map(item => item.category)));
  const filteredItems = categoryFilter
    ? items.filter(item => item.category === categoryFilter)
    : items;

  return (
    <div className="p-4">
      <div className="flex justify-between items-center mb-4">
        <h1 className="text-2xl font-bold">{distributor} - Storefront</h1>
        <div className="space-x-2">
          <button onClick={onHome} className="bg-gray-400 hover:bg-gray-500 text-white px-4 py-2 rounded">Home</button>
          <button onClick={onLogout} className="bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded">Logout</button>
        </div>
      </div>

      <div className="flex flex-wrap gap-2 mb-4">
        <button
          className="bg-blue-500 hover:bg-blue-600 text-white px-3 py-1 rounded"
          onClick={() => setCategoryFilter(null)}
        >
          All
        </button>
        {categories.map(category => (
          <button
            key={category}
            className="bg-blue-500 hover:bg-blue-600 text-white px-3 py-1 rounded"
            onClick={() => setCategoryFilter(category)}
          >
            {category}
          </button>
        ))}
      </div>

      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredItems.map(item => (
          <div key={item.id} className="border p-4 rounded shadow">
            <h2 className="text-lg font-semibold">{item.name}</h2>
            <p>SKU: {item.sku}</p>
            <p>Price: ${item.unitPrice.toFixed(2)}</p>
            <button className="mt-2 px-3 py-1 bg-green-500 hover:bg-green-600 text-white rounded">Add to Cart</button>
          </div>
        ))}
      </div>
    </div>
  );
}
