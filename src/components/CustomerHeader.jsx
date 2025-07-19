import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

export default function CustomerHeader({ brandName, onLogout, onHome }) {
  const navigate = useNavigate();
  const [config, setConfig] = useState(null);
  const [timeLeft, setTimeLeft] = useState({ days: 0, hours: 0, minutes: 0, seconds: 0 });
  const [isProfileDropdownOpen, setIsProfileDropdownOpen] = useState(false);
  const [cartItemCount, setCartItemCount] = useState(0);
  // LANGUAGE TRANSLATION FEATURE - FORCE BUILD UPDATE
  const [selectedLanguage, setSelectedLanguage] = useState('en');
  const [isLanguageDropdownOpen, setIsLanguageDropdownOpen] = useState(false);

  // Language configuration - Updated with translation support
  const languages = [
    { code: 'en', name: 'English', flag: 'EN' },
    { code: 'es', name: 'Spanish', flag: 'ES' },
    { code: 'fr', name: 'French', flag: 'FR' },
    { code: 'zh', name: 'Chinese', flag: 'ZH' },
    { code: 'ko', name: 'Korean', flag: 'KO' },
    { code: 'pt', name: 'Portuguese', flag: 'PT' }
  ];

  useEffect(() => {
    fetchConfig();
    fetchCartCount();
    fetchUserLanguage();
    
    // Listen for custom cart update events
    const handleCartUpdate = () => {
      console.log('🔄 Cart update event received, refreshing badge...');
      fetchCartCount();
    };
    
    // Refresh cart count when the component mounts or when user returns to page
    const handleVisibilityChange = () => {
      if (!document.hidden) {
        fetchCartCount();
      }
    };
    
    // Add event listeners
    window.addEventListener('cartUpdated', handleCartUpdate);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    return () => {
      window.removeEventListener('cartUpdated', handleCartUpdate);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (isProfileDropdownOpen && !event.target.closest('.profile-dropdown')) {
        setIsProfileDropdownOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isProfileDropdownOpen]);

  const fetchCartCount = async () => {
    try {
      const response = await fetch('/api/cart', {
        credentials: 'include'
      });
      if (response.ok) {
        const cartItems = await response.json();
        console.log('🔍 Cart items fetched:', cartItems);
        // The API returns cart items directly as an array
        const totalItems = Array.isArray(cartItems) ? cartItems.reduce((total, item) => total + item.quantity, 0) : 0;
        console.log('🔍 Total cart items:', totalItems);
        setCartItemCount(totalItems);
        return totalItems;
      } else {
        console.log('🔍 Cart fetch failed:', response.status);
        return 0;
      }
    } catch (error) {
      console.error('Error fetching cart count:', error);
      return 0;
    }
  };

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
    }
  };

  // Countdown timer effect
  useEffect(() => {
    if (!config?.countdown_end_date) return;

    const timer = setInterval(() => {
      const now = new Date().getTime();
      const endDate = new Date(config.countdown_end_date).getTime();
      const distance = endDate - now;

      if (distance > 0) {
        const days = Math.floor(distance / (1000 * 60 * 60 * 24));
        const hours = Math.floor((distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const minutes = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((distance % (1000 * 60)) / 1000);

        setTimeLeft({ days, hours, minutes, seconds });
      } else {
        setTimeLeft({ days: 0, hours: 0, minutes: 0, seconds: 0 });
      }
    }, 1000);

    return () => clearInterval(timer);
  }, [config]);

  const fetchUserLanguage = async () => {
    try {
      console.log('🌍 Fetching user language preference...');
      const response = await fetch('/api/user/language', {
        credentials: 'include'
      });
      if (response.ok) {
        const data = await response.json();
        console.log('🌍 User language fetched:', data.language || 'en');
        setSelectedLanguage(data.language || 'en');
      } else {
        console.log('🌍 Language API not available, using default');
      }
    } catch (error) {
      console.error('Error fetching user language:', error);
    }
  };

  const changeLanguage = async (newLanguage) => {
    try {
      const response = await fetch('/api/user/language', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        credentials: 'include',
        body: JSON.stringify({ language: newLanguage })
      });

      if (response.ok) {
        setSelectedLanguage(newLanguage);
        setIsLanguageDropdownOpen(false);
        // Refresh the page to see translations immediately
        window.location.reload();
      } else {
        console.error('Failed to update language preference');
      }
    } catch (error) {
      console.error('Error updating language preference:', error);
    }
  };

  // Close language dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (isLanguageDropdownOpen && !event.target.closest('.language-dropdown')) {
        setIsLanguageDropdownOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isLanguageDropdownOpen]);

  if (!config) {
    return null; // Don't render anything until config is loaded
  }

  return (
    <>
      {/* Top Banner */}
      <div 
        className="w-full py-3 px-4 text-center text-sm font-medium relative"
        style={{
          backgroundColor: config.banner_bg_color,
          color: config.banner_text_color
        }}
      >
        <div className="flex items-center justify-center gap-4">
          <span>{config.banner_message}</span>
          <span>-</span>
          <span className="underline cursor-pointer">{config.banner_link_text}</span>
          
          {/* Countdown Timer */}
          {config.countdown_end_date && (
            <div className="flex items-center gap-2 ml-4">
              <div className="flex gap-1">
                <span className="bg-white text-black px-2 py-1 rounded text-xs font-bold">
                  {timeLeft.days.toString().padStart(2, '0')}
                </span>
                <span className="text-xs">D</span>
              </div>
              <div className="flex gap-1">
                <span className="bg-white text-black px-2 py-1 rounded text-xs font-bold">
                  {timeLeft.hours.toString().padStart(2, '0')}
                </span>
                <span className="text-xs">H</span>
              </div>
              <div className="flex gap-1">
                <span className="bg-white text-black px-2 py-1 rounded text-xs font-bold">
                  {timeLeft.minutes.toString().padStart(2, '0')}
                </span>
                <span className="text-xs">M</span>
              </div>
              <div className="flex gap-1">
                <span className="bg-white text-black px-2 py-1 rounded text-xs font-bold">
                  {timeLeft.seconds.toString().padStart(2, '0')}
                </span>
                <span className="text-xs">S</span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Header */}
      <header className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            {/* Left: Menu + Logo */}
            <div className="flex items-center space-x-4">
              <button 
                onClick={() => navigate('/')}
                className="p-2 rounded-md hover:bg-gray-100"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              </button>
              
              {config.logo_url ? (
                <img 
                  src={config.logo_url} 
                  alt={config.logo_alt_text} 
                  className="h-8 object-contain cursor-pointer"
                  onClick={() => navigate('/')}
                />
              ) : (
                <div 
                  className="text-xl font-bold cursor-pointer" 
                  onClick={() => navigate('/')}
                >
                  {brandName}
                </div>
              )}
            </div>

            {/* Right: Language, Profile, Search, Cart */}
            <div className="flex items-center space-x-4">
              {/* Language Dropdown */}
              <div className="relative language-dropdown">
                <button 
                  onClick={() => setIsLanguageDropdownOpen(!isLanguageDropdownOpen)}
                  className="flex items-center space-x-1 p-2 rounded-md hover:bg-gray-100"
                >
                  <span className="text-sm font-bold bg-blue-100 px-2 py-1 rounded">
                    {languages.find(lang => lang.code === selectedLanguage)?.flag || 'EN'}
                  </span>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
                
                {isLanguageDropdownOpen && (
                  <div className="absolute right-0 mt-2 w-40 bg-white rounded-md shadow-lg border border-gray-200 z-50">
                    <div className="py-1">
                      {languages.map((language) => (
                        <button
                          key={language.code}
                          onClick={() => changeLanguage(language.code)}
                          className={`block w-full text-left px-4 py-2 text-sm hover:bg-gray-100 flex items-center space-x-2 ${
                            selectedLanguage === language.code ? 'bg-blue-50 text-blue-600' : 'text-gray-700'
                          }`}
                        >
                          <span className="text-xs font-bold bg-gray-100 px-2 py-1 rounded mr-2">{language.flag}</span>
                          <span>{language.name}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
              
              {/* Profile Dropdown */}
              <div className="relative profile-dropdown">
                <button 
                  onClick={() => setIsProfileDropdownOpen(!isProfileDropdownOpen)}
                  className="p-2 rounded-md hover:bg-gray-100"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                </button>
                
                {isProfileDropdownOpen && (
                  <div className="absolute right-0 mt-2 w-48 bg-white rounded-md shadow-lg border border-gray-200 z-50">
                    <div className="py-1">
                      <button
                        onClick={() => {
                          setIsProfileDropdownOpen(false);
                          // TODO: Navigate to change password page
                          alert('Change Password functionality to be implemented');
                        }}
                        className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                      >
                        Change Password
                      </button>
                      <button
                        onClick={() => {
                          setIsProfileDropdownOpen(false);
                          onLogout();
                        }}
                        className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                      >
                        Logout
                      </button>
                    </div>
                  </div>
                )}
              </div>
              
              <button 
                onClick={() => navigate('/storefront')}
                className="p-2 rounded-md hover:bg-gray-100"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </button>
              
              {/* Cart with Badge */}
              <button 
                onClick={() => navigate('/cart')}
                className="p-2 rounded-md hover:bg-gray-100 relative"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4m0 0L7 13m0 0l-2.5 5M7 13l2.5 5" />
                </svg>
                {cartItemCount > 0 && (
                  <span className="absolute -top-1 -right-1 bg-blue-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center font-bold">
                    {cartItemCount > 99 ? '99+' : cartItemCount}
                  </span>
                )}
              </button>
            </div>
          </div>
        </div>
      </header>
    </>
  );
}