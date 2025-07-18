import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';

export default function BackofficeOptions({ onLogout, onHome, brandName }) {
  // Set title directly at component level
  document.title = brandName ? `${brandName} - Backoffice` : 'Backoffice - Feather';
  
  const navigate = useNavigate();

  // Options for the backoffice dashboard
  const options = [
    { name: "Manage Customers", path: "/backoffice/customers" },
    { name: "Homepage & Branding", path: "/backoffice/homepage-branding" },
    { name: "Branding", path: "/backoffice/branding" },
    { name: "AI Storefront Assistant", path: "/backoffice/ai-assistant" },
    { name: "AI Pricing & Promo Engine", path: "/backoffice/ai-pricing" },
    { name: "Table Builder", path: "/backoffice/table-builder" },
    { name: "Integrations", path: "/backoffice/integrations" }
  ];

  return (
    <div className="p-6">
      <div className="flex justify-between mb-4 ml-20">
        <h1 className="text-2xl font-bold">Backoffice Dashboard</h1>
        <div className="flex gap-2">
          <button onClick={onHome} className="px-3 py-1 bg-gray-400 text-white rounded">Home</button>
          <button onClick={onLogout} className="px-3 py-1 bg-red-500 text-white rounded">Logout</button>
        </div>
      </div>
      
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {options.map((option) => (
          <div 
            key={option.name} 
            className={`border p-6 rounded shadow hover:shadow-md transition-shadow cursor-pointer ${
              option.name === "Manage Customers" ? 'bg-blue-50' : 
              option.name === "Homepage & Branding" ? 'bg-indigo-50' : 
              option.name === "Branding" ? 'bg-green-50' : 
              option.name === "AI Storefront Assistant" ? 'bg-purple-50' : 
              option.name === "AI Pricing & Promo Engine" ? 'bg-yellow-50' : 
              option.name === "Table Builder" ? 'bg-cyan-50' : 
              option.name === "Integrations" ? 'bg-orange-50' : ''
            }`}
            onClick={() => {
              if (option.name === "Manage Customers") {
                navigate("/backoffice/customers");
              } else if (option.name === "Homepage & Branding") {
                navigate("/backoffice/homepage-branding");
              } else if (option.name === "Branding") {
                navigate("/backoffice/branding");
              } else if (option.name === "AI Storefront Assistant") {
                navigate("/backoffice/ai-assistant");
              } else if (option.name === "AI Pricing & Promo Engine") {
                navigate("/backoffice/ai-pricing");
              } else if (option.name === "Table Builder") {
                navigate("/backoffice/table-builder");
              } else if (option.name === "Integrations") {
                navigate("/backoffice/integrations");
              } else {
                alert(`${option.name} functionality is not implemented yet.`);
              }
            }}
          >
            <h2 className="text-xl font-semibold mb-2">{option.name}</h2>
            {option.name === "Manage Customers" && (
              <p className="text-sm text-gray-600">View and manage your customer accounts</p>
            )}
            {option.name === "Homepage & Branding" && (
              <p className="text-sm text-gray-600">Configure customer homepage experience with carousel, banners, and branding</p>
            )}
            {option.name === "Branding" && (
              <p className="text-sm text-gray-600">Customize your logo and appearance</p>
            )}
            {option.name === "AI Storefront Assistant" && (
              <div className="flex items-center gap-2">
                <p className="text-sm text-gray-600">Unified AI for styling, logic, and content - powered by Claude</p>
                <img 
                  src="/claudelogo.png" 
                  alt="Claude" 
                  className="w-4 h-4 opacity-75" 
                />
              </div>
            )}
            {option.name === "Table Builder" && (
              <div className="flex items-center gap-2">
                <p className="text-sm text-gray-600">Configure Master Data Attributes</p>
              </div>
            )}
            {option.name === "AI Pricing & Promo Engine" && (
              <div className="flex items-center gap-2">
                <p className="text-sm text-gray-600">Intelligent pricing rules with full contextual awareness, powered by Claude</p>
                <img 
                  src="/claudelogo.png" 
                  alt="Claude" 
                  className="w-4 h-4 opacity-75" 
                />
              </div>
            )}
            {option.name === "Integrations" && (
              <p className="text-sm text-gray-600">Connect to FTP, QuickBooks Online, and other external systems</p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
