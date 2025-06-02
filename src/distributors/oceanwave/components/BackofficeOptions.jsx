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
    { name: "Manage Business Logic", path: "/backoffice/logic" },
    { name: "Manual File Upload", path: "/backoffice/upload" },
    { name: "Configure with AI", path: "/backoffice/ai" },
    { name: "Custom Table", path: "/backoffice/table" },
    { name: "Logs", path: "/backoffice/logs" },
    { name: "AI Customization", path: "/backoffice/ai-chat" }
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
              option.name === "Branding" ? 'bg-green-50' : ''
            }`}
            onClick={() => {
              if (option.name === "Manage Customers") {
                navigate("/backoffice/customers");
              } else if (option.name === "Branding") {
                navigate("/backoffice/branding");
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
              <p className="text-sm text-gray-600">Customize your logo and appearance OCEAN WAVE</p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
