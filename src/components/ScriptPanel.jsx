import React from 'react';

export default function ScriptPanel({ title, scripts, type, onAnalyze, onDelete, onReorder }) {
  const formatDate = (dateString) => {
    if (!dateString) return 'Unknown';
    return new Date(dateString).toLocaleDateString();
  };

  const truncateText = (text, maxLength = 50) => {
    if (!text || text.length <= maxLength) return text;
    return text.substring(0, maxLength) + '...';
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
              className="border rounded p-3 hover:shadow-md transition-shadow bg-gray-50"
            >
              <div className="flex justify-between items-start mb-2">
                <div className="flex-1">
                  <div className="font-medium text-sm">
                    {type === 'ui' 
                      ? truncateText(script.selector || 'Unknown selector')
                      : truncateText(script.description || 'Unknown description')
                    }
                  </div>
                  {type === 'logic' && (
                    <div className="text-xs text-gray-500 mt-1">
                      Trigger: {script.triggerPoint}
                      {script.sequenceOrder && ` • Order: ${script.sequenceOrder}`}
                      {script.active !== undefined && (
                        <span className={`ml-2 ${script.active ? 'text-green-600' : 'text-red-600'}`}>
                          {script.active ? '● Active' : '● Inactive'}
                        </span>
                      )}
                    </div>
                  )}
                  <div className="text-xs text-gray-400 mt-1">
                    Created: {formatDate(script.createdAt)}
                  </div>
                </div>
                
                <div className="flex gap-1 ml-2">
                  <button
                    onClick={() => onAnalyze(script)}
                    className="text-blue-500 hover:text-blue-700 text-lg"
                    title="Analyze script"
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
              
              {script.originalPrompt && (
                <div className="text-xs text-gray-600 mt-2 p-2 bg-white rounded border-l-2 border-blue-200">
                  <span className="font-medium">Original request:</span> {truncateText(script.originalPrompt, 80)}
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}