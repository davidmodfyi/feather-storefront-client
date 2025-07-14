import React, { useState, useEffect } from 'react';

const CustomTableCreator = ({ onClose, onCreateTable, accountsData, productsData, ordersData, orderItemsData }) => {
  const [tableName, setTableName] = useState('');
  const [tableDescription, setTableDescription] = useState('');
  const [fields, setFields] = useState([]);
  const [availableAttributes, setAvailableAttributes] = useState({});
  const [loading, setLoading] = useState(false);

  // Get available attributes from existing tables
  useEffect(() => {
    const attributes = {
      accounts: [],
      products: [],
      orders: [],
      orderItems: []
    };

    // Get core attributes from sample data
    if (accountsData && accountsData.length > 0) {
      attributes.accounts = Object.keys(accountsData[0]).map(key => ({
        name: key,
        label: key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
        type: 'core'
      }));
    }

    if (productsData && productsData.length > 0) {
      attributes.products = Object.keys(productsData[0]).map(key => ({
        name: key,
        label: key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
        type: 'core'
      }));
    }

    if (ordersData && ordersData.length > 0) {
      attributes.orders = Object.keys(ordersData[0]).map(key => ({
        name: key,
        label: key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
        type: 'core'
      }));
    }

    if (orderItemsData && orderItemsData.length > 0) {
      attributes.orderItems = Object.keys(orderItemsData[0]).map(key => ({
        name: key,
        label: key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
        type: 'core'
      }));
    }

    // Fetch custom attributes from API
    fetchCustomAttributes(attributes);
  }, [accountsData, productsData, ordersData, orderItemsData]);

  const fetchCustomAttributes = async (coreAttributes) => {
    try {
      const response = await fetch('/api/custom-attributes', {
        credentials: 'include'
      });
      
      if (response.ok) {
        const customAttrs = await response.json();
        
        // Group custom attributes by entity type
        const customByType = {
          accounts: customAttrs.filter(attr => attr.entity_type === 'accounts'),
          products: customAttrs.filter(attr => attr.entity_type === 'products'),
          orders: customAttrs.filter(attr => attr.entity_type === 'orders'),
          orderItems: customAttrs.filter(attr => attr.entity_type === 'order-items')
        };

        // Merge with core attributes
        Object.keys(coreAttributes).forEach(entityType => {
          if (customByType[entityType]) {
            customByType[entityType].forEach(attr => {
              coreAttributes[entityType].push({
                name: attr.attribute_name,
                label: attr.attribute_label || attr.attribute_name,
                type: 'custom',
                dataType: attr.data_type
              });
            });
          }
        });
      }
      
      setAvailableAttributes(coreAttributes);
    } catch (error) {
      console.error('Error fetching custom attributes:', error);
      setAvailableAttributes(coreAttributes);
    }
  };

  const addField = () => {
    setFields([...fields, {
      id: Date.now(),
      name: '',
      label: '',
      sourceTable: '',
      sourceAttribute: '',
      dataType: 'text',
      isKey: false
    }]);
  };

  const addFieldAt = (index) => {
    const newField = {
      id: Date.now(),
      name: '',
      label: '',
      sourceTable: '',
      sourceAttribute: '',
      dataType: 'text',
      isKey: false
    };
    const newFields = [...fields];
    newFields.splice(index + 1, 0, newField);
    setFields(newFields);
  };

  const removeField = (fieldId) => {
    setFields(fields.filter(field => field.id !== fieldId));
  };

  const updateField = (fieldId, updates) => {
    setFields(fields.map(field => 
      field.id === fieldId ? { ...field, ...updates } : field
    ));
  };

  const handleSourceChange = (fieldId, sourceTable, sourceAttribute) => {
    const selectedAttr = availableAttributes[sourceTable]?.find(attr => attr.name === sourceAttribute);
    updateField(fieldId, {
      sourceTable,
      sourceAttribute,
      dataType: selectedAttr?.dataType || 'text',
      label: selectedAttr?.label || sourceAttribute
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Validation
    if (!tableName.trim()) {
      alert('Please enter a table name');
      return;
    }

    if (fields.length === 0) {
      alert('Please add at least one field');
      return;
    }

    for (const field of fields) {
      if (!field.name.trim()) {
        alert('Please enter a name for all fields');
        return;
      }
      if (field.sourceTable && !field.sourceAttribute) {
        alert('Please select a source attribute for linked fields');
        return;
      }
    }

    setLoading(true);
    
    const tableData = {
      name: tableName.trim(),
      description: tableDescription.trim(),
      fields: fields.map(field => ({
        name: field.name.trim(),
        label: field.label.trim(),
        sourceTable: field.sourceTable,
        sourceAttribute: field.sourceAttribute,
        dataType: field.dataType,
        isKey: field.isKey
      }))
    };

    try {
      await onCreateTable(tableData);
    } catch (error) {
      console.error('Error creating table:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b">
          <div className="flex justify-between items-center">
            <h2 className="text-2xl font-bold text-gray-800">Create Custom Table</h2>
            <button
              onClick={onClose}
              className="text-gray-500 hover:text-gray-700 text-2xl"
            >
              &times;
            </button>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Table Basic Info */}
          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Table Name *</label>
              <input
                type="text"
                value={tableName}
                onChange={(e) => setTableName(e.target.value)}
                placeholder="e.g., Price Matrix, Customer Tiers"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Description</label>
              <input
                type="text"
                value={tableDescription}
                onChange={(e) => setTableDescription(e.target.value)}
                placeholder="Brief description of this table's purpose"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          </div>

          {/* Fields Configuration */}
          <div>
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold text-gray-800">Table Fields</h3>
              <button
                type="button"
                onClick={addField}
                className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 flex items-center gap-2"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                </svg>
                Add Row
              </button>
            </div>

            {fields.length === 0 ? (
              <div className="text-center py-8 border-2 border-dashed border-gray-300 rounded-lg">
                <p className="text-gray-500">No fields added yet. Click "Add Row" to get started.</p>
              </div>
            ) : (
              <div className="border border-gray-300 rounded-lg overflow-hidden">
                <table className="w-full">
                  <thead className="bg-gray-50 border-b border-gray-300">
                    <tr>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-600 uppercase tracking-wider w-1/5">
                        Field Name *
                      </th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-600 uppercase tracking-wider w-1/5">
                        Display Label
                      </th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-600 uppercase tracking-wider w-1/5">
                        Source Table
                      </th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-600 uppercase tracking-wider w-1/5">
                        Source Attribute
                      </th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-600 uppercase tracking-wider w-1/6">
                        Data Type
                      </th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-600 uppercase tracking-wider w-16">
                        Key
                      </th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-600 uppercase tracking-wider w-20">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {fields.map((field, index) => (
                      <tr key={field.id} className="hover:bg-gray-50">
                        <td className="px-3 py-2">
                          <input
                            type="text"
                            value={field.name}
                            onChange={(e) => updateField(field.id, { name: e.target.value })}
                            placeholder="e.g., PriceLevel"
                            className="w-full px-2 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500"
                          />
                        </td>
                        <td className="px-3 py-2">
                          <input
                            type="text"
                            value={field.label}
                            onChange={(e) => updateField(field.id, { label: e.target.value })}
                            placeholder="e.g., Price Level"
                            className="w-full px-2 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500"
                          />
                        </td>
                        <td className="px-3 py-2">
                          <select
                            value={field.sourceTable}
                            onChange={(e) => handleSourceChange(field.id, e.target.value, '')}
                            className="w-full px-2 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500"
                          >
                            <option value="">None</option>
                            <option value="accounts">Accounts</option>
                            <option value="products">Products</option>
                            <option value="orders">Orders</option>
                            <option value="orderItems">Order Items</option>
                          </select>
                        </td>
                        <td className="px-3 py-2">
                          <select
                            value={field.sourceAttribute}
                            onChange={(e) => handleSourceChange(field.id, field.sourceTable, e.target.value)}
                            className="w-full px-2 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500"
                            disabled={!field.sourceTable}
                          >
                            <option value="">None</option>
                            {field.sourceTable && availableAttributes[field.sourceTable]?.map(attr => (
                              <option key={attr.name} value={attr.name}>
                                {attr.label} {attr.type === 'custom' ? '(Custom)' : ''}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td className="px-3 py-2">
                          <select
                            value={field.dataType}
                            onChange={(e) => updateField(field.id, { dataType: e.target.value })}
                            className="w-full px-2 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500"
                          >
                            <option value="text">Text</option>
                            <option value="number">Number</option>
                            <option value="date">Date</option>
                            <option value="boolean">Yes/No</option>
                          </select>
                        </td>
                        <td className="px-3 py-2 text-center">
                          <input
                            type="checkbox"
                            checked={field.isKey}
                            onChange={(e) => updateField(field.id, { isKey: e.target.checked })}
                            className="text-indigo-600"
                          />
                        </td>
                        <td className="px-3 py-2">
                          <div className="flex gap-1">
                            <button
                              type="button"
                              onClick={() => addFieldAt(index)}
                              className="text-indigo-600 hover:text-indigo-800 text-sm"
                              title="Add row below"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                              </svg>
                            </button>
                            <button
                              type="button"
                              onClick={() => removeField(field.id)}
                              className="text-red-600 hover:text-red-800 text-sm"
                              title="Delete row"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                              </svg>
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Submit Button */}
          <div className="flex justify-end gap-3 pt-4 border-t">
            <button
              type="button"
              onClick={onClose}
              className="px-6 py-2 text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || fields.length === 0}
              className="px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {loading && (
                <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
              )}
              {loading ? 'Creating...' : 'Create Table'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CustomTableCreator;