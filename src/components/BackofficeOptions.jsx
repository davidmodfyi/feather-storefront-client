import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';

export default function BackofficeOptions({ onLogout, onHome, brandName }) {
  // Set title directly at component level
  document.title = brandName ? `${brandName} - Backoffice` : 'Backoffice - Feather';
  
  const navigate = useNavigate();

  // Options for the backoffice
  const options = [
    { name: "Manage Customers", path: "/backoffice/customers" },
    { name: "Branding", path: "/backoffice/branding" },
    { name: "AI Storefront Assistant", path: "/backoffice/ai-assistant" },
    { name: "Table Builder", path: "/backoffice/table-builder" },
    { name: "Custom Table", path: "/backoffice/table" },
    { name: "Logs", path: "/backoffice/logs" }
  ];

  return (
    <div className="p-6">
      <div className="flex justify-between mb-4 ml-20">
        <h1 className="text-2xl font-bold">Backoffice</h1>
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
              option.name === "Branding" ? 'bg-green-50' : 
              option.name === "AI Storefront Assistant" ? 'bg-purple-50' : 
              option.name === "Table Builder" ? 'bg-cyan-50' : ''
            }`}
            onClick={() => {
              if (option.name === "Manage Customers") {
                navigate("/backoffice/customers");
              } else if (option.name === "Branding") {
                navigate("/backoffice/branding");
              } else if (option.name === "AI Storefront Assistant") {
                navigate("/backoffice/ai-assistant");
              } else if (option.name === "Table Builder") {
                navigate("/backoffice/table-builder");
              } else {
                alert(`${option.name} functionality is not implemented yet.`);
              }
            }}
          >
            <h2 className="text-xl font-semibold mb-2">{option.name}</h2>
            {option.name === "Manage Customers" && (
              <p className="text-sm text-gray-600">View and manage your customer accounts</p>
            )}
            {option.name === "Branding" && (
              <p className="text-sm text-gray-600">Customize your logo and appearance (Def)</p>
            )}
            {option.name === "Storefront UI Customization" && (
              <div className="flex items-center gap-2">
                <p className="text-sm text-gray-600">Configure directly with AI, powered by Claude</p>
                <img 
                  src="/claudelogo.png" 
                  alt="Claude" 
                  className="w-4 h-4 opacity-75" 
                />
              </div>
            )}
            {option.name === "Storefront Logic Customization" && (
              <div className="flex items-center gap-2">
                <p className="text-sm text-gray-600">Configure directly with AI, powered by Claude</p>
                <img 
                  src="/claudelogo.png" 
                  alt="Claude" 
                  className="w-4 h-4 opacity-75" 
                />
              </div>
            )}
            {option.name === "Table Builder" && (
              <div className="flex items-center gap-2">
                <p className="text-sm text-gray-600">Configure Master Data Attributes, powered by Claude</p>
                <img 
                  src="/claudelogo.png" 
                  alt="Claude" 
                  className="w-4 h-4 opacity-75" 
                />
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
