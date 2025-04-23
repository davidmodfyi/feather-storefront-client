import { useState } from 'react';
import Storefront from './Storefront';
import Backoffice from './Backoffice';

function App() {
  const [mode, setMode] = useState(null);
  const [loggedIn, setLoggedIn] = useState(false);

  const handleLogout = () => {
    fetch('https://api.featherstorefront.com/logout', {
      method: 'POST',
      credentials: 'include'
    }).finally(() => {
      setLoggedIn(false);
    });
  };

  if (!loggedIn) {
    return (
      <div className="p-10 space-y-4 text-center max-w-xs mx-auto">
        <h2 className="text-2xl font-bold mb-4">Admin Login</h2>
        <form
          onSubmit={e => {
            e.preventDefault();
            const form = e.target;
            const username = form.username.value;
            const password = form.password.value;

            fetch('https://api.featherstorefront.com/login', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              credentials: 'include',
              body: JSON.stringify({ username, password })
            })
              .then(res => {
                if (res.ok) setLoggedIn(true);
                else alert('Login failed');
              });
          }}
          className="space-y-3"
        >
          <input type="text" name="username" placeholder="Username" className="w-full border px-3 py-2 rounded" required />
          <input type="password" name="password" placeholder="Password" className="w-full border px-3 py-2 rounded" required />
          <div className="flex justify-between">
            <button type="button" onClick={() => setMode(null)} className="text-sm text-gray-500 underline">Back</button>
            <button type="submit" className="bg-blue-600 text-white py-2 px-4 rounded">Login</button>
          </div>
        </form>
      </div>
    );
  }

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

  return mode === 'storefront'
    ? <Storefront onLogout={handleLogout} />
    : <Backoffice onLogout={handleLogout} />;
}

export default App;
