import React, { useState } from 'react';

export default function ScriptPanel({ title, scripts, type, onAnalyze, onDelete, onReorder }) {
  const [draggedItem, setDraggedItem] = useState(null);
  const [dragOverIndex, setDragOverIndex] = useState(null);
  const formatDate = (dateString) => {
    if (!dateString) return 'Unknown';
    return new Date(dateString).toLocaleDateString();
  };

  const truncateText = (text, maxLength = 50) => {
    if (!text || text.length <= maxLength) return text;
    return text.substring(0, maxLength) + '...';
  };

  const handleDragStart = (e, script, index) => {
    setDraggedItem({ script, index });
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e, index) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOverIndex(index);
  };

  const handleDragLeave = () => {
    setDragOverIndex(null);
  };

  const handleDrop = (e, dropIndex) => {
    e.preventDefault();
    setDragOverIndex(null);
    
    if (draggedItem && draggedItem.index !== dropIndex) {
      const newScripts = [...scripts];
      const [removed] = newScripts.splice(draggedItem.index, 1);
      newScripts.splice(dropIndex, 0, removed);
      
      // Update sequence order for logic scripts
      if (type === 'logic') {
        newScripts.forEach((script, index) => {
          script.sequenceOrder = index + 1;
        });
      }
      
      onReorder(newScripts);
    }
    
    setDraggedItem(null);
  };

  const handleDragEnd = () => {
    setDraggedItem(null);
    setDragOverIndex(null);
  };

  return (
    <div className="bg-white border rounded-lg p-4 h-full flex flex-col">
      <div className="flex justify-between items-center mb-3">
        <h3 className="text-lg font-semibold text-gray-800">{title}</h3>
        <span className="text-sm bg-gray-100 px-2 py-1 rounded">
          {scripts.length} script{scripts.length !== 1 ? 's' : ''}
        </span>
      </div>
      
      <div className="flex-1 overflow-y-auto space-y-2">
        {scripts.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <p className="mb-2">No scripts yet</p>
            <p className="text-sm">Use the chat below to create customizations!</p>
          </div>
        ) : (
          scripts.map((script, index) => (
            <div
              key={script.id}
              draggable={true}
              onDragStart={(e) => handleDragStart(e, script, index)}
              onDragOver={(e) => handleDragOver(e, index)}
              onDragLeave={handleDragLeave}
              onDrop={(e) => handleDrop(e, index)}
              onDragEnd={handleDragEnd}
              className={`border rounded p-3 hover:shadow-md transition-shadow bg-gray-50 cursor-move relative ${
                dragOverIndex === index ? 'border-blue-400 bg-blue-50' : ''
              } ${draggedItem?.index === index ? 'opacity-50' : ''}`}
            >
              {/* Drag handle indicator */}
              <div className="absolute top-2 left-2 text-gray-400 text-xs">⋮⋮</div>
              
              <div className="flex justify-between items-start mb-2 ml-4">
                <div className="flex-1">
                  <div className="font-medium text-sm">
                    {type === 'ui' 
                      ? truncateText(script.selector || 'Unknown selector')
                      : truncateText(script.description || 'Unknown description')
                    }
                  </div>
                  {type === 'logic' && (
                    <div className="text-xs text-gray-500 mt-1">
                      Trigger: {script.trigger_point || script.triggerPoint}
                      {(script.sequence_order || script.sequenceOrder) && ` • Order: ${script.sequence_order || script.sequenceOrder}`}
                      {script.active !== undefined && (
                        <span className={`ml-2 ${script.active ? 'text-green-600' : 'text-red-600'}`}>
                          {script.active ? '● Active' : '● Inactive'}
                        </span>
                      )}
                    </div>
                  )}
                  <div className="text-xs text-gray-400 mt-1">
                    Created: {formatDate(script.created_at || script.createdAt)}
                  </div>
                </div>
                
                <div className="flex gap-1 ml-2">
                  <button
                    onClick={() => onAnalyze(script)}
                    className="text-blue-500 hover:text-blue-700 text-lg"
                    title="Inspect script (view original prompt and generated code)"
                  >
                    🔍
                  </button>
                  <button
                    onClick={() => onDelete(script)}
                    className="text-red-500 hover:text-red-700 text-lg"
                    title="Delete script"
                  >
                    ❌
                  </button>
                </div>
              </div>
              
              {(script.original_prompt || script.originalPrompt) && (
                <div className="text-xs text-gray-600 mt-2 p-2 bg-white rounded border-l-2 border-blue-200 ml-4">
                  <span className="font-medium">Original request:</span> {truncateText(script.original_prompt || script.originalPrompt, 80)}
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}