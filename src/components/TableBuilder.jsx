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
  const [newAccountField, setNewAccountField] = useState({ name: '', type: 'text' });
  const [newProductField, setNewProductField] = useState({ name: '', type: 'text' });
  const [addingField, setAddingField] = useState(false);
  const [debugInfo, setDebugInfo] = useState(null);
  
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
        
        // Process accounts with custom attributes merged
        const processedAccounts = mergeCustomAttributesWithDefinitions(
          accountsData.accounts || [], 
          accountsData.customAttributes || [],
          accountsData.attributeDefinitions || []
        );
        
        setAccountsData(processedAccounts.slice(0, 10));
      }
      
      // Try to fetch products (might not exist yet)
      try {
        const productsResponse = await fetch('/api/table-builder/products', {
          credentials: 'include'
        });
        
        if (productsResponse.ok) {
          const productsData = await productsResponse.json();
          console.log('Products data received:', productsData);
          
          // Process products with custom attributes merged
          const processedProducts = mergeCustomAttributesWithDefinitions(
            productsData.products || [], 
            productsData.customAttributes || [],
            productsData.attributeDefinitions || []
          );
          
          setProductsData(processedProducts.slice(0, 10));
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

  const mergeCustomAttributesWithDefinitions = (items, customAttributes, attributeDefinitions) => {
    console.log('Merging with definitions:', items.length, 'items,', customAttributes.length, 'values,', attributeDefinitions.length, 'definitions');
    
    if (!Array.isArray(items) || items.length === 0) {
      return [];
    }
    
    if (!Array.isArray(customAttributes)) {
      customAttributes = [];
    }
    
    if (!Array.isArray(attributeDefinitions)) {
      attributeDefinitions = [];
    }
    
    return items.map(item => {
      // Start with the basic item fields
      const mergedItem = { ...item };
      
      // First, add ALL defined custom attributes as empty fields
      attributeDefinitions.forEach(definition => {
        mergedItem[definition.attribute_name] = ''; // Default empty value
      });
      
      // Then, fill in actual values where they exist
      const itemCustomAttrs = customAttributes.filter(
        attr => attr.entity_id === item.id
      );
      
      console.log(`Item ${item.id} has ${itemCustomAttrs.length} custom values out of ${attributeDefinitions.length} possible fields`);
      
      itemCustomAttrs.forEach(attr => {
        // Use the appropriate value based on data type
        let value = attr.value_text || attr.value_number || attr.value_boolean;
        if (attr.value_boolean !== null && attr.value_boolean !== undefined) {
          value = attr.value_boolean ? 'Yes' : 'No';
        }
        mergedItem[attr.attribute_name] = value || '';
        console.log(`Set custom attribute: ${attr.attribute_name} = ${value}`);
      });
      
      return mergedItem;
    });
  };

  const addCustomField = async (entityType, fieldData) => {
    try {
      setAddingField(true);
      
      const response = await fetch('/api/table-builder/add-field', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          entity_type: entityType,
          attribute_name: fieldData.name.toLowerCase().replace(/\s+/g, '_'),
          attribute_label: fieldData.name,
          data_type: fieldData.type,
          validation_rules: '{}',
          display_order: 999
        })
      });

      if (response.ok) {
        // Reset form
        if (entityType === 'accounts') {
          setNewAccountField({ name: '', type: 'text' });
        } else {
          setNewProductField({ name: '', type: 'text' });
        }
        
        // Refresh data to show new field
        fetchBothTablesData();
        
        alert('Field added successfully!');
      } else {
        const error = await response.json();
        alert('Error adding field: ' + (error.error || 'Unknown error'));
      }
    } catch (error) {
      console.error('Error adding field:', error);
      alert('Error adding field: ' + error.message);
    } finally {
      setAddingField(false);
    }
  };

  const debugCustomAttributes = async () => {
    try {
      console.log('Fetching debug info...');
      const response = await fetch('/api/debug/custom-attributes', {
        credentials: 'include'
      });
      
      if (response.ok) {
        const data = await response.json();
        setDebugInfo(data);
        console.log('DEBUG INFO:', data);
        alert('Debug info loaded - check console for details');
      } else {
        const error = await response.json();
        alert('Debug error: ' + (error.error || 'Unknown error'));
      }
    } catch (error) {
      console.error('Debug error:', error);
      alert('Debug error: ' + error.message);
    }
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
          <button 
            onClick={debugCustomAttributes}
            className="px-3 py-1 bg-yellow-500 text-white rounded text-sm"
          >
            Debug DB
          </button>
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
              {accountsData.length} accounts (first 10 rows)
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
        
        {/* Add Field Form for Products */}
        <div className="px-6 py-4 border-t border-gray-200 bg-gray-50">
          <h3 className="text-sm font-medium text-gray-700 mb-3">Add Custom Field to Products</h3>
          <div className="flex gap-3 items-end">
            <div className="flex-1">
              <label className="block text-xs font-medium text-gray-600 mb-1">Field Name</label>
              <input
                type="text"
                value={newProductField.name}
                onChange={(e) => setNewProductField({...newProductField, name: e.target.value})}
                placeholder="e.g., Shelf Life, Storage Temp"
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                disabled={addingField}
              />
            </div>
            <div className="w-32">
              <label className="block text-xs font-medium text-gray-600 mb-1">Field Type</label>
              <select
                value={newProductField.type}
                onChange={(e) => setNewProductField({...newProductField, type: e.target.value})}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                disabled={addingField}
              >
                <option value="text">Text</option>
                <option value="number">Number</option>
                <option value="boolean">Yes/No</option>
                <option value="date">Date</option>
                <option value="select">Select List</option>
              </select>
            </div>
            <button
              onClick={() => addCustomField('products', newProductField)}
              disabled={!newProductField.name.trim() || addingField}
              className="px-4 py-2 bg-blue-600 text-white rounded-md text-sm hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {addingField ? 'Adding...' : 'Add Field'}
            </button>
          </div>
        </div>
        
        {/* Add Field Form for Accounts */}
        <div className="px-6 py-4 border-t border-gray-200 bg-gray-50">
          <h3 className="text-sm font-medium text-gray-700 mb-3">Add Custom Field to Accounts</h3>
          <div className="flex gap-3 items-end">
            <div className="flex-1">
              <label className="block text-xs font-medium text-gray-600 mb-1">Field Name</label>
              <input
                type="text"
                value={newAccountField.name}
                onChange={(e) => setNewAccountField({...newAccountField, name: e.target.value})}
                placeholder="e.g., Contract ID, Street 2"
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                disabled={addingField}
              />
            </div>
            <div className="w-32">
              <label className="block text-xs font-medium text-gray-600 mb-1">Field Type</label>
              <select
                value={newAccountField.type}
                onChange={(e) => setNewAccountField({...newAccountField, type: e.target.value})}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                disabled={addingField}
              >
                <option value="text">Text</option>
                <option value="number">Number</option>
                <option value="boolean">Yes/No</option>
                <option value="date">Date</option>
                <option value="select">Select List</option>
              </select>
            </div>
            <button
              onClick={() => addCustomField('accounts', newAccountField)}
              disabled={!newAccountField.name.trim() || addingField}
              className="px-4 py-2 bg-blue-600 text-white rounded-md text-sm hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {addingField ? 'Adding...' : 'Add Field'}
            </button>
          </div>
        </div>
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
              {productsData.length} products (first 10 rows)
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
