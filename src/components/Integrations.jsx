import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import FTPIntegration from './FTPIntegration';

export default function Integrations({ onLogout, onHome, brandName }) {
  document.title = brandName ? `${brandName} - Integrations` : 'Integrations - Feather';
  
  const navigate = useNavigate();
  const [selectedIntegration, setSelectedIntegration] = useState('');

  const integrations = [
    {
      id: 'ftp',
      name: 'FTP/SFTP',
      description: 'Connect to FTP or SFTP servers to sync files like Items.csv and Customers.csv',
      color: 'bg-blue-50 border-blue-200',
      icon: '📁'
    },
    {
      id: 'quickbooks',
      name: 'QuickBooks Online',
      description: 'Sync data with QuickBooks Online for accounting integration',
      color: 'bg-green-50 border-green-200',
      icon: '💼'
    },
    {
      id: 'api',
      name: 'Generic API',
      description: 'Connect to any REST API endpoint for custom integrations',
      color: 'bg-purple-50 border-purple-200',
      icon: '🔗'
    }
  ];

  if (selectedIntegration === 'ftp') {
    return (
      <FTPIntegration 
        onBack={() => setSelectedIntegration('')}
        onLogout={onLogout}
        onHome={onHome}
        brandName={brandName}
      />
    );
  }

  return (
    <div className="p-6">
      <div className="flex justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Integrations</h1>
          <p className="text-gray-600 mt-1">Connect to external systems and services</p>
        </div>
        <div className="flex gap-2">
          <button 
            onClick={() => navigate('/backoffice')} 
            className="px-3 py-1 bg-blue-500 text-white rounded hover:bg-blue-600"
          >
            Back
          </button>
          <button 
            onClick={onHome} 
            className="px-3 py-1 bg-gray-400 text-white rounded hover:bg-gray-500"
          >
            Home
          </button>
          <button 
            onClick={onLogout} 
            className="px-3 py-1 bg-red-500 text-white rounded hover:bg-red-600"
          >
            Logout
          </button>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {integrations.map((integration) => (
          <div
            key={integration.id}
            className={`border-2 ${integration.color} p-6 rounded-lg shadow hover:shadow-md transition-shadow cursor-pointer`}
            onClick={() => {
              if (integration.id === 'ftp') {
                setSelectedIntegration('ftp');
              } else {
                alert(`${integration.name} integration coming soon!`);
              }
            }}
          >
            <div className="flex items-center gap-3 mb-3">
              <span className="text-2xl">{integration.icon}</span>
              <h2 className="text-xl font-semibold">{integration.name}</h2>
            </div>
            <p className="text-sm text-gray-600">{integration.description}</p>
            
            {integration.id === 'ftp' && (
              <div className="mt-4 text-xs text-blue-600">
                <p>✓ Ready to configure</p>
              </div>
            )}
            {integration.id !== 'ftp' && (
              <div className="mt-4 text-xs text-gray-400">
                <p>Coming soon...</p>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}