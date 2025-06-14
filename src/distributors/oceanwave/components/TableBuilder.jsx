import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

export default function TableBuilder({ onLogout, onHome, brandName }) {
  const navigate = useNavigate();
  const [accountsData, setAccountsData] = useState([]);
  const [productsData, setProductsData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [accountsExpanded, setAccountsExpanded] = useState(false);
  const [productsExpanded, setProductsExpanded] = useState(false);
  
  // Set title
  document.title = brandName ? `${brandName} - Table Builder` : 'Table Builder - Feather';

  useEffect(() => {
    fetchTablesData();
  }, []);

  const fetchTablesData = async () => {
    try {
      setLoading(true);
      setError(null);
      
      // Fetch accounts first (since products endpoint might not exist yet)
      const accountsResponse = await fetch('/api/table-builder/accounts', { 
        credentials: 'include' 
      });
      
      if (!accountsResponse.ok) {
        throw new Error('Failed to fetch accounts data');
      }
      
      const accountsData = await accountsResponse.json();
      
      // Process accounts data
      const processedAccounts = processDataWithCustomAttributes(
        accountsData.accounts || [], 
        accountsData.customAttributes || []
      );
      
      setAccountsData(processedAccounts.slice(0, 20));
      
      // Try to fetch products (might fail if endpoint doesn't exist yet)
      try {
        const productsResponse = await fetch('/api/table-builder/products', { 
          credentials: 'include' 
        });
        
        if (productsResponse.ok) {
          const productsData = await productsResponse.json();
          const processedProducts = processDataWithCustomAttributes(
            productsData.products || [], 
            productsData.customAttributes || []
          );
          setProductsData(processedProducts.slice(0, 20));
        } else {
          console.log('Products endpoint not available yet');
          setProductsData([]);
        }
      } catch (productsError) {
        console.log('Products endpoint not available:', productsError.message);
        setProductsData([]);
      }
      
    } catch (error) {
      console.error('Error fetching table data:', error);
      setError(error.message);
      setAccountsData([]);
      setProductsData([]);
    } finally {
      setLoading(false);
    }
  };

  const processDataWithCustomAttributes = (items, customAttributes) => {
    // Add safety checks
    if (!Array.isArray(items)) {
      console.warn('Items is not an array:', items);
      return [];
    }
    
    if (!Array.isArray(customAttributes)) {
      console.warn('Custom attributes is not an array:', customAttributes);
      customAttributes = [];
    }
    
    return items.map(item => {
      // Start with the basic item fields
      const mergedItem = { ...item };
      
      // Add custom attributes for this item
      const itemCustomAttrs = customAttributes.filter(
        attr => attr.entity_id === item.id
      );
      
      itemCustomAttrs.forEach(attr => {
        // Use the appropriate value based on data type
        let value = attr.value_text || attr.value_number || attr.value_boolean;
        if (attr.value_boolean !== null) {
          value = attr.value_boolean ? 'Yes' : 'No';
        }
        mergedItem[attr.attribute_name] = value;
      });
      
      return mergedItem;
    });
  };

  const getAllColumnNames = (data) => {
    if (data.length === 0) return [];
    
    // Get all unique column names from all items
    const allColumns = new Set();
    
    data.forEach(item => {
      Object.keys(item).forEach(key => allColumns.add(key));
    });
    
    return Array.from(allColumns).sort();
  };

  const formatCellValue = (value) => {
    if (value === null || value === undefined) return '';
    if (typeof value === 'boolean') return value ? 'Yes' : 'No';
    if (typeof value === 'number') return value.toFixed(2);
    return String(value);
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
          <div className="text-lg">Loading accounts data...</div>
        </div>
      </div>
    );
  }

  if (error) {
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
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <h2 className="text-red-800 font-semibold">Error Loading Data</h2>
          <p className="text-red-600">{error}</p>
          <button 
            onClick={fetchTablesData}
            className="mt-2 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  const columns = getAllColumnNames();

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex justify-between mb-6">
        <div className="flex items-center gap-4">
          <h1 className="text-2xl font-bold">Table Builder</h1>
          <div className="text-sm text-gray-600">
            Master Data Tables with Custom Attributes
          </div>
        </div>
        <div className="flex gap-2">
          <button onClick={() => navigate('/backoffice')} className="px-3 py-1 bg-blue-500 text-white rounded">Back</button>
          <button onClick={onHome} className="px-3 py-1 bg-gray-400 text-white rounded">Home</button>
          <button onClick={onLogout} className="px-3 py-1 bg-red-500 text-white rounded">Logout</button>
        </div>
      </div>

      {/* Accounts Table Section */}
      <div className="bg-white rounded-lg shadow mb-6">
        <div 
          className="px-6 py-4 border-b border-gray-200 cursor-pointer hover:bg-gray-50 flex justify-between items-center"
          onClick={() => setAccountsExpanded(!accountsExpanded)}
        >
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Accounts Table</h2>
            <p className="text-sm text-gray-600 mt-1">
              {accountsData?.length || 0} accounts with standard and custom attributes
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
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  {getAllColumnNames(accountsData).map(column => (
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
                    {getAllColumnNames(accountsData).map(column => (
                      <td key={column} className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {formatCellValue(account[column])}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
            
            {accountsData.length === 0 && (
              <div className="text-center py-12">
                <p className="text-gray-500 text-lg">No accounts found</p>
                <p className="text-gray-400 text-sm mt-2">
                  Check if your distributor has any accounts configured
                </p>
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
              {productsData?.length || 0} products with standard and custom attributes
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
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  {getAllColumnNames(productsData).map(column => (
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
                    {getAllColumnNames(productsData).map(column => (
                      <td key={column} className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {formatCellValue(product[column])}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
            
            {productsData.length === 0 && (
              <div className="text-center py-12">
                <p className="text-gray-500 text-lg">No products found</p>
                <p className="text-gray-400 text-sm mt-2">
                  Check if your distributor has any products configured
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
