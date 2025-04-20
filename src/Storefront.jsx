import { useEffect, useState } from 'react';

function Storefront() {
  const [items, setItems] = useState([]);

  useEffect(() => {
    // Auto-login as dist001/account101 for demo
    fetch('https://api.featherstorefront.com/login"', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ distributorId: 'dist001', accountId: 'acct101' })
    }).then(() => {
      fetch('https://api.featherstorefront.com/api/items', {
        credentials: 'include'
      })
        .then(res => res.json())
        .then(setItems)
        .catch(console.error);
    });
  }, []);

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold mb-4">Ocean Wave Foods - Storefront</h1>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {items.map(item => (
          <div key={item.id} className="border p-4 rounded shadow">
            <h2 className="text-lg font-semibold">{item.name}</h2>
            <p>SKU: {item.sku}</p>
            <p>Price: ${item.unitPrice.toFixed(2)}</p>
            <button className="mt-2 px-3 py-1 bg-green-500 text-white rounded">Add to Cart</button>
          </div>
        ))}
      </div>
    </div>
  );
}

export default Storefront;