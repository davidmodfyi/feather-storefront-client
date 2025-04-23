import { useState } from 'react';
import Storefront from './Storefront';
import Backoffice from './Backoffice';

function App() {
  const [mode, setMode] = useState(null);
  const [loggedIn, setLoggedIn] = useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const login = () => {
    fetch('https://api.featherstorefront.com/login', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    })
      .then(res => {
        if (!res.ok) throw new Error('Unauthorized');
        return res.json();
      })
      .then(() => setLoggedIn(true))
      .catch(() => setError('Invalid username or password'));
  };

  const logout = () => {
    fetch('https://api.featherstorefront.com/logout', {
      method: 'POST',
      credentials: 'include'
    }).then(() => {
      setLoggedIn(false);
      setUsername('');
      setPassword('');
      setMode(null);
    });
  };

  if (!loggedIn) {
    return (
      <div className="p-10 space-y-4 max-w-md mx-auto">
        <h1 className="text-3xl font-bold text-center">Ocean Wave Admin Login</h1>
        {error && <p className="text-red-600">{error}</p>}
        <input
          className="w-full p-2 border rounded"
          placeholder="Username"
          value={username}
          onChange={e => setUsername(e.target.value)}
        />
        <input
          className="w-full p-2 border rounded"
          placeholder="Password"
          type="password"
          value={password}
          onChange={e => setPassword(e.target.value)}
        />
        <button onClick={login} className="w-full bg-blue-600 text-white py-2 rounded">Login</button>
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
        <button onClick={logout} className="mt-6 px-4 py-2 bg-red-600 text-white rounded">Logout</button>
      </div>
    );
  }

  return mode === 'storefront' ? <Storefront /> : <Backoffice />;
}

export default App;
