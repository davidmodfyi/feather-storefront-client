import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

export default function LogicScriptsManagement({ onLogout, onHome, brandName }) {
  document.title = brandName ? `${brandName} - Manage Logic Scripts` : 'Manage Logic Scripts - Feather';
  
  const navigate = useNavigate();
  const [scripts, setScripts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [draggedItem, setDraggedItem] = useState(null);

  const triggerPoints = [
    { key: 'storefront_load', label: 'Storefront Load', color: 'bg-blue-50 border-blue-200' },
    { key: 'quantity_change', label: 'Quantity Change', color: 'bg-green-50 border-green-200' },
    { key: 'add_to_cart', label: 'Add to Cart', color: 'bg-yellow-50 border-yellow-200' },
    { key: 'submit', label: 'Submit Order', color: 'bg-red-50 border-red-200' }
  ];

  useEffect(() => {
    fetchScripts();
  }, []);

  async function fetchScripts() {
    try {
      const response = await fetch('/api/logic-scripts', { credentials: 'include' });
      const data = await response.json();
      setScripts(data);
    } catch (error) {
      console.error('Error fetching scripts:', error);
    } finally {
      setLoading(false);
    }
  }

  async function deleteScript(scriptId) {
    if (!confirm('Are you sure you want to delete this script?')) return;
    
    try {
      await fetch(`/api/logic-scripts/${scriptId}`, {
        method: 'DELETE',
        credentials: 'include'
      });
      
      setScripts(prev => prev.filter(script => script.id !== scriptId));
    } catch (error) {
      console.error('Error deleting script:', error);
      alert('Failed to delete script');
    }
  }

  async function toggleScript(scriptId, currentActive) {
    try {
      await fetch(`/api/logic-scripts/${scriptId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ active: !currentActive })
      });
      
      setScripts(prev => prev.map(script => 
        script.id === scriptId ? { ...script, active: !currentActive } : script
      ));
    } catch (error) {
      console.error('Error toggling script:', error);
      alert('Failed to update script');
    }
  }

  function handleDragStart(e, script) {
    setDraggedItem(script);
    e.dataTransfer.effectAllowed = 'move';
  }

  function handleDragOver(e) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  }

  async function handleDrop(e, targetScript) {
    e.preventDefault();
    if (!draggedItem || draggedItem.id === targetScript.id || draggedItem.trigger_point !== targetScript.trigger_point) {
      return;
    }

    // Reorder scripts within the same trigger point
    const triggerScripts = scripts
      .filter(s => s.trigger_point === draggedItem.trigger_point)
      .sort((a, b) => a.sequence_order - b.sequence_order);

    const draggedIndex = triggerScripts.findIndex(s => s.id === draggedItem.id);
    const targetIndex = triggerScripts.findIndex(s => s.id === targetScript.id);

    // Remove dragged item and insert at new position
    const reorderedScripts = [...triggerScripts];
    const [removed] = reorderedScripts.splice(draggedIndex, 1);
    reorderedScripts.splice(targetIndex, 0, removed);

    // Update sequence orders
    const updatedScripts = reorderedScripts.map((script, index) => ({
      id: script.id,
      sequence_order: index + 1
    }));

    try {
      await fetch('/api/logic-scripts/reorder', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ scripts: updatedScripts })
      });

      // Update local state
      setScripts(prev => prev.map(script => {
        const updated = updatedScripts.find(u => u.id === script.id);
        return updated ? { ...script, sequence_order: updated.sequence_order } : script;
      }));
    } catch (error) {
      console.error('Error reordering scripts:', error);
      alert('Failed to reorder scripts');
    }

    setDraggedItem(null);
  }

  function getScriptsByTrigger(triggerPoint) {
    return scripts
      .filter(script => script.trigger_point === triggerPoint)
      .sort((a, b) => a.sequence_order - b.sequence_order);
  }

  if (loading) {
    return (
      <div className="p-6">
        <div className="text-center">Loading scripts...</div>
      </div>
    );
  }

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex justify-between mb-6">
        <div className="flex items-center gap-4">
          <h1 className="text-2xl font-bold">Manage Logic Scripts</h1>
          <button 
            onClick={() => navigate('/backoffice/logic')}
            className="px-4 py-2 bg-purple-600 text-white rounded hover:bg-purple-700"
          >
            ← Back to Chat
          </button>
        </div>
        <div className="flex gap-2">
          <button onClick={() => navigate('/backoffice')} className="px-3 py-1 bg-blue-500 text-white rounded">Backoffice</button>
          <button onClick={onHome} className="px-3 py-1 bg-gray-400 text-white rounded">Home</button>
          <button onClick={onLogout} className="px-3 py-1 bg-red-500 text-white rounded">Logout</button>
        </div>
      </div>

      {/* Instructions */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
        <h2 className="font-semibold text-blue-800 mb-2">📋 How to Manage Scripts</h2>
        <ul className="text-sm text-blue-700 space-y-1">
          <li>• <strong>Drag and drop</strong> scripts within each trigger point to reorder execution</li>
          <li>• <strong>Toggle</strong> scripts on/off using the switch</li>
          <li>• <strong>Delete</strong> scripts using the trash icon</li>
          <li>• Scripts run in order from top to bottom within each trigger point</li>
        </ul>
      </div>

      {/* Script Groups by Trigger Point */}
      <div className="space-y-6">
        {triggerPoints.map(triggerPoint => {
          const triggerScripts = getScriptsByTrigger(triggerPoint.key);
          
          return (
            <div key={triggerPoint.key} className={`border rounded-lg ${triggerPoint.color}`}>
              <div className="p-4 border-b">
                <h3 className="text-lg font-semibold flex items-center gap-2">
                  {triggerPoint.label}
                  <span className="text-sm bg-white px-2 py-1 rounded">
                    {triggerScripts.length} script{triggerScripts.length !== 1 ? 's' : ''}
                  </span>
                </h3>
                <p className="text-sm text-gray-600 mt-1">
                  {triggerPoint.key === 'storefront_load' && 'Runs when customers first visit your storefront'}
                  {triggerPoint.key === 'quantity_change' && 'Runs when customers change item quantities'}
                  {triggerPoint.key === 'add_to_cart' && 'Runs when customers add items to their cart'}
                  {triggerPoint.key === 'submit' && 'Runs before orders are submitted'}
                </p>
              </div>
              
              <div className="p-4">
                {triggerScripts.length === 0 ? (
                  <p className="text-gray-500 text-center py-8">
                    No scripts configured for this trigger point.
                    <br />
                    <button 
                      onClick={() => navigate('/backoffice/logic')}
                      className="text-purple-600 hover:underline mt-2"
                    >
                      Create one with Claude →
                    </button>
                  </p>
                ) : (
                  <div className="space-y-3">
                    {triggerScripts.map((script, index) => (
                      <div
                        key={script.id}
                        draggable
                        onDragStart={(e) => handleDragStart(e, script)}
                        onDragOver={handleDragOver}
                        onDrop={(e) => handleDrop(e, script)}
                        className={`bg-white border rounded-lg p-4 cursor-move hover:shadow-md transition-shadow ${
                          !script.active ? 'opacity-60' : ''
                        }`}
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-2">
                              <span className="text-sm font-mono bg-gray-100 px-2 py-1 rounded">
                                #{index + 1}
                              </span>
                              <h4 className="font-medium">{script.description}</h4>
                              <div className="flex items-center gap-2">
                                <label className="relative inline-flex items-center cursor-pointer">
                                  <input
                                    type="checkbox"
                                    className="sr-only peer"
                                    checked={script.active}
                                    onChange={() => toggleScript(script.id, script.active)}
                                  />
                                  <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-green-600"></div>
                                </label>
                              </div>
                            </div>
                            <p className="text-sm text-gray-600">
                              Created: {new Date(script.created_at).toLocaleDateString()}
                            </p>
                          </div>
                          
                          <div className="flex items-center gap-2 ml-4">
                            <button
                              onClick={() => deleteScript(script.id)}
                              className="p-2 text-red-600 hover:bg-red-50 rounded transition-colors"
                              title="Delete script"
                            >
                              🗑️
                            </button>
                            <div className="text-gray-400 cursor-move">
                              ⋮⋮
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Summary */}
      <div className="mt-8 text-center text-gray-600">
        <p>Total Scripts: {scripts.length} | Active: {scripts.filter(s => s.active).length}</p>
      </div>
    </div>
  );
}