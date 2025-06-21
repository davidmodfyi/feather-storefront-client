import React, { useState } from 'react';

export default function FTPIntegration({ onBack, onLogout, onHome, brandName }) {
  document.title = brandName ? `${brandName} - FTP Integration` : 'FTP Integration - Feather';
  
  const [ftpConfig, setFtpConfig] = useState({
    host: '',
    port: '21',
    username: '',
    password: '',
    protocol: 'ftp', // 'ftp' or 'sftp'
    directory: '/'
  });
  
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [files, setFiles] = useState([]);
  const [connectionError, setConnectionError] = useState('');

  const handleInputChange = (field, value) => {
    setFtpConfig(prev => ({
      ...prev,
      [field]: value
    }));
    // Clear error when user starts typing
    if (connectionError) {
      setConnectionError('');
    }
  };

  const handleConnect = async () => {
    if (!ftpConfig.host || !ftpConfig.username || !ftpConfig.password) {
      setConnectionError('Please fill in all required fields');
      return;
    }

    setIsConnecting(true);
    setConnectionError('');

    try {
      const response = await fetch('/api/ftp/connect', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        credentials: 'include',
        body: JSON.stringify(ftpConfig)
      });

      const data = await response.json();

      if (response.ok) {
        setIsConnected(true);
        setFiles(data.files || []);
      } else {
        setConnectionError(data.error || 'Failed to connect to FTP server');
      }
    } catch (error) {
      setConnectionError('Network error: ' + error.message);
    } finally {
      setIsConnecting(false);
    }
  };

  const handleDisconnect = () => {
    setIsConnected(false);
    setFiles([]);
    setConnectionError('');
  };

  const handleTestNetwork = async () => {
    if (!ftpConfig.host) {
      setConnectionError('Please enter a host first');
      return;
    }

    setIsConnecting(true);
    setConnectionError('');

    try {
      const response = await fetch('/api/ftp/test-connection', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        credentials: 'include',
        body: JSON.stringify(ftpConfig)
      });

      const data = await response.json();
      if (response.ok) {
        alert(`Network test successful!\n\nMessage: ${data.message}\nEnvironment: ${data.environment.platform} ${data.environment.nodeVersion}`);
      } else {
        setConnectionError(`Network test failed: ${data.error}`);
      }
    } catch (error) {
      setConnectionError('Network test error: ' + error.message);
    } finally {
      setIsConnecting(false);
    }
  };

  const handleRefresh = async () => {
    if (!isConnected) return;
    
    setIsConnecting(true);
    try {
      const response = await fetch('/api/ftp/list', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        credentials: 'include',
        body: JSON.stringify(ftpConfig)
      });

      const data = await response.json();
      if (response.ok) {
        setFiles(data.files || []);
      } else {
        setConnectionError(data.error || 'Failed to refresh file list');
      }
    } catch (error) {
      setConnectionError('Network error: ' + error.message);
    } finally {
      setIsConnecting(false);
    }
  };

  return (
    <div className="p-6">
      <div className="flex justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">FTP/SFTP Integration</h1>
          <p className="text-gray-600 mt-1">Configure FTP or SFTP connection to sync files</p>
        </div>
        <div className="flex gap-2">
          <button 
            onClick={onBack}
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

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Connection Configuration */}
        <div className="bg-white border rounded-lg p-6 shadow">
          <h2 className="text-lg font-semibold mb-4">Connection Settings</h2>
          
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Protocol
              </label>
              <select
                value={ftpConfig.protocol}
                onChange={(e) => handleInputChange('protocol', e.target.value)}
                className="w-full border rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                disabled={isConnected}
              >
                <option value="ftp">FTP</option>
                <option value="sftp">SFTP</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Host *
              </label>
              <input
                type="text"
                value={ftpConfig.host}
                onChange={(e) => handleInputChange('host', e.target.value)}
                placeholder="ftp.example.com"
                className="w-full border rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                disabled={isConnected}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Port
              </label>
              <input
                type="number"
                value={ftpConfig.port}
                onChange={(e) => handleInputChange('port', e.target.value)}
                placeholder={ftpConfig.protocol === 'sftp' ? '22' : '21'}
                className="w-full border rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                disabled={isConnected}
              />
              <p className="text-xs text-orange-600 mt-1">
                ⚠️ If SFTP fails, try FTP protocol instead - some servers block SSH from certain IP ranges
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Username *
              </label>
              <input
                type="text"
                value={ftpConfig.username}
                onChange={(e) => handleInputChange('username', e.target.value)}
                placeholder="your-username"
                className="w-full border rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                disabled={isConnected}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Password *
              </label>
              <input
                type="password"
                value={ftpConfig.password}
                onChange={(e) => handleInputChange('password', e.target.value)}
                placeholder="your-password"
                className="w-full border rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                disabled={isConnected}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Directory
              </label>
              <input
                type="text"
                value={ftpConfig.directory}
                onChange={(e) => handleInputChange('directory', e.target.value)}
                placeholder="/"
                className="w-full border rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                disabled={isConnected}
              />
            </div>

            {connectionError && (
              <div className="bg-red-50 border border-red-200 rounded p-3">
                <p className="text-red-700 text-sm">{connectionError}</p>
              </div>
            )}

            <div className="flex flex-col gap-2">
              <button
                onClick={handleTestNetwork}
                disabled={isConnecting}
                className="w-full bg-purple-500 text-white py-2 px-4 rounded hover:bg-purple-600 disabled:opacity-50"
              >
                {isConnecting ? 'Testing...' : 'Test Network Connection'}
              </button>
              
              {!isConnected ? (
                <button
                  onClick={handleConnect}
                  disabled={isConnecting}
                  className="w-full bg-blue-500 text-white py-2 px-4 rounded hover:bg-blue-600 disabled:opacity-50"
                >
                  {isConnecting ? 'Connecting...' : 'Connect & List Files'}
                </button>
              ) : (
                <div className="flex gap-2 w-full">
                  <button
                    onClick={handleRefresh}
                    disabled={isConnecting}
                    className="flex-1 bg-green-500 text-white py-2 px-4 rounded hover:bg-green-600 disabled:opacity-50"
                  >
                    {isConnecting ? 'Refreshing...' : 'Refresh Files'}
                  </button>
                  <button
                    onClick={handleDisconnect}
                    className="flex-1 bg-gray-500 text-white py-2 px-4 rounded hover:bg-gray-600"
                  >
                    Disconnect
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* File Listing */}
        <div className="bg-white border rounded-lg p-6 shadow">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-semibold">Files</h2>
            {isConnected && (
              <span className="text-sm text-green-600 flex items-center gap-1">
                <span className="w-2 h-2 bg-green-500 rounded-full"></span>
                Connected
              </span>
            )}
          </div>

          {!isConnected ? (
            <div className="text-center py-8 text-gray-500">
              <div className="text-4xl mb-2">📁</div>
              <p>Connect to FTP server to view files</p>
            </div>
          ) : files.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <div className="text-4xl mb-2">📂</div>
              <p>No files found in the directory</p>
            </div>
          ) : (
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {files.map((file, index) => (
                <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded border">
                  <div className="flex items-center gap-3">
                    <span className="text-lg">
                      {file.type === 'directory' ? '📁' : '📄'}
                    </span>
                    <div>
                      <p className="font-medium">{file.name}</p>
                      <p className="text-xs text-gray-500">
                        {file.type === 'file' && file.size && `${file.size} bytes`}
                        {file.date && ` • ${new Date(file.date).toLocaleDateString()}`}
                      </p>
                    </div>
                  </div>
                  
                  {file.type === 'file' && (file.name.endsWith('.csv') || file.name.endsWith('.txt')) && (
                    <div className="flex gap-1">
                      <button
                        className="text-blue-500 hover:text-blue-700 text-sm px-2 py-1 rounded"
                        onClick={() => alert(`Preview of ${file.name} coming soon!`)}
                      >
                        Preview
                      </button>
                      <button
                        className="text-green-500 hover:text-green-700 text-sm px-2 py-1 rounded"
                        onClick={() => alert(`Download of ${file.name} coming soon!`)}
                      >
                        Download
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}