import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

export default function TableBuilder({ onLogout, onHome, brandName }) {
  const navigate = useNavigate();
  const [accountsData, setAccountsData] = useState([]);
  const [productsData, setProductsData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [accountsExpanded, setAccountsExpanded] = useState(false);
  const [productsExpanded, setProductsExpanded] = useState(false);
  
  // Set title
  document.title = brandName ? `${brandName} - Table Builder` : 'Table Builder - Feather';

  const fetchBothTablesData = async () => {
    try {
      setLoading(true);
      setError(null);
      console.log('Fetching both tables data...');
      
      // Fetch accounts
      const accountsResponse = await fetch('/api/table-builder/accounts', {
        credentials: 'include'
      });
      
      if (accountsResponse.ok) {
        const accountsData = await accountsResponse.json();
        console.log('Accounts data received:', accountsData);
        setAccountsData((accountsData.accounts || []).slice(0, 20));
      }
      
      // Try to fetch products (might not exist yet)
      try {
        const productsResponse = await fetch('/api/table-builder/products', {
          credentials: 'include'
        });
        
        if (productsResponse.ok) {
          const productsData = await productsResponse.json();
          console.log('Products data received:', productsData);
          setProductsData((productsData.products || []).slice(0, 20));
        } else {
          console.log('Products endpoint returned:', productsResponse.status);
          setProductsData([]);
        }
      } catch (productsError) {
        console.log('Products endpoint not available:', productsError.message);
        setProductsData([]);
      }
      
    } catch (error) {
      console.error('Fetch error:', error);
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBothTablesData();
  }, []);

  const getColumnNames = (data) => {
    if (!data || data.length === 0) return [];
    // Get columns from first item
    return Object.keys(data[0]);
  };

  if (loading) {
    return (
      <div className="p-6">
        <div className="flex justify-between mb-6">
          <h1 className="text-2xl font-bold">Table Builder</h1>
          <div className="flex gap-2">
            <button onClick={() => navigate('/backoffice')} className="px-3 py-1 bg-blue-500 text-white rounded">Back</button>
            <button onClick={onHome} className="px-3 py-1 bg-gray-400 text-white rounded">Home</button>
            <button onClick={onLogout} className="px-3 py-1 bg-red-500 text-white rounded">Logout</button>
          </div>
        </div>
        <div className="flex items-center justify-center h-64">
          <div className="text-lg">Loading accounts...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex justify-between mb-6">
        <div className="flex items-center gap-4">
          <h1 className="text-2xl font-bold">Table Builder</h1>
          <div className="text-sm text-gray-600">
            {accountsData.length} accounts, {productsData.length} products loaded
          </div>
        </div>
        <div className="flex gap-2">
          <button onClick={() => navigate('/backoffice')} className="px-3 py-1 bg-blue-500 text-white rounded">Back</button>
          <button onClick={onHome} className="px-3 py-1 bg-gray-400 text-white rounded">Home</button>
          <button onClick={onLogout} className="px-3 py-1 bg-red-500 text-white rounded">Logout</button>
        </div>
      </div>

      {error && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded">
          <p className="text-red-600">Error: {error}</p>
          <button 
            onClick={fetchBothTablesData}
            className="mt-2 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
          >
            Retry
          </button>
        </div>
      )}

      {/* Accounts Table Section */}
      <div className="bg-white rounded-lg shadow mb-6">
        <div 
          className="px-6 py-4 border-b border-gray-200 cursor-pointer hover:bg-gray-50 flex justify-between items-center"
          onClick={() => setAccountsExpanded(!accountsExpanded)}
        >
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Accounts Table</h2>
            <p className="text-sm text-gray-600 mt-1">
              {accountsData.length} accounts (standard fields only for now)
            </p>
          </div>
          <div className={`transform transition-transform duration-200 ${accountsExpanded ? 'rotate-180' : ''}`}>
            <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </div>
        </div>
        
        {accountsExpanded && (
          <div className="overflow-x-auto">
            {accountsData.length > 0 ? (
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    {getColumnNames(accountsData).map(column => (
                      <th 
                        key={column}
                        scope="col" 
                        className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                      >
                        {column.replace(/_/g, ' ')}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {accountsData.map((account, index) => (
                    <tr key={account.id || index} className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                      {getColumnNames(accountsData).map(column => (
                        <td key={column} className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {account[column] || ''}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <div className="text-center py-12">
                <p className="text-gray-500 text-lg">No accounts found</p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Products Table Section */}
      <div className="bg-white rounded-lg shadow">
        <div 
          className="px-6 py-4 border-b border-gray-200 cursor-pointer hover:bg-gray-50 flex justify-between items-center"
          onClick={() => setProductsExpanded(!productsExpanded)}
        >
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Products Table</h2>
            <p className="text-sm text-gray-600 mt-1">
              {productsData.length} products (standard fields only for now)
            </p>
          </div>
          <div className={`transform transition-transform duration-200 ${productsExpanded ? 'rotate-180' : ''}`}>
            <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </div>
        </div>
        
        {productsExpanded && (
          <div className="overflow-x-auto">
            {productsData.length > 0 ? (
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    {getColumnNames(productsData).map(column => (
                      <th 
                        key={column}
                        scope="col" 
                        className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                      >
                        {column.replace(/_/g, ' ')}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {productsData.map((product, index) => (
                    <tr key={product.id || index} className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                      {getColumnNames(productsData).map(column => (
                        <td key={column} className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {product[column] || ''}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <div className="text-center py-12">
                <p className="text-gray-500 text-lg">
                  {productsData.length === 0 ? 'No products found or endpoint not available' : 'No products found'}
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
