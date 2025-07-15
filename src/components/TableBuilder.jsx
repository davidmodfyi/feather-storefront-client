import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import CustomTableCreator from './CustomTableCreator';

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
  const [newAccountField, setNewAccountField] = useState({ name: '', type: 'text', options: '' });
  const [newProductField, setNewProductField] = useState({ name: '', type: 'text', options: '' });
  const [newOrderField, setNewOrderField] = useState({ name: '', type: 'text', options: '' });
  const [newOrderItemField, setNewOrderItemField] = useState({ name: '', type: 'text', options: '' });
  const [addingField, setAddingField] = useState(false);
  const [debugInfo, setDebugInfo] = useState(null);
  const [customTables, setCustomTables] = useState([]);
  const [showCustomTableCreator, setShowCustomTableCreator] = useState(false);
  const [selectedCustomTable, setSelectedCustomTable] = useState(null);
  const [customTableExpanded, setCustomTableExpanded] = useState({});
  
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
          
          // Process order items with custom attributes merged
          const processedOrderItems = mergeCustomAttributesWithDefinitions(
            orderItemsData.orderItems || [], 
            orderItemsData.customAttributes || [],
            orderItemsData.attributeDefinitions || []
          );
          
          setOrderItemsData(processedOrderItems.slice(0, 10));
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

  const fetchCustomTables = async () => {
    try {
      const response = await fetch('/api/custom-tables', {
        credentials: 'include'
      });
      
      if (response.ok) {
        const data = await response.json();
        setCustomTables(data);
      } else {
        console.log('Custom tables endpoint not available yet');
        setCustomTables([]);
      }
    } catch (error) {
      console.log('Custom tables not implemented yet:', error);
      setCustomTables([]);
    }
  };

  useEffect(() => {
    fetchAllTablesData();
    fetchCustomTables();
  }, []);

  const getColumnNames = (data, entityType) => {
    // Define core column names for each entity type
    const coreColumns = {
      accounts: ['id', 'name', 'email', 'phone', 'address', 'city', 'state', 'zip'],
      products: ['id', 'name', 'description', 'sku', 'unit_price', 'category'],
      orders: ['id', 'customer_name', 'status', 'total_amount', 'order_date'],
      orderItems: ['id', 'order_id', 'name', 'sku', 'quantity', 'unit_price']
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
      
      // Prepare validation_rules based on field type
      let validationRules = {};
      if (fieldData.type === 'dropdown' && fieldData.options) {
        const optionsArray = fieldData.options.split(',').map(option => option.trim()).filter(option => option.length > 0);
        validationRules = {
          type: 'dropdown',
          options: optionsArray
        };
      }
      
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
          validation_rules: JSON.stringify(validationRules),
          display_order: 999
        })
      });

      if (response.ok) {
        // Reset form
        if (entityType === 'accounts') {
          setNewAccountField({ name: '', type: 'text', options: '' });
        } else if (entityType === 'products') {
          setNewProductField({ name: '', type: 'text', options: '' });
        } else if (entityType === 'orders') {
          setNewOrderField({ name: '', type: 'text', options: '' });
        } else if (entityType === 'order-items') {
          setNewOrderItemField({ name: '', type: 'text', options: '' });
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
      
      // Check if this is a custom table export
      if (entityType.startsWith('custom-')) {
        const tableId = entityType.replace('custom-', '');
        const response = await fetch(`/api/table-builder/custom-${tableId}/export`, {
          credentials: 'include'
        });

        if (response.ok) {
          const data = await response.json();
          
          if (!data.data || data.data.length === 0) {
            alert(`No data to export for custom table: ${data.table_name || 'Unknown'}`);
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
          const fileName = data.template ? 
            `${data.table_name}_template_${new Date().toISOString().split('T')[0]}.csv` :
            `${data.table_name}_export_${new Date().toISOString().split('T')[0]}.csv`;
          link.setAttribute('href', url);
          link.setAttribute('download', fileName);
          link.style.visibility = 'hidden';
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          
          const message = data.template ? 
            `Template exported successfully for ${data.table_name}! Fill in the data and upload back.` :
            `Data exported successfully for ${data.table_name}!`;
          alert(message);
        } else {
          const error = await response.json();
          alert('Export error: ' + (error.error || 'Unknown error'));
        }
        return;
      }

      // Handle standard table exports
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
      
      // Check if this is a custom table import
      if (entityType.startsWith('custom-')) {
        const tableId = entityType.replace('custom-', '');
        const response = await fetch(`/api/table-builder/custom-${tableId}/import`, {
          method: 'POST',
          credentials: 'include',
          body: formData
        });

        if (response.ok) {
          const result = await response.json();
          alert(`Import successful! ${result.imported || 0} records imported.`);
          
          // Refresh custom tables data
          fetchCustomTables();
        } else {
          const error = await response.json();
          alert('Import error: ' + (error.error || 'Unknown error'));
        }
        return;
      }
      
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

  const handleCreateCustomTable = async (tableData) => {
    try {
      const response = await fetch('/api/custom-tables', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify(tableData)
      });

      if (response.ok) {
        const newTable = await response.json();
        setCustomTables(prev => [...prev, newTable]);
        setShowCustomTableCreator(false);
        alert('Custom table created successfully!');
      } else {
        const error = await response.json();
        alert('Error creating custom table: ' + (error.error || 'Unknown error'));
      }
    } catch (error) {
      console.error('Error creating custom table:', error);
      alert('Error creating custom table: ' + error.message);
    }
  };

  const handleDeleteCustomTable = async (tableId) => {
    if (!confirm('Are you sure you want to delete this custom table?')) return;
    
    try {
      const response = await fetch(`/api/custom-tables/${tableId}`, {
        method: 'DELETE',
        credentials: 'include'
      });
      
      if (response.ok) {
        setCustomTables(prev => prev.filter(table => table.id !== tableId));
        alert('Custom table deleted successfully');
      } else {
        alert('Failed to delete custom table');
      }
    } catch (error) {
      console.error('Error deleting custom table:', error);
      alert('Error deleting custom table');
    }
  };

  const handleAddCustomTableField = async (tableId) => {
    const nameInput = document.getElementById(`custom-field-name-${tableId}`);
    const typeSelect = document.getElementById(`custom-field-type-${tableId}`);
    const optionsInput = document.getElementById(`custom-field-options-${tableId}`);
    
    const name = nameInput.value.trim();
    const dataType = typeSelect.value;
    const options = optionsInput.value.trim();
    
    if (!name) {
      alert('Please enter a field name');
      return;
    }
    
    if (dataType === 'dropdown' && !options) {
      alert('Please enter options for dropdown field');
      return;
    }
    
    try {
      setAddingField(true);
      
      const response = await fetch(`/api/custom-tables/${tableId}/add-field`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          name: name,
          label: name,
          data_type: dataType,
          options: options
        })
      });

      if (response.ok) {
        // Clear form
        nameInput.value = '';
        typeSelect.value = 'text';
        optionsInput.value = '';
        
        // Refresh custom tables to show new field
        await fetchCustomTables();
        
        alert('Custom field added successfully!');
      } else {
        const error = await response.json();
        console.error('Server error details:', error);
        const errorMessage = error.details 
          ? `${error.error}: ${error.details}` 
          : (error.error || 'Unknown error');
        alert('Error adding field: ' + errorMessage);
      }
    } catch (error) {
      console.error('Error adding custom field:', error);
      alert('Error adding custom field: ' + error.message);
    } finally {
      setAddingField(false);
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
    <div className="min-h-screen bg-gray-50 py-6">
      <div className="max-w-7xl mx-auto px-6">
        {/* Header */}
        <div className="flex justify-between items-center mb-8">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-slate-700 rounded-lg flex items-center justify-center">
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                </svg>
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Table Builder</h1>
                <p className="text-sm text-gray-500">Manage your data tables and custom fields</p>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2 text-sm text-gray-500">
            <span className="px-2 py-1 bg-white rounded-full border">{accountsData.length} accounts</span>
            <span className="px-2 py-1 bg-white rounded-full border">{productsData.length} products</span>
            <span className="px-2 py-1 bg-white rounded-full border">{ordersData.length} orders</span>
            <span className="px-2 py-1 bg-white rounded-full border">{orderItemsData.length} items</span>
          </div>
          <div className="flex gap-2">
            <button 
              onClick={debugCustomAttributes}
              className="px-3 py-2 bg-amber-100 hover:bg-amber-200 text-amber-800 rounded-md text-sm font-medium transition-colors"
            >
              Debug
            </button>
            <button 
              onClick={() => navigate('/backoffice')} 
              className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-md text-sm font-medium transition-colors"
            >
              Back
            </button>
            <button 
              onClick={onHome} 
              className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-md text-sm font-medium transition-colors"
            >
              Home
            </button>
            <button 
              onClick={onLogout} 
              className="px-3 py-2 bg-red-100 hover:bg-red-200 text-red-700 rounded-md text-sm font-medium transition-colors"
            >
              Logout
            </button>
          </div>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl">
            <p className="text-red-700 font-medium">Error: {error}</p>
            <button 
              onClick={fetchAllTablesData}
              className="mt-3 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
            >
              Retry
            </button>
          </div>
        )}

        {/* Core Tables Section */}
        <div className="mb-10">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
              <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
              </svg>
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Core Tables</h2>
              <p className="text-sm text-gray-500">Built-in data tables with customizable fields</p>
            </div>
          </div>
          
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Accounts Table */}
            <div className="bg-white rounded-lg border border-gray-200 shadow-sm hover:shadow-md transition-shadow">
              <div 
                className="px-4 py-3 bg-slate-50 cursor-pointer hover:bg-slate-100 transition-colors flex justify-between items-center"
                onClick={() => setAccountsExpanded(!accountsExpanded)}
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
                    <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z" />
                    </svg>
                  </div>
                  <div>
                    <h3 className="font-medium text-gray-900">Accounts</h3>
                    <p className="text-sm text-gray-500">{accountsData.length} records</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      exportToCSV('accounts');
                    }}
                    className="px-2 py-1 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded text-xs font-medium transition-colors flex items-center gap-1"
                    disabled={loading}
                  >
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    Export
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      triggerFileUpload('accounts');
                    }}
                    className="px-2 py-1 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded text-xs font-medium transition-colors flex items-center gap-1"
                    disabled={loading}
                  >
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M9 19l3 3m0 0l3-3m-3 3V10" />
                    </svg>
                    Import
                  </button>
                  <div className="text-gray-400">
                    <svg 
                      className={`w-4 h-4 transition-transform ${accountsExpanded ? 'rotate-90' : ''}`} 
                      fill="none" 
                      stroke="currentColor" 
                      viewBox="0 0 24 24"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
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
                <div className="space-y-3">
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
                        <option value="dropdown">Dropdown</option>
                      </select>
                    </div>
                  </div>
                  {newAccountField.type === 'dropdown' && (
                    <div>
                      <label className="block text-xs font-medium text-blue-700 mb-2">Dropdown Options</label>
                      <input
                        type="text"
                        value={newAccountField.options}
                        onChange={(e) => setNewAccountField({...newAccountField, options: e.target.value})}
                        placeholder="Enter options separated by commas, e.g., Option 1, Option 2, Option 3"
                        className="w-full px-4 py-2.5 border border-blue-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
                        disabled={addingField}
                      />
                      <p className="text-xs text-blue-600 mt-1">Separate options with commas</p>
                    </div>
                  )}
                  <div className="flex justify-end">
                    <button
                      onClick={() => addCustomField('accounts', newAccountField)}
                      disabled={!newAccountField.name.trim() || addingField || (newAccountField.type === 'dropdown' && !newAccountField.options.trim())}
                      className="px-6 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 shadow-sm hover:shadow-md"
                    >
                      {addingField ? 'Adding...' : 'Add Field'}
                    </button>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>

            {/* Products Table */}
            <div className="bg-white rounded-lg border border-gray-200 shadow-sm hover:shadow-md transition-shadow">
              <div 
                className="px-4 py-3 bg-slate-50 cursor-pointer hover:bg-slate-100 transition-colors flex justify-between items-center"
                onClick={() => setProductsExpanded(!productsExpanded)}
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-emerald-100 rounded-lg flex items-center justify-center">
                    <svg className="w-4 h-4 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                    </svg>
                  </div>
                  <div>
                    <h3 className="font-medium text-gray-900">Products</h3>
                    <p className="text-sm text-gray-500">{productsData.length} records</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      exportToCSV('products');
                    }}
                    className="px-2 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded text-xs font-medium transition-colors flex items-center gap-1"
                    disabled={loading}
                  >
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    Export
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      triggerFileUpload('products');
                    }}
                    className="px-2 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded text-xs font-medium transition-colors flex items-center gap-1"
                    disabled={loading}
                  >
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M9 19l3 3m0 0l3-3m-3 3V10" />
                    </svg>
                    Import
                  </button>
                  <div className="text-gray-400">
                    <svg 
                      className={`w-4 h-4 transition-transform ${productsExpanded ? 'rotate-90' : ''}`} 
                      fill="none" 
                      stroke="currentColor" 
                      viewBox="0 0 24 24"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
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
                <div className="space-y-3">
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
                        <option value="dropdown">Dropdown</option>
                      </select>
                    </div>
                  </div>
                  {newProductField.type === 'dropdown' && (
                    <div>
                      <label className="block text-xs font-medium text-emerald-700 mb-2">Dropdown Options</label>
                      <input
                        type="text"
                        value={newProductField.options}
                        onChange={(e) => setNewProductField({...newProductField, options: e.target.value})}
                        placeholder="Enter options separated by commas, e.g., Option 1, Option 2, Option 3"
                        className="w-full px-4 py-2.5 border border-emerald-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent bg-white"
                        disabled={addingField}
                      />
                      <p className="text-xs text-emerald-600 mt-1">Separate options with commas</p>
                    </div>
                  )}
                  <div className="flex justify-end">
                    <button
                      onClick={() => addCustomField('products', newProductField)}
                      disabled={!newProductField.name.trim() || addingField || (newProductField.type === 'dropdown' && !newProductField.options.trim())}
                      className="px-6 py-2.5 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 shadow-sm hover:shadow-md"
                    >
                      {addingField ? 'Adding...' : 'Add Field'}
                    </button>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>

            {/* Orders Table */}
            <div className="bg-white rounded-lg border border-gray-200 shadow-sm hover:shadow-md transition-shadow">
              <div 
                className="px-4 py-3 bg-slate-50 cursor-pointer hover:bg-slate-100 transition-colors flex justify-between items-center"
                onClick={() => setOrdersExpanded(!ordersExpanded)}
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-orange-100 rounded-lg flex items-center justify-center">
                    <svg className="w-4 h-4 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                  </div>
                  <div>
                    <h3 className="font-medium text-gray-900">Orders</h3>
                    <p className="text-sm text-gray-500">{ordersData.length} records</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      exportToCSV('orders');
                    }}
                    className="px-2 py-1 bg-orange-50 hover:bg-orange-100 text-orange-700 rounded text-xs font-medium transition-colors flex items-center gap-1"
                    disabled={loading}
                  >
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    Export
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      triggerFileUpload('orders');
                    }}
                    className="px-2 py-1 bg-orange-50 hover:bg-orange-100 text-orange-700 rounded text-xs font-medium transition-colors flex items-center gap-1"
                    disabled={loading}
                  >
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M9 19l3 3m0 0l3-3m-3 3V10" />
                    </svg>
                    Import
                  </button>
                  <div className="text-gray-400">
                    <svg 
                      className={`w-4 h-4 transition-transform ${ordersExpanded ? 'rotate-90' : ''}`} 
                      fill="none" 
                      stroke="currentColor" 
                      viewBox="0 0 24 24"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
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
                <div className="space-y-3">
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
                        <option value="dropdown">Dropdown</option>
                      </select>
                    </div>
                  </div>
                  {newOrderField.type === 'dropdown' && (
                    <div>
                      <label className="block text-xs font-medium text-orange-700 mb-2">Dropdown Options</label>
                      <input
                        type="text"
                        value={newOrderField.options}
                        onChange={(e) => setNewOrderField({...newOrderField, options: e.target.value})}
                        placeholder="Enter options separated by commas, e.g., Option 1, Option 2, Option 3"
                        className="w-full px-4 py-2.5 border border-orange-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent bg-white"
                        disabled={addingField}
                      />
                      <p className="text-xs text-orange-600 mt-1">Separate options with commas</p>
                    </div>
                  )}
                  <div className="flex justify-end">
                    <button
                      onClick={() => addCustomField('orders', newOrderField)}
                      disabled={!newOrderField.name.trim() || addingField || (newOrderField.type === 'dropdown' && !newOrderField.options.trim())}
                      className="px-6 py-2.5 bg-orange-600 text-white rounded-lg text-sm font-medium hover:bg-orange-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 shadow-sm hover:shadow-md"
                    >
                      {addingField ? 'Adding...' : 'Add Field'}
                    </button>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>

            {/* Order Items Table */}
            <div className="bg-white rounded-lg border border-gray-200 shadow-sm hover:shadow-md transition-shadow">
              <div 
                className="px-4 py-3 bg-slate-50 cursor-pointer hover:bg-slate-100 transition-colors flex justify-between items-center"
                onClick={() => setOrderItemsExpanded(!orderItemsExpanded)}
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-indigo-100 rounded-lg flex items-center justify-center">
                    <svg className="w-4 h-4 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
                    </svg>
                  </div>
                  <div>
                    <h3 className="font-medium text-gray-900">Order Items</h3>
                    <p className="text-sm text-gray-500">{orderItemsData.length} records</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      exportToCSV('order-items');
                    }}
                    className="px-2 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded text-xs font-medium transition-colors flex items-center gap-1"
                    disabled={loading}
                  >
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    Export
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      triggerFileUpload('order-items');
                    }}
                    className="px-2 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded text-xs font-medium transition-colors flex items-center gap-1"
                    disabled={loading}
                  >
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M9 19l3 3m0 0l3-3m-3 3V10" />
                    </svg>
                    Import
                  </button>
                  <div className="text-gray-400">
                    <svg 
                      className={`w-4 h-4 transition-transform ${orderItemsExpanded ? 'rotate-90' : ''}`} 
                      fill="none" 
                      stroke="currentColor" 
                      viewBox="0 0 24 24"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
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
                <div className="space-y-3">
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
                        <option value="dropdown">Dropdown</option>
                      </select>
                    </div>
                  </div>
                  {newOrderItemField.type === 'dropdown' && (
                    <div>
                      <label className="block text-xs font-medium text-purple-700 mb-2">Dropdown Options</label>
                      <input
                        type="text"
                        value={newOrderItemField.options}
                        onChange={(e) => setNewOrderItemField({...newOrderItemField, options: e.target.value})}
                        placeholder="Enter options separated by commas, e.g., Option 1, Option 2, Option 3"
                        className="w-full px-4 py-2.5 border border-purple-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent bg-white"
                        disabled={addingField}
                      />
                      <p className="text-xs text-purple-600 mt-1">Separate options with commas</p>
                    </div>
                  )}
                  <div className="flex justify-end">
                    <button
                      onClick={() => addCustomField('order-items', newOrderItemField)}
                      disabled={!newOrderItemField.name.trim() || addingField || (newOrderItemField.type === 'dropdown' && !newOrderItemField.options.trim())}
                      className="px-6 py-2.5 bg-purple-600 text-white rounded-lg text-sm font-medium hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 shadow-sm hover:shadow-md"
                    >
                      {addingField ? 'Adding...' : 'Add Field'}
                    </button>
                  </div>
                </div>
              </div>
            </>
          )}
          </div>
        </div>

        {/* Custom Tables Section */}
        {customTables.length > 0 && (
          <div className="mb-10">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-8 h-8 bg-purple-100 rounded-lg flex items-center justify-center">
                <svg className="w-5 h-5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 100 4m0-4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 100 4m0-4v2m0-6V4" />
                </svg>
              </div>
              <div>
                <h2 className="text-lg font-semibold text-gray-900">Custom Tables</h2>
                <p className="text-sm text-gray-500">User-created tables with custom field definitions</p>
              </div>
            </div>
            
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {customTables.map((table) => (
                  <div key={table.id} className="bg-white rounded-lg border border-purple-200 shadow-sm hover:shadow-md transition-shadow">
                    <div 
                      className="px-4 py-3 bg-purple-50 cursor-pointer hover:bg-purple-100 transition-colors flex justify-between items-center"
                      onClick={() => setCustomTableExpanded(prev => ({ ...prev, [table.id]: !prev[table.id] }))}
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-purple-100 rounded-lg flex items-center justify-center">
                          <svg className="w-4 h-4 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 100 4m0-4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 100 4m0-4v2m0-6V4" />
                          </svg>
                        </div>
                        <div>
                          <h3 className="font-medium text-gray-900">{table.name}</h3>
                          <p className="text-sm text-gray-500">
                            {table.data && table.data.length > 0 
                              ? `${table.data.length} records` 
                              : 'No data'
                            } • {table.fields?.length || 0} fields
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            exportToCSV(`custom-${table.id}`);
                          }}
                          className="px-2 py-1 bg-purple-50 hover:bg-purple-100 text-purple-700 rounded text-xs font-medium transition-colors flex items-center gap-1"
                          disabled={loading}
                        >
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                          </svg>
                          Export
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            triggerFileUpload(`custom-${table.id}`);
                          }}
                          className="px-2 py-1 bg-purple-50 hover:bg-purple-100 text-purple-700 rounded text-xs font-medium transition-colors flex items-center gap-1"
                          disabled={loading}
                        >
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M9 19l3 3m0 0l3-3m-3 3V10" />
                          </svg>
                          Import
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteCustomTable(table.id);
                          }}
                          className="px-2 py-1 bg-red-50 hover:bg-red-100 text-red-700 rounded text-xs font-medium transition-colors flex items-center gap-1"
                        >
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                          Delete
                        </button>
                        <div className="text-gray-400">
                          <svg 
                            className={`w-4 h-4 transition-transform ${customTableExpanded[table.id] ? 'rotate-90' : ''}`} 
                            fill="none" 
                            stroke="currentColor" 
                            viewBox="0 0 24 24"
                          >
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                          </svg>
                        </div>
                      </div>
                    </div>
            
            {customTableExpanded[table.id] && (
              <div className="p-6">
                {table.data && table.data.length > 0 ? (
                  <div className="overflow-x-auto">
                    <table className="w-full border-collapse border border-gray-300">
                      <thead>
                        <tr className="bg-gray-50">
                          {table.fields.map((field, index) => (
                            <th key={index} className="border border-gray-300 px-4 py-2 text-left font-medium text-gray-700">
                              {field.label || field.name}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {table.data.slice(0, 10).map((row, rowIndex) => (
                          <tr key={rowIndex} className={rowIndex % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                            {table.fields.map((field, fieldIndex) => (
                              <td key={fieldIndex} className="border border-gray-300 px-4 py-2 text-gray-900">
                                {row[field.name] || ''}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {table.data.length > 10 && (
                      <p className="text-sm text-gray-500 mt-2">
                        Showing first 10 of {table.data.length} records
                      </p>
                    )}
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <p className="text-gray-500 text-lg font-medium">Custom Table: {table.name}</p>
                    <p className="text-gray-400 text-sm">
                      {table.fields ? `${table.fields.length} custom fields configured` : 'No fields configured yet'}
                    </p>
                    <p className="text-gray-400 text-sm mt-2">
                      No data uploaded yet. Use "Export to Excel" to get a template.
                    </p>
                  </div>
                )}
                
                {/* Add Custom Field Section */}
                <div className="mt-6 pt-6 border-t border-gray-200">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-semibold text-gray-800">Add Custom Field</h3>
                  </div>
                  <div className="grid md:grid-cols-4 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Field Name</label>
                      <input
                        type="text"
                        placeholder="e.g., NewField"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 text-sm"
                        id={`custom-field-name-${table.id}`}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Field Type</label>
                      <select
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 text-sm"
                        id={`custom-field-type-${table.id}`}
                      >
                        <option value="text">Text</option>
                        <option value="number">Number</option>
                        <option value="date">Date</option>
                        <option value="boolean">Yes/No</option>
                        <option value="dropdown">Dropdown</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Options (if dropdown)</label>
                      <input
                        type="text"
                        placeholder="Option1,Option2,Option3"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 text-sm"
                        id={`custom-field-options-${table.id}`}
                      />
                    </div>
                    <div className="flex items-end">
                      <button
                        onClick={() => handleAddCustomTableField(table.id)}
                        disabled={addingField}
                        className="w-full px-4 py-2 bg-purple-600 text-white rounded-lg text-sm font-medium hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
                      >
                        {addingField ? 'Adding...' : 'Add Field'}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Add Custom Table Button */}
          <div className="flex justify-center mt-8">
            <button
              onClick={() => setShowCustomTableCreator(true)}
              className="px-6 py-3 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-medium transition-colors flex items-center gap-2 shadow-sm hover:shadow-md"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
              </svg>
              Add Custom Table
            </button>
          </div>
      </div>

      {/* Custom Table Creator Modal */}
      {showCustomTableCreator && (
        <CustomTableCreator
          onClose={() => setShowCustomTableCreator(false)}
          onCreateTable={handleCreateCustomTable}
          accountsData={accountsData}
          productsData={productsData}
          ordersData={ordersData}
          orderItemsData={orderItemsData}
        />
      )}
      </div>
    </div>
  );
}
