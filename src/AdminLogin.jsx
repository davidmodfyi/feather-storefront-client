import { useState } from "react";

export default function AdminLogin({ onLoginSuccess }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");

  async function handleLogin() {
    try {
      const res = await fetch("https://api.featherstorefront.com/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ username, password })
      });
      
      if (res.ok) {
        const data = await res.json();
        onLoginSuccess(data.distributorName || '');
      } else {
        alert("Login failed.");
      }
    } catch (err) {
      console.error(err);
      alert("Login error.");
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="w-80">
        <h1 className="text-2xl font-bold mb-6 text-center">Admin Login</h1>
        <input
          type="text"
          placeholder="Username"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          className="border rounded px-3 py-2 mb-4 w-full"
        />
        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="border rounded px-3 py-2 mb-4 w-full"
        />
        <button
          onClick={handleLogin}
          className="w-full bg-blue-500 hover:bg-blue-600 text-white font-bold py-2 px-4 rounded"
        >
          Login
        </button>
      </div>
    </div>
  );
}