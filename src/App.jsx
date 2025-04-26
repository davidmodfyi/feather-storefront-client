// App.jsx
import { useState, useEffect } from 'react';
import Storefront from './Storefront';
import Backoffice from './Backoffice';

function App() {
  const [mode, setMode] = useState(null);
  const [distributorName, setDistributorName] = useState('');
  const [distributorId, setDistributorId] = useState('');

  useEffect(() => {
    fetch('https://api.featherstorefront.com/api/me', { credentials: 'include' })
      .then(res => res.json())
      .then(data => {
        if (data && data.distributorName) {
          setDistributorName(data.distributorName);
          setDistributorId(data.distributorId);
        }
      })
      .catch(console.error);
  }, []);

  const handleLogout = () => {
    fetch('https://api.featherstorefront.com/api/logout', { method: 'POST', credentials: 'include' })
      .then(() => {
        setMode(null);
        setDistributorName('');
        setDistributorId('');
      });
  };

  if (!mode) {
    return (
      <div className="p-10 space-y-4 text-center">
        <h1 className="text-3xl font-bold">{distributorName || 'Feather Storefront'}</h1>
        <p className="text-gray-600">Select a portal to continue</p>
        <div className="space-x-4">
          <button onClick={() => setMode('storefront')} className="px-4 py-2 bg-blue-500 text-white rounded">Storefront</button>
          <button onClick={() => setMode('backoffice')} className="px-4 py-2 bg-gray-700 text-white rounded">Backoffice</button>
        </div>
      </div>
    );
  }

  return mode === 'storefront'
    ? <Storefront onLogout={handleLogout} onHome={() => setMode(null)} distributorName={distributorName} distributorId={distributorId} />
    : <Backoffice onLogout={handleLogout} onHome={() => setMode(null)} distributorName={distributorName} distributorId={distributorId} />;
}

export default App;
