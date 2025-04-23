import { useEffect, useState } from 'react';

function Storefront({ onLogout }) {
  const [items, setItems] = useState([]);
  const [categoryFilter, setCategoryFilter] = useState(null);

  useEffect(() => {
    fetch('https://api.featherstorefront.com/api/items', {
      credentials: 'include'
    })
      .then(res => res.json())
      .then(data => setItems(data))
      .catch(console.error);
  }, []);

  const categories = [...new Set(items.map(item => item.category))];

  const filteredItems = categoryFilter
    ? items.filter(item => item.category === categoryFilter)
    : items;

  return (
    <div className="p-4">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Ocean Wave Foods - Storefront</h1>
        <button onClick={onLogout} className="px-3 py-1 text-sm bg-red-500 text-white rounded">Logout</button>
      </div>

      <div className="flex flex-wrap gap-2 mb-4">
        <button
          onClick={() => setCategoryFilter(null)}
          className={`px-3 py-1 rounded ${categoryFilter === null ? 'bg-blue-600 text-white' : 'bg-gray-200'}`}
        >
          All
        </button>
        {categories.map(category => (
          <button
            key={category}
            onClick={() => setCategoryFilter(category)}
            className={`px-3 py-1 rounded ${categoryFilter === category ? 'bg-blue-600 text-white' : 'bg-gray-200'}`}
          >
            {category}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredItems.map(item => (
          <div key={item.id} className="border p-4 rounded shadow">
            <h2 className="text-xl font-semibold">{item.name}</h2>
            <p className="text-gray-600">SKU: {item.sku}</p>
            <p className="text-gray-800 font-bold">Price: ${item.unitPrice.toFixed(2)}</p>
            <button className="mt-2 px-3 py-1 bg-green-500 text-white rounded">Add to Cart</button>
          </div>
        ))}
      </div>
    </div>
  );
}

export default Storefront;
