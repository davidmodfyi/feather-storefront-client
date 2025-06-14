import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

export default function TableBuilder({ onLogout, onHome, brandName }) {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  
  // Set title
  document.title = brandName ? `${brandName} - Table Builder` : 'Table Builder - Feather';

  const testAPI = async () => {
    try {
      setLoading(true);
      console.log('Testing API call...');
      
      const response = await fetch('/api/table-builder/accounts', {
        credentials: 'include'
      });
      
      console.log('Response status:', response.status);
      
      if (response.ok) {
        const data = await response.json();
        console.log('Data received:', data);
      } else {
        console.log('Response not OK:', response.status);
      }
      
    } catch (error) {
      console.error('API test error:', error);
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex justify-between mb-6">
        <div className="flex items-center gap-4">
          <h1 className="text-2xl font-bold">Table Builder</h1>
          <div className="text-sm text-gray-600">
            Debug Mode
          </div>
        </div>
        <div className="flex gap-2">
          <button onClick={() => navigate('/backoffice')} className="px-3 py-1 bg-blue-500 text-white rounded">Back</button>
          <button onClick={onHome} className="px-3 py-1 bg-gray-400 text-white rounded">Home</button>
          <button onClick={onLogout} className="px-3 py-1 bg-red-500 text-white rounded">Logout</button>
        </div>
      </div>

      {/* Test Section */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-lg font-semibold mb-4">API Test</h2>
        
        <button 
          onClick={testAPI}
          disabled={loading}
          className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
        >
          {loading ? 'Testing...' : 'Test API Connection'}
        </button>
        
        {error && (
          <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded">
            <p className="text-red-600">Error: {error}</p>
          </div>
        )}
        
        <div className="mt-4 text-sm text-gray-600">
          Check the browser console for detailed logs.
        </div>
      </div>
    </div>
  );
}
