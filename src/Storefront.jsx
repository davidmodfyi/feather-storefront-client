import { useEffect, useState } from 'react';

export default function Storefront() {
  const [items, setItems] = useState([]);
  const [categoryFilter, setCategoryFilter] = useState(null);

  useEffect(() => {
    fetch('https://api.featherstorefront.com/api/items', {
      credentials: 'include'
    })
      .then((res) => res.json())
      .then((data) => setItems(data))
      .catch(console.error);
  }, []);

  const categories = [...new Set(items.map((item) => item.category))];
  const filteredItems = categoryFilter
    ? items.filter((item) => item.category === categoryFilter)
    : items;

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4">Ocean Wave Foods - Storefront</h1>

      <div className="flex flex-wrap gap-2 mb-6">
        {categories.map((cat) => (
          <button
            key={cat}
            onClick={() => setCategoryFilter(cat)}
            className={`px-3 py-1 rounded ${
              categoryFilter === cat ? 'bg-blue-600 text-white' : 'bg-gray-200'
            }`}
          >
            {cat}
          </button>
        ))}
        {categoryFilter && (
          <button
            onClick={() => setCategoryFilter(null)}
            className="px-3 py-1 rounded bg-red-100 text-red-700"
          >
            Clear Filter
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredItems.map((item) => (
          <div key={item.id} className="border rounded p-4 shadow">
            <h2 className="text-lg font-semibold mb-2">{item.name}</h2>
            <p className="text-sm text-gray-500">SKU: {item.sku}</p>
            <p className="text-sm">Price: ${item.unitPrice.toFixed(2)}</p>
            <p className="text-xs text-gray-400 italic mt-1">{item.category}</p>
            <button className="mt-2 px-3 py-1 bg-green-500 text-white rounded">Add to Cart</button>
          </div>
        ))}
      </div>
    </div>
  );
}
