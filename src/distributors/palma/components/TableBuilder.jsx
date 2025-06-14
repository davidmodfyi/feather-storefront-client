import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

export default function TableBuilder({ onLogout, onHome, brandName }) {
  const navigate = useNavigate();
  const [accountsData, setAccountsData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [customAttributes, setCustomAttributes] = useState([]);
  
  // Set title
  document.title = brandName ? `${brandName} - Table Builder` : 'Table Builder - Feather';

  useEffect(() => {
    fetchAccountsData();
  }, []);

  const fetchAccountsData = async () => {
    try {
      setLoading(true);
      
      // Fetch accounts with custom attributes merged
      const response = await fetch('/api/table-builder/accounts', {
        credentials: 'include'
      });
      
      if (!response.ok) {
        throw new Error('Failed to fetch accounts data');
      }
      
      const data = await response.json();
      
      // Process the data to merge custom attributes
      const processedData = processAccountsWithCustomAttributes(data.accounts, data.customAttributes);
      
      setAccountsData(processedData.slice(0, 20)); // Limit to first 20 rows
      setCustomAttributes(data.attributeDefinitions || []);
      
    } catch (error) {
      console.error('Error fetching accounts data:', error);
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

  const processAccountsWithCustomAttributes = (accounts, customAttributes) => {
    return accounts.map(account => {
      // Start with the basic account fields
      const mergedAccount = { ...account };
      
      // Add custom attributes for this account
      const accountCustomAttrs = customAttributes.filter(
        attr => attr.entity_type === 'accounts' && attr.entity_id === account.id
      );
      
      accountCustomAttrs.forEach(attr => {
        // Use the appropriate value based on data type
        let value = attr.value_text || attr.value_number || attr.value_boolean;
        if (attr.value_boolean !== null) {
          value = attr.value_boolean ? 'Yes' : 'No';
        }
        mergedAccount[attr.attribute_name] = value;
      });
      
      return mergedAccount;
    });
  };

  const getAllColumnNames = () => {
    if (accountsData.length === 0) return [];
    
    // Get all unique column names from all accounts
    const allColumns = new Set();
    
    accountsData.forEach(account => {
      Object.keys(account).forEach(key => allColumns.add(key));
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
            onClick={fetchAccountsData}
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
            Showing {accountsData.length} accounts with all attributes
          </div>
        </div>
        <div className="flex gap-2">
          <button onClick={() => navigate('/backoffice')} className="px-3 py-1 bg-blue-500 text-white rounded">Back</button>
          <button onClick={onHome} className="px-3 py-1 bg-gray-400 text-white rounded">Home</button>
          <button onClick={onLogout} className="px-3 py-1 bg-red-500 text-white rounded">Logout</button>
        </div>
      </div>

      {/* Accounts Table */}
      <div className="bg-white rounded-lg shadow">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">Accounts Table</h2>
          <p className="text-sm text-gray-600 mt-1">
            Combined view of standard fields and custom attributes (First 20 rows)
          </p>
        </div>
        
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                {columns.map(column => (
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
                  {columns.map(column => (
                    <td key={column} className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {formatCellValue(account[column])}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        
        {accountsData.length === 0 && (
          <div className="text-center py-12">
            <p className="text-gray-500 text-lg">No accounts found</p>
            <p className="text-gray-400 text-sm mt-2">
              Check if your distributor has any accounts configured
            </p>
          </div>
        )}
      </div>
      
      {/* Future Features Placeholder */}
      <div className="mt-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h3 className="text-blue-800 font-semibold mb-2">Coming Soon</h3>
        <ul className="text-blue-700 text-sm space-y-1">
          <li>• Add new custom attributes</li>
          <li>• Edit existing attributes</li>
          <li>• Configure attribute types and validation</li>
          <li>• Bulk edit account data</li>
          <li>• Export/import functionality</li>
        </ul>
      </div>
    </div>
  );
}
