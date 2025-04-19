import { useState } from 'react';
import Storefront from './Storefront';
import Backoffice from './Backoffice';

function App() {
  const [mode, setMode] = useState(null);

  if (!mode) {
    return (
      <div className="p-10 space-y-4 text-center">
        <h1 className="text-3xl font-bold">Ocean Wave Foods</h1>
        <p className="text-gray-600">Select a portal to continue</p>
        <div className="space-x-4">
          <button onClick={() => setMode('storefront')} className="px-4 py-2 bg-blue-500 text-white rounded">Storefront</button>
          <button onClick={() => setMode('backoffice')} className="px-4 py-2 bg-gray-700 text-white rounded">Backoffice</button>
        </div>
      </div>
    );
  }

  return mode === 'storefront' ? <Storefront /> : <Backoffice />;
}

export default App;