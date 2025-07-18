import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

export default function HomepageBranding() {
  const navigate = useNavigate();
  const [config, setConfig] = useState({
    banner_message: 'END OF SEASON SOON',
    banner_link_text: 'LAST CHANCE',
    banner_bg_color: '#000000',
    banner_text_color: '#ffffff',
    countdown_end_date: '',
    logo_url: '',
    logo_alt_text: 'Logo',
    hero_title: 'ENGINEERED FOR EVERYDAY',
    hero_description: 'Our latest collection balances functionality and aesthetics in the space of traditional workwear, lifestyle and activewear.',
    hero_button_text: 'SHOP NOW',
    hero_button_bg_color: '#ffffff',
    hero_button_text_color: '#000000',
    hero_images: [],
    title_font: 'Arial, sans-serif',
    title_font_size: '48px',
    title_font_weight: 'bold',
    body_font: 'Arial, sans-serif',
    body_font_size: '16px',
    overlay_bg_color: 'rgba(0, 0, 0, 0.3)'
  });

  const [activeTab, setActiveTab] = useState('banner');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState('');

  useEffect(() => {
    fetchConfig();
  }, []);

  const fetchConfig = async () => {
    try {
      const response = await fetch('/api/homepage-config', {
        credentials: 'include'
      });
      if (response.ok) {
        const data = await response.json();
        console.log('🔍 Fetched config:', data);
        if (data.hero_images && typeof data.hero_images === 'string') {
          data.hero_images = JSON.parse(data.hero_images);
        }
        setConfig(data);
      }
    } catch (error) {
      console.error('Error fetching config:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    setSaveMessage('');
    
    console.log('🔍 Saving config:', config);
    
    try {
      const response = await fetch('/api/homepage-config', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify(config)
      });

      const responseData = await response.json();
      console.log('🔍 Save response:', responseData);

      if (response.ok) {
        setSaveMessage('Configuration saved successfully!');
        setTimeout(() => setSaveMessage(''), 3000);
      } else {
        setSaveMessage(`Error saving configuration: ${responseData.error || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('Error saving config:', error);
      setSaveMessage('Error saving configuration');
    } finally {
      setIsSaving(false);
    }
  };

  const handleImageUpload = async (file) => {
    const formData = new FormData();
    formData.append('image', file);

    try {
      const response = await fetch('/api/homepage-upload', {
        method: 'POST',
        credentials: 'include',
        body: formData
      });

      if (response.ok) {
        const data = await response.json();
        return data.imageUrl;
      }
    } catch (error) {
      console.error('Error uploading image:', error);
    }
    return null;
  };

  const handleLogoUpload = async (event) => {
    const file = event.target.files[0];
    if (file) {
      const imageUrl = await handleImageUpload(file);
      if (imageUrl) {
        setConfig(prev => ({ ...prev, logo_url: imageUrl }));
      }
    }
  };

  const handleHeroImageUpload = async (event) => {
    const file = event.target.files[0];
    if (file) {
      const imageUrl = await handleImageUpload(file);
      if (imageUrl) {
        setConfig(prev => ({
          ...prev,
          hero_images: [...prev.hero_images, imageUrl]
        }));
      }
    }
  };

  const removeHeroImage = (index) => {
    setConfig(prev => ({
      ...prev,
      hero_images: prev.hero_images.filter((_, i) => i !== index)
    }));
  };

  const handleInputChange = (field, value) => {
    setConfig(prev => ({ ...prev, [field]: value }));
  };

  if (isLoading) {
    return (
      <div className="p-6">
        <div className="flex justify-center items-center h-64">
          <div className="text-lg">Loading configuration...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">Homepage & Branding</h1>
        <div className="flex gap-2">
          <button
            onClick={() => navigate('/backoffice')}
            className="px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600"
          >
            Back to Dashboard
          </button>
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:bg-blue-300"
          >
            {isSaving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </div>

      {saveMessage && (
        <div className={`mb-4 p-3 rounded ${saveMessage.includes('Error') ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>
          {saveMessage}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Configuration Panel */}
        <div className="lg:col-span-2">
          <div className="bg-white rounded-lg shadow-md">
            {/* Tabs */}
            <div className="border-b">
              <nav className="flex space-x-8 px-6">
                {['banner', 'logo', 'hero', 'styling'].map((tab) => (
                  <button
                    key={tab}
                    onClick={() => setActiveTab(tab)}
                    className={`py-4 px-2 border-b-2 font-medium text-sm ${
                      activeTab === tab
                        ? 'border-blue-500 text-blue-600'
                        : 'border-transparent text-gray-500 hover:text-gray-700'
                    }`}
                  >
                    {tab.charAt(0).toUpperCase() + tab.slice(1)}
                  </button>
                ))}
              </nav>
            </div>

            {/* Tab Content */}
            <div className="p-6">
              {activeTab === 'banner' && (
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold">Banner Configuration</h3>
                  
                  <div>
                    <label className="block text-sm font-medium mb-2">Banner Message</label>
                    <input
                      type="text"
                      value={config.banner_message}
                      onChange={(e) => handleInputChange('banner_message', e.target.value)}
                      className="w-full p-2 border rounded-lg"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-2">Link Text</label>
                    <input
                      type="text"
                      value={config.banner_link_text}
                      onChange={(e) => handleInputChange('banner_link_text', e.target.value)}
                      className="w-full p-2 border rounded-lg"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium mb-2">Background Color</label>
                      <input
                        type="color"
                        value={config.banner_bg_color}
                        onChange={(e) => handleInputChange('banner_bg_color', e.target.value)}
                        className="w-full p-1 border rounded-lg"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-2">Text Color</label>
                      <input
                        type="color"
                        value={config.banner_text_color}
                        onChange={(e) => handleInputChange('banner_text_color', e.target.value)}
                        className="w-full p-1 border rounded-lg"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-2">Countdown End Date</label>
                    <input
                      type="datetime-local"
                      value={config.countdown_end_date ? new Date(config.countdown_end_date).toISOString().slice(0, 16) : ''}
                      onChange={(e) => handleInputChange('countdown_end_date', e.target.value)}
                      className="w-full p-2 border rounded-lg"
                    />
                  </div>
                </div>
              )}

              {activeTab === 'logo' && (
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold">Logo Configuration</h3>
                  
                  <div>
                    <label className="block text-sm font-medium mb-2">Logo Upload</label>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleLogoUpload}
                      className="w-full p-2 border rounded-lg"
                    />
                    {config.logo_url && (
                      <div className="mt-2">
                        <img src={config.logo_url} alt="Logo" className="h-20 object-contain" />
                      </div>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-2">Alt Text</label>
                    <input
                      type="text"
                      value={config.logo_alt_text}
                      onChange={(e) => handleInputChange('logo_alt_text', e.target.value)}
                      className="w-full p-2 border rounded-lg"
                    />
                  </div>
                </div>
              )}

              {activeTab === 'hero' && (
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold">Hero Section</h3>
                  
                  <div>
                    <label className="block text-sm font-medium mb-2">Hero Title</label>
                    <input
                      type="text"
                      value={config.hero_title}
                      onChange={(e) => handleInputChange('hero_title', e.target.value)}
                      className="w-full p-2 border rounded-lg"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-2">Hero Description</label>
                    <textarea
                      value={config.hero_description}
                      onChange={(e) => handleInputChange('hero_description', e.target.value)}
                      rows="3"
                      className="w-full p-2 border rounded-lg"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-2">Button Text</label>
                    <input
                      type="text"
                      value={config.hero_button_text}
                      onChange={(e) => handleInputChange('hero_button_text', e.target.value)}
                      className="w-full p-2 border rounded-lg"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium mb-2">Button Background</label>
                      <input
                        type="color"
                        value={config.hero_button_bg_color}
                        onChange={(e) => handleInputChange('hero_button_bg_color', e.target.value)}
                        className="w-full p-1 border rounded-lg"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-2">Button Text Color</label>
                      <input
                        type="color"
                        value={config.hero_button_text_color}
                        onChange={(e) => handleInputChange('hero_button_text_color', e.target.value)}
                        className="w-full p-1 border rounded-lg"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-2">Hero Images</label>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleHeroImageUpload}
                      className="w-full p-2 border rounded-lg mb-2"
                    />
                    <div className="grid grid-cols-2 gap-2">
                      {config.hero_images.map((image, index) => (
                        <div key={index} className="relative">
                          <img src={image} alt={`Hero ${index + 1}`} className="w-full h-32 object-cover rounded" />
                          <button
                            onClick={() => removeHeroImage(index)}
                            className="absolute top-1 right-1 bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs"
                          >
                            ×
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'styling' && (
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold">Typography & Styling</h3>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium mb-2">Title Font</label>
                      <select
                        value={config.title_font}
                        onChange={(e) => handleInputChange('title_font', e.target.value)}
                        className="w-full p-2 border rounded-lg"
                      >
                        <option value="Arial, sans-serif">Arial</option>
                        <option value="Georgia, serif">Georgia</option>
                        <option value="Times New Roman, serif">Times New Roman</option>
                        <option value="Helvetica, sans-serif">Helvetica</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-2">Title Font Size</label>
                      <input
                        type="text"
                        value={config.title_font_size}
                        onChange={(e) => handleInputChange('title_font_size', e.target.value)}
                        className="w-full p-2 border rounded-lg"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-2">Title Font Weight</label>
                    <select
                      value={config.title_font_weight}
                      onChange={(e) => handleInputChange('title_font_weight', e.target.value)}
                      className="w-full p-2 border rounded-lg"
                    >
                      <option value="normal">Normal</option>
                      <option value="bold">Bold</option>
                      <option value="lighter">Lighter</option>
                      <option value="bolder">Bolder</option>
                    </select>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium mb-2">Body Font</label>
                      <select
                        value={config.body_font}
                        onChange={(e) => handleInputChange('body_font', e.target.value)}
                        className="w-full p-2 border rounded-lg"
                      >
                        <option value="Arial, sans-serif">Arial</option>
                        <option value="Georgia, serif">Georgia</option>
                        <option value="Times New Roman, serif">Times New Roman</option>
                        <option value="Helvetica, sans-serif">Helvetica</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-2">Body Font Size</label>
                      <input
                        type="text"
                        value={config.body_font_size}
                        onChange={(e) => handleInputChange('body_font_size', e.target.value)}
                        className="w-full p-2 border rounded-lg"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-2">Overlay Background</label>
                    <input
                      type="text"
                      value={config.overlay_bg_color}
                      onChange={(e) => handleInputChange('overlay_bg_color', e.target.value)}
                      className="w-full p-2 border rounded-lg"
                      placeholder="rgba(0, 0, 0, 0.3)"
                    />
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Preview Panel */}
        <div className="lg:col-span-1">
          <div className="bg-white rounded-lg shadow-md p-4">
            <h3 className="text-lg font-semibold mb-4">Preview</h3>
            <div className="border rounded-lg overflow-hidden">
              {/* Banner Preview */}
              <div
                className="p-3 text-center text-sm font-medium"
                style={{
                  backgroundColor: config.banner_bg_color,
                  color: config.banner_text_color
                }}
              >
                {config.banner_message} - {config.banner_link_text}
              </div>

              {/* Header Preview */}
              <div className="p-3 flex justify-between items-center border-b">
                <div className="flex items-center gap-2">
                  {config.logo_url && (
                    <img src={config.logo_url} alt={config.logo_alt_text} className="h-8 object-contain" />
                  )}
                </div>
                <div className="flex gap-2 text-sm">
                  <span>EUR</span>
                  <span>👤</span>
                  <span>🔍</span>
                  <span>🛒</span>
                </div>
              </div>

              {/* Hero Preview */}
              <div className="relative h-48 bg-gray-300 flex items-center justify-center">
                {config.hero_images.length > 0 && (
                  <img
                    src={config.hero_images[0]}
                    alt="Hero"
                    className="absolute inset-0 w-full h-full object-cover"
                  />
                )}
                <div
                  className="absolute inset-0"
                  style={{ backgroundColor: config.overlay_bg_color }}
                />
                <div className="relative z-10 text-center text-white p-4">
                  <h2
                    className="text-xl font-bold mb-2"
                    style={{
                      fontFamily: config.title_font,
                      fontSize: '20px',
                      fontWeight: config.title_font_weight
                    }}
                  >
                    {config.hero_title}
                  </h2>
                  <p
                    className="text-sm mb-3"
                    style={{
                      fontFamily: config.body_font,
                      fontSize: '12px'
                    }}
                  >
                    {config.hero_description}
                  </p>
                  <button
                    className="px-4 py-2 text-sm rounded"
                    style={{
                      backgroundColor: config.hero_button_bg_color,
                      color: config.hero_button_text_color
                    }}
                  >
                    {config.hero_button_text}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}