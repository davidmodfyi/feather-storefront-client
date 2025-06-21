import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

export default function CustomerConfigPage({ onLogout, onHome, brandName }) {
  document.title = brandName ? `${brandName} - Configure Customer Cards` : 'Configure Customer Cards - Feather';
  
  const navigate = useNavigate();
  const [availableFields, setAvailableFields] = useState([]);
  const [currentConfig, setCurrentConfig] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [draggedItem, setDraggedItem] = useState(null);

  useEffect(() => {
    fetchAvailableFields();
    fetchCurrentConfig();
  }, []);

  const fetchAvailableFields = async () => {
    try {
      const response = await fetch('/api/available-customer-fields', { credentials: 'include' });
      if (response.ok) {
        const data = await response.json();
        setAvailableFields(data);
      }
    } catch (error) {
      console.error('Error fetching available fields:', error);
    }
  };

  const fetchCurrentConfig = async () => {
    try {
      const response = await fetch('/api/customer-card-config', { credentials: 'include' });
      if (response.ok) {
        const data = await response.json();
        setCurrentConfig(data);
      }
    } catch (error) {
      console.error('Error fetching current config:', error);
    } finally {
      setLoading(false);
    }
  };

  const saveConfiguration = async () => {
    setSaving(true);
    try {
      const response = await fetch('/api/customer-card-config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ configuration: currentConfig })
      });
      
      if (response.ok) {
        alert('Configuration saved successfully!');
      } else {
        alert('Failed to save configuration');
      }
    } catch (error) {
      console.error('Error saving configuration:', error);
      alert('Error saving configuration');
    } finally {
      setSaving(false);
    }
  };

  const addField = (field) => {
    const newField = {
      field_name: field.field_name,
      display_label: field.display_label || field.field_name,
      display_order: currentConfig.length,
      is_visible: true,
      field_type: field.field_type
    };
    setCurrentConfig(prev => [...prev, newField]);
  };

  const removeField = (index) => {
    setCurrentConfig(prev => prev.filter((_, i) => i !== index));
  };

  const updateFieldLabel = (index, newLabel) => {
    setCurrentConfig(prev => prev.map((field, i) => 
      i === index ? { ...field, display_label: newLabel } : field
    ));
  };

  const handleDragStart = (e, index) => {
    setDraggedItem(index);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = (e, targetIndex) => {
    e.preventDefault();
    if (draggedItem === null || draggedItem === targetIndex) return;

    const newConfig = [...currentConfig];
    const draggedField = newConfig[draggedItem];
    newConfig.splice(draggedItem, 1);
    newConfig.splice(targetIndex, 0, draggedField);
    
    // Update display order
    const updatedConfig = newConfig.map((field, index) => ({
      ...field,
      display_order: index
    }));
    
    setCurrentConfig(updatedConfig);
    setDraggedItem(null);
  };

  const resetToDefault = () => {
    if (confirm('Reset to default field configuration? This will remove all customizations.')) {
      const defaultConfig = [
        { field_name: 'name', display_label: 'Name', display_order: 0, is_visible: true, field_type: 'text' },
        { field_name: 'email', display_label: 'Email', display_order: 1, is_visible: true, field_type: 'text' },
        { field_name: 'phone', display_label: 'Phone', display_order: 2, is_visible: true, field_type: 'text' },
        { field_name: 'address', display_label: 'Address', display_order: 3, is_visible: true, field_type: 'text' },
        { field_name: 'city', display_label: 'City', display_order: 4, is_visible: true, field_type: 'text' },
        { field_name: 'state', display_label: 'State', display_order: 5, is_visible: true, field_type: 'text' },
        { field_name: 'zip', display_label: 'ZIP', display_order: 6, is_visible: true, field_type: 'text' }
      ];
      setCurrentConfig(defaultConfig);
    }
  };

  const getAvailableFieldsToAdd = () => {
    const configuredFields = currentConfig.map(c => c.field_name);
    return availableFields.filter(field => !configuredFields.includes(field.field_name));
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-lg">Loading configuration...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      {/* Header */}
      <div className="bg-white rounded-lg shadow-sm border p-6 mb-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Configure Customer Cards</h1>
            <p className="text-gray-600 mt-2">Customize which fields appear on customer cards and how they're arranged</p>
          </div>
          <div className="flex gap-3">
            <button
              onClick={resetToDefault}
              className="px-4 py-2 bg-gray-500 hover:bg-gray-600 text-white rounded-lg transition-colors"
            >
              Reset to Default
            </button>
            <button
              onClick={saveConfiguration}
              disabled={saving}
              className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors disabled:opacity-50"
            >
              {saving ? 'Saving...' : 'Save Configuration'}
            </button>
            <button
              onClick={() => navigate('/backoffice/customers')}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
            >
              Back to Customers
            </button>
            <button onClick={onHome} className="px-3 py-1 bg-gray-400 text-white rounded">Home</button>
            <button onClick={onLogout} className="px-3 py-1 bg-red-500 text-white rounded">Logout</button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Panel - Available Fields */}
        <div className="lg:col-span-1">
          <div className="bg-white rounded-lg shadow-sm border p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
              </svg>
              Available Fields
            </h2>
            
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {getAvailableFieldsToAdd().map((field, index) => (
                <div
                  key={field.field_name}
                  className="flex items-center justify-between p-3 border rounded-lg hover:bg-gray-50 transition-colors"
                >
                  <div className="flex-1">
                    <div className="font-medium text-gray-900">{field.display_label || field.field_name}</div>
                    <div className="text-sm text-gray-500">
                      {field.field_type} • {field.is_custom ? 'Custom' : 'Standard'} field
                    </div>
                  </div>
                  <button
                    onClick={() => addField(field)}
                    className="p-1 text-green-600 hover:bg-green-50 rounded transition-colors"
                    title="Add to card"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                    </svg>
                  </button>
                </div>
              ))}
              
              {getAvailableFieldsToAdd().length === 0 && (
                <div className="text-center py-8 text-gray-500">
                  <p>All available fields have been added to the card</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right Panel - Current Configuration */}
        <div className="lg:col-span-2">
          <div className="bg-white rounded-lg shadow-sm border p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              Customer Card Layout
            </h2>
            
            {/* Preview Card */}
            <div className="mb-6 p-4 border-2 border-dashed border-gray-300 rounded-lg bg-gray-50">
              <h3 className="text-lg font-medium text-gray-900 mb-3">Preview</h3>
              <div className="bg-white border rounded-lg shadow-sm p-4 max-w-md">
                <div className="space-y-2">
                  {currentConfig.map((field, index) => (
                    <div key={index} className="flex justify-between">
                      <span className="font-medium text-gray-700">{field.display_label}:</span>
                      <span className="text-gray-600">Sample {field.field_name}</span>
                    </div>
                  ))}
                  {currentConfig.length === 0 && (
                    <p className="text-gray-500 italic">Add fields to see preview</p>
                  )}
                </div>
              </div>
            </div>

            {/* Configuration List */}
            <div className="space-y-2">
              {currentConfig.map((field, index) => (
                <div
                  key={index}
                  draggable
                  onDragStart={(e) => handleDragStart(e, index)}
                  onDragOver={handleDragOver}
                  onDrop={(e) => handleDrop(e, index)}
                  className="flex items-center gap-3 p-3 border rounded-lg bg-white hover:bg-gray-50 transition-colors cursor-move"
                >
                  {/* Drag Handle */}
                  <div className="text-gray-400 cursor-move">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8h16M4 16h16" />
                    </svg>
                  </div>

                  {/* Order Number */}
                  <div className="flex-shrink-0 w-8 h-8 bg-blue-100 text-blue-800 rounded-full flex items-center justify-center text-sm font-medium">
                    {index + 1}
                  </div>

                  {/* Field Info */}
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-gray-900">{field.field_name}</div>
                    <input
                      type="text"
                      value={field.display_label}
                      onChange={(e) => updateFieldLabel(index, e.target.value)}
                      className="text-sm text-gray-600 border-0 bg-transparent p-0 focus:ring-0 focus:border-gray-300 w-full"
                      placeholder="Display label"
                    />
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => removeField(index)}
                      className="p-1 text-red-600 hover:bg-red-50 rounded transition-colors"
                      title="Remove from card"
                      disabled={field.field_name === 'name'} // Don't allow removing name field
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                </div>
              ))}

              {currentConfig.length === 0 && (
                <div className="text-center py-12 text-gray-500">
                  <svg className="w-12 h-12 mx-auto mb-4 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                  </svg>
                  <p className="text-lg font-medium">No fields configured</p>
                  <p className="text-sm">Add fields from the left panel to customize your customer cards</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}