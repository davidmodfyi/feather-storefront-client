import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

export default function CustomerHomepage({ brandName, onLogout, onHome }) {
  const navigate = useNavigate();
  const [config, setConfig] = useState(null);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [timeLeft, setTimeLeft] = useState({ days: 0, hours: 0, minutes: 0, seconds: 0 });

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
        if (data.hero_images && typeof data.hero_images === 'string') {
          data.hero_images = JSON.parse(data.hero_images);
        }
        setConfig(data);
      }
    } catch (error) {
      console.error('Error fetching homepage config:', error);
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

  // Hero image carousel effect
  useEffect(() => {
    if (!config?.hero_images || config.hero_images.length <= 1) return;

    const interval = setInterval(() => {
      setCurrentImageIndex((prevIndex) => 
        (prevIndex + 1) % config.hero_images.length
      );
    }, 5000); // Change image every 5 seconds

    return () => clearInterval(interval);
  }, [config]);

  if (!config) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-lg">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
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
              <button className="p-2 rounded-md hover:bg-gray-100">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              </button>
              
              {config.logo_url ? (
                <img 
                  src={config.logo_url} 
                  alt={config.logo_alt_text} 
                  className="h-8 object-contain"
                />
              ) : (
                <div className="text-xl font-bold">{brandName}</div>
              )}
            </div>

            {/* Right: Currency, Profile, Search, Cart */}
            <div className="flex items-center space-x-4">
              <button className="text-sm font-medium hover:text-gray-700">
                EUR €
              </button>
              <button className="p-2 rounded-md hover:bg-gray-100">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
              </button>
              <button className="p-2 rounded-md hover:bg-gray-100">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </button>
              <button 
                onClick={() => navigate('/cart')}
                className="p-2 rounded-md hover:bg-gray-100"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4m0 0L7 13m0 0l-2.5 5M7 13l2.5 5m8.5-5v5a2 2 0 01-2 2H9a2 2 0 01-2-2v-5m8.5 0V9a2 2 0 00-2-2H9a2 2 0 00-2 2v4.5" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative h-96 lg:h-[500px] overflow-hidden">
        {/* Background Image */}
        {config.hero_images && config.hero_images.length > 0 && (
          <div className="absolute inset-0">
            <img
              src={config.hero_images[currentImageIndex]}
              alt="Hero"
              className="w-full h-full object-cover transition-opacity duration-1000"
            />
          </div>
        )}
        
        {/* Overlay */}
        <div 
          className="absolute inset-0"
          style={{ backgroundColor: config.overlay_bg_color }}
        />

        {/* Content */}
        <div className="relative z-10 flex items-center justify-center h-full">
          <div className="text-center text-white px-4 max-w-2xl">
            <h1 
              className="text-4xl lg:text-6xl font-bold mb-6"
              style={{
                fontFamily: config.title_font,
                fontSize: config.title_font_size,
                fontWeight: config.title_font_weight
              }}
            >
              {config.hero_title}
            </h1>
            <p 
              className="text-lg lg:text-xl mb-8 max-w-xl mx-auto"
              style={{
                fontFamily: config.body_font,
                fontSize: config.body_font_size
              }}
            >
              {config.hero_description}
            </p>
            <button 
              onClick={() => navigate('/storefront')}
              className="px-8 py-3 text-lg font-semibold rounded-none transition-colors duration-200 hover:opacity-90"
              style={{
                backgroundColor: config.hero_button_bg_color,
                color: config.hero_button_text_color
              }}
            >
              {config.hero_button_text}
            </button>
          </div>
        </div>

        {/* Hero Image Indicators */}
        {config.hero_images && config.hero_images.length > 1 && (
          <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 flex space-x-2">
            {config.hero_images.map((_, index) => (
              <button
                key={index}
                onClick={() => setCurrentImageIndex(index)}
                className={`w-3 h-3 rounded-full transition-colors duration-200 ${
                  index === currentImageIndex ? 'bg-white' : 'bg-white/50'
                }`}
              />
            ))}
          </div>
        )}

        {/* Carousel Controls */}
        {config.hero_images && config.hero_images.length > 1 && (
          <>
            <button
              onClick={() => setCurrentImageIndex((prev) => 
                prev === 0 ? config.hero_images.length - 1 : prev - 1
              )}
              className="absolute left-4 top-1/2 transform -translate-y-1/2 bg-white/20 hover:bg-white/30 rounded-full p-2 transition-colors duration-200"
            >
              <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <button
              onClick={() => setCurrentImageIndex((prev) => 
                (prev + 1) % config.hero_images.length
              )}
              className="absolute right-4 top-1/2 transform -translate-y-1/2 bg-white/20 hover:bg-white/30 rounded-full p-2 transition-colors duration-200"
            >
              <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </>
        )}
      </section>

      {/* Quick Links/Actions */}
      <section className="py-12 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="text-center">
              <div className="bg-gray-100 rounded-lg p-6 mb-4">
                <svg className="w-12 h-12 mx-auto text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold mb-2">Shop Products</h3>
              <p className="text-gray-600 mb-4">Browse our full catalog of products</p>
              <button 
                onClick={() => navigate('/storefront')}
                className="text-blue-600 hover:text-blue-800 font-medium"
              >
                View Storefront →
              </button>
            </div>
            
            <div className="text-center">
              <div className="bg-gray-100 rounded-lg p-6 mb-4">
                <svg className="w-12 h-12 mx-auto text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold mb-2">Order History</h3>
              <p className="text-gray-600 mb-4">View your previous orders and invoices</p>
              <button 
                onClick={() => navigate('/orders')}
                className="text-blue-600 hover:text-blue-800 font-medium"
              >
                View Orders →
              </button>
            </div>
            
            <div className="text-center">
              <div className="bg-gray-100 rounded-lg p-6 mb-4">
                <svg className="w-12 h-12 mx-auto text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4m0 0L7 13m0 0l-2.5 5M7 13l2.5 5m8.5-5v5a2 2 0 01-2 2H9a2 2 0 01-2-2v-5m8.5 0V9a2 2 0 00-2-2H9a2 2 0 00-2 2v4.5" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold mb-2">Shopping Cart</h3>
              <p className="text-gray-600 mb-4">Review and checkout your cart</p>
              <button 
                onClick={() => navigate('/cart')}
                className="text-blue-600 hover:text-blue-800 font-medium"
              >
                View Cart →
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Logout Button */}
      <section className="py-8 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <button
            onClick={onLogout}
            className="px-6 py-2 bg-red-500 text-white rounded hover:bg-red-600 transition-colors duration-200"
          >
            Logout
          </button>
        </div>
      </section>
    </div>
  );
}