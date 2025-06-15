import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

export default function TableBuilder({ onLogout, onHome, brandName }) {
  const navigate = useNavigate();
  const [accountsData, setAccountsData] = useState([]);
  const [productsData, setProductsData] = useState([]);
  const [ordersData, setOrdersData] = useState([]);
  const [orderItemsData, setOrderItemsData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [accountsExpanded, setAccountsExpanded] = useState(false);
  const [productsExpanded, setProductsExpanded] = useState(false);
  const [ordersExpanded, setOrdersExpanded] = useState(false);
  const [orderItemsExpanded, setOrderItemsExpanded] = useState(false);
  const [newAccountField, setNewAccountField] = useState({ name: '', type: 'text' });
  const [newProductField, setNewProductField] = useState({ name: '', type: 'text' });
  const [newOrderField, setNewOrderField] = useState({ name: '', type: 'text' });
  const [newOrderItemField, setNewOrderItemField] = useState({ name: '', type: 'text' });
  const [addingField, setAddingField] = useState(false);
  const [debugInfo, setDebugInfo] = useState(null);
  
  // Set title
  document.title = brandName ? `${brandName} - Table Builder` : 'Table Builder - Feather';

  const fetchAllTablesData = async () => {
    try {
      setLoading(true);
      setError(null);
      console.log('Fetching all tables data...');
      
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

      // Try to fetch orders
      try {
        const ordersResponse = await fetch('/api/table-builder/orders', {
          credentials: 'include'
        });
        
        if (ordersResponse.ok) {
          const ordersData = await ordersResponse.json();
          console.log('Orders data received:', ordersData);
          
          // Process orders with custom attributes merged
          const processedOrders = mergeCustomAttributesWithDefinitions(
            ordersData.orders || [], 
            ordersData.customAttributes || [],
            ordersData.attributeDefinitions || []
          );
          
          setOrdersData(processedOrders.slice(0, 10));
        } else {
          console.log('Orders endpoint returned:', ordersResponse.status);
          setOrdersData([]);
        }
      } catch (ordersError) {
        console.log('Orders endpoint not available:', ordersError.message);
        setOrdersData([]);
      }

      // Try to fetch order lines
      try {
        const orderLinesResponse = await fetch('/api/table-builder/order-items', {
          credentials: 'include'
        });
        
        if (orderLinesResponse.ok) {
          const orderItemsData = await orderLinesResponse.json();
          console.log('Order lines data received:', orderItemsData);
          
          // Process order lines with custom attributes merged
          const processedOrderLines = mergeCustomAttributesWithDefinitions(
            orderItemsData.orderLines || [], 
            orderItemsData.customAttributes || [],
            orderItemsData.attributeDefinitions || []
          );
          
          setOrderItemsData(processedOrderLines.slice(0, 10));
        } else {
          console.log('Order lines endpoint returned:', orderLinesResponse.status);
          setOrderItemsData([]);
        }
      } catch (orderLinesError) {
        console.log('Order lines endpoint not available:', orderLinesError.message);
        setOrderItemsData([]);
      }
      
    } catch (error) {
      console.error('Fetch error:', error);
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAllTablesData();
  }, []);

  const getColumnNames = (data, entityType) => {
    // Define core column names for each entity type
    const coreColumns = {
      accounts: ['id', 'name', 'email', 'phone', 'address', 'city', 'state', 'zip'],
      products: ['id', 'name', 'description', 'sku', 'unit_price', 'category'],
      orders: ['id', 'customer_name', 'status', 'total_amount', 'order_date'],
      orderItems: ['id', 'order_id', 'product_id', 'quantity', 'unit_price']
    };
    
    if (!data || data.length === 0) {
      // Return core columns when no data exists
      return coreColumns[entityType] || [];
    }
    
    // Get columns from first item (includes both core and custom attributes)
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
        fetchAllTablesData();
        
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

  const exportToCSV = async (entityType) => {
    try {
      setLoading(true);
      // Handle the order-items special case for URL
      const apiEntityType = entityType === 'order-items' ? 'order-items' : entityType;
      const response = await fetch(`/api/table-builder/${apiEntityType}/export`, {
        credentials: 'include'
      });

      if (response.ok) {
        const data = await response.json();
        
        if (!data.data || data.data.length === 0) {
          alert(`No ${entityType} data to export`);
          return;
        }

        // Convert to CSV
        const headers = Object.keys(data.data[0]);
        const csvContent = [
          headers.join(','),
          ...data.data.map(row => 
            headers.map(header => {
              const value = row[header] || '';
              // Escape quotes and wrap in quotes if contains comma
              const escaped = String(value).replace(/"/g, '""');
              return escaped.includes(',') ? `"${escaped}"` : escaped;
            }).join(',')
          )
        ].join('\n');

        // Download CSV
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        const url = URL.createObjectURL(blob);
        link.setAttribute('href', url);
        link.setAttribute('download', `${entityType}_export_${new Date().toISOString().split('T')[0]}.csv`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        alert(`${entityType} data exported successfully!`);
      } else {
        const error = await response.json();
        alert('Export error: ' + (error.error || 'Unknown error'));
      }
    } catch (error) {
      console.error('Export error:', error);
      alert('Export error: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleFileUpload = async (entityType, file) => {
    if (!file) return;
    
    try {
      setLoading(true);
      const formData = new FormData();
      formData.append('csvFile', file);
      
      // Handle the order-items special case for URL
      const apiEntityType = entityType === 'order-items' ? 'order-items' : entityType;
      const response = await fetch(`/api/table-builder/${apiEntityType}/import`, {
        method: 'POST',
        credentials: 'include',
        body: formData
      });

      if (response.ok) {
        const result = await response.json();
        alert(`Import successful! ${result.imported || 0} records imported, ${result.updated || 0} records updated.`);
        
        // Refresh data to show imported records
        fetchAllTablesData();
      } else {
        const error = await response.json();
        alert('Import error: ' + (error.error || 'Unknown error'));
      }
    } catch (error) {
      console.error('Import error:', error);
      alert('Import error: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const triggerFileUpload = (entityType) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.csv,.xlsx,.xls';
    input.onchange = (e) => {
      const file = e.target.files[0];
      if (file) {
        handleFileUpload(entityType, file);
      }
    };
    input.click();
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
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-gray-100 p-6">
      {/* Header */}
      <div className="flex justify-between items-center mb-8">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-gradient-to-r from-blue-600 to-purple-600 rounded-lg flex items-center justify-center">
              <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <h1 className="text-3xl font-bold bg-gradient-to-r from-gray-900 to-gray-600 bg-clip-text text-transparent">
              Table Builder
            </h1>
          </div>
          <div className="px-3 py-1 bg-white/60 backdrop-blur-sm rounded-full text-sm text-gray-600 border border-white/20">
            {accountsData.length} accounts • {productsData.length} products • {ordersData.length} orders • {orderItemsData.length} lines
          </div>
        </div>
        <div className="flex gap-2">
          <button 
            onClick={debugCustomAttributes}
            className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-lg text-sm font-medium transition-all duration-200 shadow-sm hover:shadow-md"
          >
            Debug DB
          </button>
          <button 
            onClick={() => navigate('/backoffice')} 
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-all duration-200 shadow-sm hover:shadow-md"
          >
            Back
          </button>
          <button 
            onClick={onHome} 
            className="px-4 py-2 bg-gray-500 hover:bg-gray-600 text-white rounded-lg font-medium transition-all duration-200 shadow-sm hover:shadow-md"
          >
            Home
          </button>
          <button 
            onClick={onLogout} 
            className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium transition-all duration-200 shadow-sm hover:shadow-md"
          >
            Logout
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl shadow-sm">
          <p className="text-red-700 font-medium">Error: {error}</p>
          <button 
            onClick={fetchAllTablesData}
            className="mt-3 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors duration-200 font-medium"
          >
            Retry
          </button>
        </div>
      )}

      <div className="space-y-8">
        {/* Accounts Table Section */}
        <div className="bg-white rounded-2xl shadow-lg border border-blue-100 overflow-hidden">
          <div 
            className="px-6 py-5 bg-gradient-to-r from-blue-600 to-blue-700 cursor-pointer hover:from-blue-700 hover:to-blue-800 transition-all duration-200 flex justify-between items-center"
            onClick={() => setAccountsExpanded(!accountsExpanded)}
          >
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 bg-white/20 rounded-lg flex items-center justify-center">
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z" />
                </svg>
              </div>
              <div>
                <h2 className="text-xl font-bold text-white">Accounts Database</h2>
                <p className="text-blue-100 text-sm">
                  {accountsData.length} customer accounts • Click to {accountsExpanded ? 'collapse' : 'expand'}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex gap-2">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    exportToCSV('accounts');
                  }}
                  className="px-3 py-1.5 bg-white/10 hover:bg-white/20 text-white rounded-lg text-xs font-medium transition-all duration-200 flex items-center gap-1.5"
                  disabled={loading}
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  Export to Excel
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    triggerFileUpload('accounts');
                  }}
                  className="px-3 py-1.5 bg-white/10 hover:bg-white/20 text-white rounded-lg text-xs font-medium transition-all duration-200 flex items-center gap-1.5"
                  disabled={loading}
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M9 19l3 3m0 0l3-3m-3 3V10" />
                  </svg>
                  Upload from Excel
                </button>
              </div>
              <div className={`transform transition-transform duration-300 ${accountsExpanded ? 'rotate-180' : ''}`}>
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </div>
            </div>
          </div>
          
          {accountsExpanded && (
            <>
              <div className="overflow-x-auto">
                {accountsData.length > 0 ? (
                  <table className="min-w-full divide-y divide-blue-100">
                    <thead className="bg-blue-50">
                      <tr>
                        {getColumnNames(accountsData, 'accounts').map(column => (
                          <th 
                            key={column}
                            scope="col" 
                            className="px-6 py-4 text-left text-xs font-semibold text-blue-800 uppercase tracking-wider"
                          >
                            {column.replace(/_/g, ' ')}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-blue-50">
                      {accountsData.map((account, index) => (
                        <tr key={account.id || index} className={`hover:bg-blue-25 transition-colors duration-150 ${index % 2 === 0 ? 'bg-white' : 'bg-blue-25/30'}`}>
                          {getColumnNames(accountsData, 'accounts').map(column => (
                            <td key={column} className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                              {account[column] || <span className="text-gray-400">—</span>}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : (
                  <div className="text-center py-16">
                    <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                      <svg className="w-8 h-8 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z" />
                      </svg>
                    </div>
                    <p className="text-gray-500 text-lg font-medium">No accounts found</p>
                    <p className="text-gray-400 text-sm">Account data will appear here once available</p>
                  </div>
                )}
              </div>
              
              {/* Add Field Form for Accounts */}
              <div className="px-6 py-5 border-t border-blue-100 bg-gradient-to-r from-blue-50 to-blue-25">
                <div className="flex items-center gap-2 mb-4">
                  <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                  </svg>
                  <h3 className="text-sm font-semibold text-blue-800">Add Custom Field to Accounts</h3>
                </div>
                <div className="flex gap-3 items-end">
                  <div className="flex-1">
                    <label className="block text-xs font-medium text-blue-700 mb-2">Field Name</label>
                    <input
                      type="text"
                      value={newAccountField.name}
                      onChange={(e) => setNewAccountField({...newAccountField, name: e.target.value})}
                      placeholder="e.g., Contract ID, Street 2"
                      className="w-full px-4 py-2.5 border border-blue-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
                      disabled={addingField}
                    />
                  </div>
                  <div className="w-36">
                    <label className="block text-xs font-medium text-blue-700 mb-2">Field Type</label>
                    <select
                      value={newAccountField.type}
                      onChange={(e) => setNewAccountField({...newAccountField, type: e.target.value})}
                      className="w-full px-4 py-2.5 border border-blue-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
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
                    className="px-6 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 shadow-sm hover:shadow-md"
                  >
                    {addingField ? 'Adding...' : 'Add Field'}
                  </button>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Products Table Section */}
        <div className="bg-white rounded-2xl shadow-lg border border-emerald-100 overflow-hidden">
          <div 
            className="px-6 py-5 bg-gradient-to-r from-emerald-600 to-emerald-700 cursor-pointer hover:from-emerald-700 hover:to-emerald-800 transition-all duration-200 flex justify-between items-center"
            onClick={() => setProductsExpanded(!productsExpanded)}
          >
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 bg-white/20 rounded-lg flex items-center justify-center">
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                </svg>
              </div>
              <div>
                <h2 className="text-xl font-bold text-white">Products Catalog</h2>
                <p className="text-emerald-100 text-sm">
                  {productsData.length} product entries • Click to {productsExpanded ? 'collapse' : 'expand'}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex gap-2">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    exportToCSV('products');
                  }}
                  className="px-3 py-1.5 bg-white/10 hover:bg-white/20 text-white rounded-lg text-xs font-medium transition-all duration-200 flex items-center gap-1.5"
                  disabled={loading}
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  Export to Excel
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    triggerFileUpload('products');
                  }}
                  className="px-3 py-1.5 bg-white/10 hover:bg-white/20 text-white rounded-lg text-xs font-medium transition-all duration-200 flex items-center gap-1.5"
                  disabled={loading}
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M9 19l3 3m0 0l3-3m-3 3V10" />
                  </svg>
                  Upload from Excel
                </button>
              </div>
              <div className={`transform transition-transform duration-300 ${productsExpanded ? 'rotate-180' : ''}`}>
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </div>
            </div>
          </div>
          
          {productsExpanded && (
            <>
              <div className="overflow-x-auto">
                {productsData.length > 0 ? (
                  <table className="min-w-full divide-y divide-emerald-100">
                    <thead className="bg-emerald-50">
                      <tr>
                        {getColumnNames(productsData, 'products').map(column => (
                          <th 
                            key={column}
                            scope="col" 
                            className="px-6 py-4 text-left text-xs font-semibold text-emerald-800 uppercase tracking-wider"
                          >
                            {column.replace(/_/g, ' ')}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-emerald-50">
                      {productsData.map((product, index) => (
                        <tr key={product.id || index} className={`hover:bg-emerald-25 transition-colors duration-150 ${index % 2 === 0 ? 'bg-white' : 'bg-emerald-25/30'}`}>
                          {getColumnNames(productsData, 'products').map(column => (
                            <td key={column} className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                              {product[column] || <span className="text-gray-400">—</span>}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : (
                  <div className="text-center py-16">
                    <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4">
                      <svg className="w-8 h-8 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                      </svg>
                    </div>
                    <p className="text-gray-500 text-lg font-medium">No products found</p>
                    <p className="text-gray-400 text-sm">
                      {productsData.length === 0 ? 'Product data will appear here once available' : 'No products found'}
                    </p>
                  </div>
                )}
              </div>
              
              {/* Add Field Form for Products */}
              <div className="px-6 py-5 border-t border-emerald-100 bg-gradient-to-r from-emerald-50 to-emerald-25">
                <div className="flex items-center gap-2 mb-4">
                  <svg className="w-5 h-5 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                  </svg>
                  <h3 className="text-sm font-semibold text-emerald-800">Add Custom Field to Products</h3>
                </div>
                <div className="flex gap-3 items-end">
                  <div className="flex-1">
                    <label className="block text-xs font-medium text-emerald-700 mb-2">Field Name</label>
                    <input
                      type="text"
                      value={newProductField.name}
                      onChange={(e) => setNewProductField({...newProductField, name: e.target.value})}
                      placeholder="e.g., Shelf Life, Storage Temp"
                      className="w-full px-4 py-2.5 border border-emerald-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent bg-white"
                      disabled={addingField}
                    />
                  </div>
                  <div className="w-36">
                    <label className="block text-xs font-medium text-emerald-700 mb-2">Field Type</label>
                    <select
                      value={newProductField.type}
                      onChange={(e) => setNewProductField({...newProductField, type: e.target.value})}
                      className="w-full px-4 py-2.5 border border-emerald-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent bg-white"
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
                    className="px-6 py-2.5 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 shadow-sm hover:shadow-md"
                  >
                    {addingField ? 'Adding...' : 'Add Field'}
                  </button>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Order Fields (Header) Section */}
        <div className="bg-white rounded-2xl shadow-lg border border-orange-100 overflow-hidden">
          <div 
            className="px-6 py-5 bg-gradient-to-r from-orange-600 to-orange-700 cursor-pointer hover:from-orange-700 hover:to-orange-800 transition-all duration-200 flex justify-between items-center"
            onClick={() => setOrdersExpanded(!ordersExpanded)}
          >
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 bg-white/20 rounded-lg flex items-center justify-center">
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <div>
                <h2 className="text-xl font-bold text-white">Order Fields (Header)</h2>
                <p className="text-orange-100 text-sm">
                  {ordersData.length} order headers • Click to {ordersExpanded ? 'collapse' : 'expand'}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex gap-2">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    exportToCSV('orders');
                  }}
                  className="px-3 py-1.5 bg-white/10 hover:bg-white/20 text-white rounded-lg text-xs font-medium transition-all duration-200 flex items-center gap-1.5"
                  disabled={loading}
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  Export to Excel
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    triggerFileUpload('orders');
                  }}
                  className="px-3 py-1.5 bg-white/10 hover:bg-white/20 text-white rounded-lg text-xs font-medium transition-all duration-200 flex items-center gap-1.5"
                  disabled={loading}
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M9 19l3 3m0 0l3-3m-3 3V10" />
                  </svg>
                  Upload from Excel
                </button>
              </div>
              <div className={`transform transition-transform duration-300 ${ordersExpanded ? 'rotate-180' : ''}`}>
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </div>
            </div>
          </div>
          
          {ordersExpanded && (
            <>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-orange-100">
                  <thead className="bg-orange-50">
                    <tr>
                      {getColumnNames(ordersData, 'orders').map(column => (
                        <th 
                          key={column}
                          scope="col" 
                          className="px-6 py-4 text-left text-xs font-semibold text-orange-800 uppercase tracking-wider"
                        >
                          {column.replace(/_/g, ' ')}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-orange-50">
                    {ordersData.length > 0 ? (
                      ordersData.map((order, index) => (
                        <tr key={order.id || index} className={`hover:bg-orange-25 transition-colors duration-150 ${index % 2 === 0 ? 'bg-white' : 'bg-orange-25/30'}`}>
                          {getColumnNames(ordersData, 'orders').map(column => (
                            <td key={column} className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                              {order[column] || <span className="text-gray-400">—</span>}
                            </td>
                          ))}
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={getColumnNames(ordersData, 'orders').length} className="px-6 py-16 text-center">
                          <div className="w-16 h-16 bg-orange-100 rounded-full flex items-center justify-center mx-auto mb-4">
                            <svg className="w-8 h-8 text-orange-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                            </svg>
                          </div>
                          <p className="text-gray-500 text-lg font-medium">No orders found</p>
                          <p className="text-gray-400 text-sm">Order data will appear here once available</p>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
              
              {/* Add Field Form for Orders */}
              <div className="px-6 py-5 border-t border-orange-100 bg-gradient-to-r from-orange-50 to-orange-25">
                <div className="flex items-center gap-2 mb-4">
                  <svg className="w-5 h-5 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                  </svg>
                  <h3 className="text-sm font-semibold text-orange-800">Add Custom Field to Order Headers</h3>
                </div>
                <div className="flex gap-3 items-end">
                  <div className="flex-1">
                    <label className="block text-xs font-medium text-orange-700 mb-2">Field Name</label>
                    <input
                      type="text"
                      value={newOrderField.name}
                      onChange={(e) => setNewOrderField({...newOrderField, name: e.target.value})}
                      placeholder="e.g., Delivery Date, Purchase Order"
                      className="w-full px-4 py-2.5 border border-orange-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent bg-white"
                      disabled={addingField}
                    />
                  </div>
                  <div className="w-36">
                    <label className="block text-xs font-medium text-orange-700 mb-2">Field Type</label>
                    <select
                      value={newOrderField.type}
                      onChange={(e) => setNewOrderField({...newOrderField, type: e.target.value})}
                      className="w-full px-4 py-2.5 border border-orange-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent bg-white"
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
                    onClick={() => addCustomField('orders', newOrderField)}
                    disabled={!newOrderField.name.trim() || addingField}
                    className="px-6 py-2.5 bg-orange-600 text-white rounded-lg text-sm font-medium hover:bg-orange-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 shadow-sm hover:shadow-md"
                  >
                    {addingField ? 'Adding...' : 'Add Field'}
                  </button>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Order Fields (Lines) Section */}
        <div className="bg-white rounded-2xl shadow-lg border border-purple-100 overflow-hidden">
          <div 
            className="px-6 py-5 bg-gradient-to-r from-purple-600 to-purple-700 cursor-pointer hover:from-purple-700 hover:to-purple-800 transition-all duration-200 flex justify-between items-center"
            onClick={() => setOrderItemsExpanded(!orderItemsExpanded)}
          >
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 bg-white/20 rounded-lg flex items-center justify-center">
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
                </svg>
              </div>
              <div>
                <h2 className="text-xl font-bold text-white">Order Fields (Lines)</h2>
                <p className="text-purple-100 text-sm">
                  {orderItemsData.length} order items • Click to {orderItemsExpanded ? 'collapse' : 'expand'}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex gap-2">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    exportToCSV('order-items');
                  }}
                  className="px-3 py-1.5 bg-white/10 hover:bg-white/20 text-white rounded-lg text-xs font-medium transition-all duration-200 flex items-center gap-1.5"
                  disabled={loading}
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  Export to Excel
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    triggerFileUpload('order-items');
                  }}
                  className="px-3 py-1.5 bg-white/10 hover:bg-white/20 text-white rounded-lg text-xs font-medium transition-all duration-200 flex items-center gap-1.5"
                  disabled={loading}
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M9 19l3 3m0 0l3-3m-3 3V10" />
                  </svg>
                  Upload from Excel
                </button>
              </div>
              <div className={`transform transition-transform duration-300 ${orderItemsExpanded ? 'rotate-180' : ''}`}>
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </div>
            </div>
          </div>
          
          {orderItemsExpanded && (
            <>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-purple-100">
                  <thead className="bg-purple-50">
                    <tr>
                      {getColumnNames(orderItemsData, 'orderItems').map(column => (
                        <th 
                          key={column}
                          scope="col" 
                          className="px-6 py-4 text-left text-xs font-semibold text-purple-800 uppercase tracking-wider"
                        >
                          {column.replace(/_/g, ' ')}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-purple-50">
                    {orderItemsData.length > 0 ? (
                      orderItemsData.map((line, index) => (
                        <tr key={line.id || index} className={`hover:bg-purple-25 transition-colors duration-150 ${index % 2 === 0 ? 'bg-white' : 'bg-purple-25/30'}`}>
                          {getColumnNames(orderItemsData, 'orderItems').map(column => (
                            <td key={column} className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                              {line[column] || <span className="text-gray-400">—</span>}
                            </td>
                          ))}
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={getColumnNames(orderItemsData, 'orderItems').length} className="px-6 py-16 text-center">
                          <div className="w-16 h-16 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-4">
                            <svg className="w-8 h-8 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
                            </svg>
                          </div>
                          <p className="text-gray-500 text-lg font-medium">No order items found</p>
                          <p className="text-gray-400 text-sm">Order item data will appear here once available</p>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
              
              {/* Add Field Form for Order Lines */}
              <div className="px-6 py-5 border-t border-purple-100 bg-gradient-to-r from-purple-50 to-purple-25">
                <div className="flex items-center gap-2 mb-4">
                  <svg className="w-5 h-5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                  </svg>
                  <h3 className="text-sm font-semibold text-purple-800">Add Custom Field to Order Items</h3>
                </div>
                <div className="flex gap-3 items-end">
                  <div className="flex-1">
                    <label className="block text-xs font-medium text-purple-700 mb-2">Field Name</label>
                    <input
                      type="text"
                      value={newOrderItemField.name}
                      onChange={(e) => setNewOrderItemField({...newOrderItemField, name: e.target.value})}
                      placeholder="e.g., Line Notes, Discount Percent"
                      className="w-full px-4 py-2.5 border border-purple-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent bg-white"
                      disabled={addingField}
                    />
                  </div>
                  <div className="w-36">
                    <label className="block text-xs font-medium text-purple-700 mb-2">Field Type</label>
                    <select
                      value={newOrderItemField.type}
                      onChange={(e) => setNewOrderItemField({...newOrderItemField, type: e.target.value})}
                      className="w-full px-4 py-2.5 border border-purple-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent bg-white"
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
                    onClick={() => addCustomField('order-items', newOrderItemField)}
                    disabled={!newOrderItemField.name.trim() || addingField}
                    className="px-6 py-2.5 bg-purple-600 text-white rounded-lg text-sm font-medium hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 shadow-sm hover:shadow-md"
                  >
                    {addingField ? 'Adding...' : 'Add Field'}
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
