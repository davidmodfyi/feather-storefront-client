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
    <div className="min-h-screen flex items-center justify-center bg-white">
      <div className="w-80">
        {/* Feather Logo */}
        <div className="flex justify-center mb-8">
          <div className="text-center">
            {/* Feather Icon SVG with white background */}
            <div className="mb-4">
              <svg 
                width="80" 
                height="80" 
                viewBox="0 0 100 100" 
                className="mx-auto"
                style={{ background: 'white' }}
              >
                {/* White background circle */}
                <circle cx="50" cy="50" r="50" fill="white"/>
                
                {/* Feather icon - simplified version */}
                <g transform="translate(20, 15)">
                  <path
                    d="M30 10 Q45 5 55 15 Q58 25 55 35 Q50 45 40 50 L35 45 Q25 35 20 25 Q18 15 30 10 Z"
                    fill="#3B82F6"
                    stroke="#1E40AF"
                    strokeWidth="1"
                  />
                  <path
                    d="M25 20 Q35 18 45 25 M28 28 Q38 26 48 33 M31 36 Q41 34 51 41"
                    stroke="#1E40AF"
                    strokeWidth="1"
                    fill="none"
                  />
                  <path
                    d="M35 45 L30 55 Q28 58 25 55 Q22 52 25 50 L30 45"
                    fill="#1E40AF"
                  />
                </g>
              </svg>
            </div>
            
            {/* Feather Text */}
            <h1 className="text-3xl font-bold text-gray-800 mb-2">Feather</h1>
          </div>
        </div>
        
        <h2 className="text-2xl font-bold mb-6 text-center text-gray-700">Admin Login</h2>
        
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
