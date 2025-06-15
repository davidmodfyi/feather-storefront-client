// Fix for Branding.jsx

import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';

export default function Branding({ onLogout, onHome, brandName }) {
  // Set title directly at component level
  document.title = brandName ? `${brandName} - Branding` : 'Branding - Feather';
  
  const [logo, setLogo] = useState(null);
  const [headerLogo, setHeaderLogo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [fileInput, setFileInput] = useState(null);
  const [headerFileInput, setHeaderFileInput] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    // Fetch logo information
    fetchLogo();
    fetchHeaderLogo();
  }, []);

  const fetchLogo = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/branding/logo', {
        credentials: 'include'
      });
      
      if (response.ok) {
        const data = await response.json();
        setLogo(data.logo);
      }
    } catch (error) {
      console.error('Error fetching logo:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchHeaderLogo = async () => {
    try {
      const response = await fetch('/api/branding/header-logo', {
        credentials: 'include'
      });
      
      if (response.ok) {
        const data = await response.json();
        setHeaderLogo(data.logo);
      }
    } catch (error) {
      console.error('Error fetching header logo:', error);
    }
  };

  const handleFileSelect = (e) => {
    setFileInput(e.target.files[0]);
  };
  
  const handleHeaderFileSelect = (e) => {
    setHeaderFileInput(e.target.files[0]);
  };
  
  const handleUpload = async () => {
    if (!fileInput) {
      alert('Please select a file first');
      return;
    }
    
    // Check file type
    if (!fileInput.type.match('image.*')) {
      alert('Please select an image file');
      return;
    }
    
    // Check file size (max 1MB)
    if (fileInput.size > 1000000) {
      alert('File size must be less than 1MB');
      return;
    }
    
    try {
      setUploading(true);
      
      const formData = new FormData();
      formData.append('logo', fileInput);
      
      const response = await fetch('/api/branding/logo', {
        method: 'POST',
        credentials: 'include',
        body: formData
      });
      
      if (!response.ok) {
        throw new Error('Failed to upload logo');
      }
      
      const data = await response.json();
      setLogo(data.logo);
      setFileInput(null);
      
      // Reset file input
      document.getElementById('logoInput').value = '';
      
      alert('Logo uploaded successfully');
    } catch (error) {
      console.error('Error uploading logo:', error);
      alert('Error uploading logo: ' + error.message);
    } finally {
      setUploading(false);
    }
  };
  
 const handleHeaderLogoUpload = async () => {
  const fileInput = document.getElementById('headerLogoInput');
  const file = fileInput.files[0];
  
  if (!file) {
    alert('Please select a file first');
    return;
  }
  
  // Check file type and size
  if (!file.type.match('image.*')) {
    alert('Please select an image file');
    return;
  }
  
  if (file.size > 1000000) {
    alert('File size must be less than 1MB');
    return;
  }
  
  try {
    setUploading(true);
    
    const formData = new FormData();
    formData.append('logo', file);
    
    // Log the FormData (for debugging)
    console.log('FormData contents:', {
      fileName: file.name,
      fileType: file.type,
      fileSize: file.size
    });
    
    const response = await fetch('/api/branding/header-logo', {
      method: 'POST',
      credentials: 'include',
      body: formData
    });
    
    const responseText = await response.text();
    console.log('Raw response:', responseText);
    
    let data;
    try {
      data = JSON.parse(responseText);
    } catch (e) {
      console.error('Error parsing response:', e);
      throw new Error('Invalid response format');
    }
    
    if (!response.ok) {
      throw new Error(data.error || 'Failed to upload header logo');
    }
    
    setHeaderLogo(data.logo);
    console.log('Logo uploaded successfully:', data.logo);
    
    // Reset file input
    fileInput.value = '';
    
    alert('Header logo uploaded successfully');
  } catch (error) {
    console.error('Error uploading header logo:', error);
    alert('Error uploading header logo: ' + error.message);
  } finally {
    setUploading(false);
  }
};
  
  const handleDelete = async () => {
    if (!logo) return;
    
    if (!window.confirm('Are you sure you want to delete the current logo?')) {
      return;
    }
    
    try {
      setUploading(true);
      
      const response = await fetch('/api/branding/logo', {
        method: 'DELETE',
        credentials: 'include'
      });
      
      if (!response.ok) {
        throw new Error('Failed to delete logo');
      }
      
      setLogo(null);
      alert('Logo deleted successfully');
    } catch (error) {
      console.error('Error deleting logo:', error);
      alert('Error deleting logo: ' + error.message);
    } finally {
      setUploading(false);
    }
  };
  
  const handleHeaderLogoDelete = async () => {
    if (!headerLogo) return;
    
    if (!window.confirm('Are you sure you want to delete the current header logo?')) {
      return;
    }
    
    try {
      setUploading(true);
      
      const response = await fetch('/api/branding/header-logo', {
        method: 'DELETE',
        credentials: 'include'
      });
      
      if (!response.ok) {
        throw new Error('Failed to delete header logo');
      }
      
      setHeaderLogo(null);
      alert('Header logo deleted successfully');
    } catch (error) {
      console.error('Error deleting header logo:', error);
      alert('Error deleting header logo: ' + error.message);
    } finally {
      setUploading(false);
    }
  };
  
  function goToBackoffice() {
    navigate('/backoffice');
  }

  return (
    <div className="p-6">
      <div className="flex justify-between mb-4">
        <h1 className="text-2xl font-bold">Brand Configuration</h1>
        <div className="flex gap-2">
          <button onClick={goToBackoffice} className="px-3 py-1 bg-blue-500 text-white rounded">Back</button>
          <button onClick={onHome} className="px-3 py-1 bg-gray-400 text-white rounded">Home</button>
          <button onClick={onLogout} className="px-3 py-1 bg-red-500 text-white rounded">Logout</button>
        </div>
      </div>

      {/* Main Logo Configuration */}
      <div className="border rounded-lg p-6 mb-6">
        <h2 className="text-xl font-semibold mb-4">Configure Logo</h2>
        <p className="text-sm text-gray-600 mb-6">
          Upload a logo for your storefront. Recommended size: 300x100px, Max file size: 1MB.
          Supported formats: PNG, JPG, SVG
        </p>
        
        {loading ? (
          <div className="text-center py-8">
            <p>Loading...</p>
          </div>
        ) : (
          <div>
            <div className="mb-6 p-4 border rounded bg-gray-50 flex justify-center">
              {logo ? (
                <img 
                  src={logo} 
                  alt="Company Logo" 
                  className="max-h-32 object-contain"
                />
              ) : (
                <div className="text-gray-500 text-center py-8">
                  <p>No logo uploaded</p>
                  <p className="text-sm">Upload a logo to replace the text header</p>
                </div>
              )}
            </div>
            
            <div className="flex flex-col sm:flex-row gap-4 mb-4">
              <div className="flex-grow">
                <input
                  type="file"
                  id="logoInput"
                  accept="image/*"
                  onChange={handleFileSelect}
                  className="border p-2 w-full rounded"
                />
              </div>
              
              <div className="flex gap-2">
                <button
                  onClick={handleUpload}
                  disabled={!fileInput || uploading}
                  className={`px-4 py-2 rounded ${
                    !fileInput || uploading
                      ? 'bg-gray-300 cursor-not-allowed'
                      : 'bg-green-500 hover:bg-green-600 text-white'
                  }`}
                >
                  {uploading ? 'Uploading...' : 'Upload Logo'}
                </button>
                
                {logo && (
                  <button
                    onClick={handleDelete}
                    disabled={uploading}
                    className="px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded"
                  >
                    Delete Logo
                  </button>
                )}
              </div>
            </div>
            
            <div className="text-sm text-gray-500">
              <p>The logo will replace the text header on your storefront home page.</p>
            </div>
          </div>
        )}
      </div>

      {/* Header Logo Configuration */}
      <div className="border rounded-lg p-6 mb-6">
        <h2 className="text-xl font-semibold mb-4">Configure Header Logo</h2>
        <p className="text-sm text-gray-600 mb-6">
          Upload a logo to display in the top-left corner of all screens. Recommended size: 40x40px, Max file size: 1MB.
          Supported formats: PNG, JPG, SVG
        </p>
        
        <div>
          <div className="mb-6 p-4 border rounded bg-gray-50 flex justify-center">
            {headerLogo ? (
              <img 
                src={headerLogo} 
                alt="Header Logo" 
                className="max-h-16 object-contain"
              />
            ) : (
              <div className="text-gray-500 text-center py-8">
                <p>No header logo uploaded</p>
                <p className="text-sm">Upload a logo to display in the top-left corner of all screens</p>
              </div>
            )}
          </div>
          
          <div className="flex flex-col sm:flex-row gap-4 mb-4">
            <div className="flex-grow">
              <input
                type="file"
                id="headerLogoInput"
                accept="image/*"
                onChange={handleHeaderFileSelect}
                className="border p-2 w-full rounded"
              />
            </div>
            
            <div className="flex gap-2">
              <button
                onClick={handleHeaderLogoUpload}
                disabled={!headerFileInput || uploading}
                className={`px-4 py-2 rounded ${
                  !headerFileInput || uploading
                    ? 'bg-gray-300 cursor-not-allowed'
                    : 'bg-green-500 hover:bg-green-600 text-white'
                }`}
              >
                {uploading ? 'Uploading...' : 'Upload Header Logo'}
              </button>
              
              {headerLogo && (
                <button
                  onClick={handleHeaderLogoDelete}
                  disabled={uploading}
                  className="px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded"
                >
                  Delete Header Logo
                </button>
              )}
            </div>
          </div>
          
          <div className="text-sm text-gray-500">
            <p>The header logo will appear in the top-left corner of all screens in your application.</p>
          </div>
        </div>
      </div>
    </div>
  );
}