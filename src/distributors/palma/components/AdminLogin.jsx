// Update your AdminLogin.jsx component to set the title

import { useState, useEffect } from "react";

export default function AdminLogin({ onLogin }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [debugInfo, setDebugInfo] = useState(null);

  // Set the document title to "Feather" for the login screen
  useEffect(() => {
    document.title = "Feather";
  }, []);

  async function handleLogin() {
    setIsLoading(true);
    setError("");
    setDebugInfo(null);
    
    console.log(`Attempting to log in as: ${username}`);
    
    try {
      // Make the login request directly here
      const res = await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ username, password })
      });
      
      console.log('Login response status:', res.status);
      
      // Convert response to text for debugging
      const responseText = await res.text();
      console.log('Response text:', responseText);
      
      // Parse if it's JSON
      let responseData = null;
      try {
        responseData = JSON.parse(responseText);
        console.log('Parsed response:', responseData);
      } catch (e) {
        console.log('Response is not valid JSON');
      }
      
      if (res.ok) {
        console.log('Login successful');
        
        // Call the parent's onLogin handler with the response data
        if (onLogin) {
          onLogin(responseData);
        } else {
          // If no onLogin handler, redirect to home
          window.location.href = "/";
        }
      } else {
        console.log('Login failed');
        setError(responseData?.error || "Login failed. Please check your credentials.");
        setDebugInfo({
          status: res.status,
          statusText: res.statusText,
          responseData
        });
      }
    } catch (err) {
      console.error('Login request error:', err);
      setError("Network error. Please try again.");
      setDebugInfo({
        error: err.message
      });
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="w-80">
        <h1 className="text-2xl font-bold mb-6 text-center">Admin Login</h1>
        
        {error && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
            {error}
          </div>
        )}
        
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
          onKeyPress={(e) => {
            if (e.key === 'Enter') handleLogin();
          }}
        />
        <button
          onClick={handleLogin}
          disabled={isLoading}
          className={`w-full ${
            isLoading ? 'bg-blue-300' : 'bg-blue-500 hover:bg-blue-600'
          } text-white font-bold py-2 px-4 rounded`}
        >
          {isLoading ? 'Logging in...' : 'Login'}
        </button>
        
        {/* Debug information - only shown in development */}
        {debugInfo && (
          <div className="mt-4 p-2 bg-gray-100 text-xs">
            <details>
              <summary>Debug Info</summary>
              <pre className="whitespace-pre-wrap">
                {JSON.stringify(debugInfo, null, 2)}
              </pre>
            </details>
          </div>
        )}
      </div>
    </div>
  );
}