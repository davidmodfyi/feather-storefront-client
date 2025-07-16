import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';

export default function AIPricingEngine({ onLogout, onHome, brandName }) {
  document.title = brandName ? `${brandName} - AI Pricing & Promo Engine` : 'AI Pricing & Promo Engine - Feather';
  
  const navigate = useNavigate();
  const [messages, setMessages] = useState([]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [distributorSlug, setDistributorSlug] = useState('');
  const [pricingRules, setPricingRules] = useState([]);
  const [priceHistory, setPriceHistory] = useState([]);
  const [contextData, setContextData] = useState({
    customerAttributes: [],
    productAttributes: [],
    customTables: [],
    orderHistory: []
  });
  const [expandedPanels, setExpandedPanels] = useState({
    activePricingRules: false,
    priceHistory: false,
    contextData: false
  });
  const messagesEndRef = useRef(null);

  useEffect(() => {
    // Get distributor info
    fetch('/api/me', { credentials: 'include' })
      .then(res => res.json())
      .then(data => {
        setDistributorSlug(data.distributorSlug || 'default');
      })
      .catch(console.error);

    // Fetch pricing context data
    fetchPricingContext();
    
    // Fetch existing pricing rules
    fetchPricingRules();

    // Add welcome message
    setMessages([{
      id: 1,
      role: 'assistant',
      content: `🎯 **AI Pricing & Promo Engine** for ${brandName}

I'm your intelligent pricing assistant with complete contextual awareness. I can help you create sophisticated pricing rules using:

💰 **Pricing Capabilities**
• Customer-specific pricing (account attributes, price levels)
• Product-based rules (categories, attributes, SKUs)
• Quantity discounts and bulk pricing
• Contract-specific pricing overrides
• Seasonal and time-based promotions

🧠 **Contextual Intelligence**
• Full customer profile access (account attributes, order history)
• Complete product catalog with custom attributes
• Custom table integration (Price Levels, Contracts, etc.)
• Historical pricing data and trends
• Real-time cart and session context

📊 **Advanced Examples**
• "Use PriceLevels table to set different prices based on customer price_level"
• "Apply Contracts table: Account+Item specific pricing overrides everything"
• "Oil products: Buy 4 get 20% discount (any combination)"
• "VIP customers with credit terms: 15% off orders over $100"
• "Seasonal promotion: 25% off winter items Dec-Feb for retail accounts"

What pricing rule would you like to create?`,
      timestamp: new Date(),
      message_type: 'welcome'
    }]);
  }, [brandName]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const fetchPricingContext = async () => {
    try {
      const response = await fetch('/api/pricing-context', { credentials: 'include' });
      if (response.ok) {
        const data = await response.json();
        setContextData(data);
      }
    } catch (error) {
      console.error('Error fetching pricing context:', error);
    }
  };

  const fetchPricingRules = async () => {
    try {
      const response = await fetch('/api/pricing-rules', { credentials: 'include' });
      if (response.ok) {
        const data = await response.json();
        setPricingRules(data.rules || []);
        setPriceHistory(data.history || []);
      }
    } catch (error) {
      console.error('Error fetching pricing rules:', error);
    }
  };

  const handleSend = async () => {
    if (!inputValue.trim() || isLoading) return;

    const userMessage = inputValue.trim();
    setInputValue('');
    
    // Add user message to UI immediately
    const newUserMessage = {
      id: Date.now(),
      role: 'user',
      content: userMessage,
      timestamp: new Date(),
      message_type: 'user_request'
    };
    
    setMessages(prev => [...prev, newUserMessage]);
    setIsLoading(true);

    try {
      console.log('🎯 Sending pricing request:', userMessage);
      
      const response = await fetch('/api/ai-pricing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          message: userMessage,
          distributorSlug: distributorSlug,
          contextData: contextData
        })
      });

      if (response.ok) {
        const data = await response.json();
        console.log('🎯 Pricing response:', data);
        
        // Add AI response to messages
        const aiMessage = {
          id: Date.now() + 1,
          role: 'assistant',
          content: data.response,
          timestamp: new Date(),
          message_type: 'ai_response',
          rules: data.rules || [],
          changes: data.changes || []
        };
        
        setMessages(prev => [...prev, aiMessage]);
        
        // Refresh pricing rules if changes were made
        if (data.rules && data.rules.length > 0) {
          await fetchPricingRules();
          alert(`✅ Successfully created ${data.rules.length} pricing rule(s)!`);
        }
      } else {
        const error = await response.json();
        throw new Error(error.error || 'Failed to process pricing request');
      }
    } catch (error) {
      console.error('Error sending pricing request:', error);
      
      const errorMessage = {
        id: Date.now() + 1,
        role: 'assistant',
        content: `❌ Error: ${error.message}`,
        timestamp: new Date(),
        message_type: 'error'
      };
      
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const togglePanel = (panelKey) => {
    setExpandedPanels(prev => ({
      ...prev,
      [panelKey]: !prev[panelKey]
    }));
  };

  const handleDeleteRule = async (ruleId) => {
    if (!window.confirm('Are you sure you want to delete this pricing rule?')) return;

    try {
      const response = await fetch(`/api/pricing-rules/${ruleId}`, {
        method: 'DELETE',
        credentials: 'include'
      });

      if (response.ok) {
        await fetchPricingRules();
        alert('✅ Pricing rule deleted successfully!');
      } else {
        const error = await response.json();
        alert(`❌ Error deleting rule: ${error.error}`);
      }
    } catch (error) {
      console.error('Error deleting pricing rule:', error);
      alert(`❌ Error deleting rule: ${error.message}`);
    }
  };

  const handleLogout = () => {
    fetch('/api/logout', { method: 'POST', credentials: 'include' })
      .then(() => onLogout());
  };

  const goToBackoffice = () => {
    navigate('/backoffice');
  };

  return (
    <div className="h-screen bg-gray-100 flex flex-col">
      {/* Header */}
      <div className="bg-white shadow-sm border-b px-6 py-4">
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-green-500 rounded-lg flex items-center justify-center">
              <span className="text-white font-bold text-lg">💰</span>
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-900">AI Pricing & Promo Engine</h1>
              <p className="text-sm text-gray-500">Intelligent pricing rules with full contextual awareness</p>
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={goToBackoffice} className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600">
              ← Back to Backoffice
            </button>
            <button onClick={onHome} className="px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600">
              Home
            </button>
            <button onClick={handleLogout} className="px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600">
              Logout
            </button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Sidebar - Dashboard */}
        <div className="w-80 bg-white border-r overflow-y-auto">
          <div className="p-4 space-y-4">
            <h2 className="text-lg font-semibold text-gray-900">Pricing Dashboard</h2>
            
            {/* Active Pricing Rules Panel */}
            <div className="bg-white border rounded-lg shadow">
              <div 
                className="px-4 py-3 cursor-pointer hover:bg-gray-50 flex justify-between items-center"
                onClick={() => togglePanel('activePricingRules')}
              >
                <div className="flex items-center gap-2">
                  <span className="text-lg">🎯</span>
                  <h3 className="text-lg font-semibold text-gray-800">Active Pricing Rules</h3>
                  <span className="text-sm bg-green-100 text-green-800 px-2 py-1 rounded">
                    {pricingRules.length}
                  </span>
                </div>
                <span className="text-gray-400">
                  {expandedPanels.activePricingRules ? '▲' : '▼'}
                </span>
              </div>
              {expandedPanels.activePricingRules && (
                <div className="border-t bg-gray-50">
                  <div className="p-2 space-y-1 max-h-64 overflow-y-auto">
                    {pricingRules.length === 0 ? (
                      <div className="text-center py-4 text-gray-500">
                        <p className="text-sm">No pricing rules yet. Create your first rule!</p>
                      </div>
                    ) : (
                      pricingRules.map((rule) => (
                        <div key={rule.id} className="bg-white border rounded p-2 flex justify-between items-center hover:shadow-sm">
                          <div className="flex-1 min-w-0">
                            <div className="font-medium text-sm truncate">
                              {rule.description || 'Pricing Rule'}
                            </div>
                            <div className="text-xs text-gray-500">
                              Trigger: {rule.trigger_point} • {rule.active ? '🟢 Active' : '🔴 Inactive'} • {new Date(rule.created_at).toLocaleDateString()}
                            </div>
                          </div>
                          <div className="flex gap-1 ml-2">
                            <button
                              onClick={() => handleDeleteRule(rule.id)}
                              className="text-red-500 hover:text-red-700 text-sm"
                              title="Delete rule"
                            >
                              ❌
                            </button>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Context Data Panel */}
            <div className="bg-white border rounded-lg shadow">
              <div 
                className="px-4 py-3 cursor-pointer hover:bg-gray-50 flex justify-between items-center"
                onClick={() => togglePanel('contextData')}
              >
                <div className="flex items-center gap-2">
                  <span className="text-lg">📊</span>
                  <h3 className="text-lg font-semibold text-gray-800">Context Data</h3>
                </div>
                <span className="text-gray-400">
                  {expandedPanels.contextData ? '▲' : '▼'}
                </span>
              </div>
              {expandedPanels.contextData && (
                <div className="border-t bg-gray-50 p-3">
                  <div className="space-y-2 text-sm">
                    <div>
                      <strong>Customer Attributes:</strong> {contextData.customerAttributes?.length || 0}
                    </div>
                    <div>
                      <strong>Product Attributes:</strong> {contextData.productAttributes?.length || 0}
                    </div>
                    <div>
                      <strong>Custom Tables:</strong> {contextData.customTables?.length || 0}
                    </div>
                    <div>
                      <strong>Order History:</strong> {contextData.orderHistory?.length || 0} records
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right Side - Chat Interface */}
        <div className="flex-1 bg-gray-50 flex flex-col overflow-hidden">
          {/* Messages Area */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {messages.map((message) => (
              <div
                key={message.id}
                className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-3xl p-3 rounded-lg ${
                    message.role === 'user'
                      ? 'bg-blue-500 text-white'
                      : message.message_type === 'error'
                      ? 'bg-red-100 text-red-800'
                      : 'bg-white text-gray-800'
                  }`}
                >
                  <div className="whitespace-pre-wrap">
                    {message.content}
                  </div>
                  {message.rules && message.rules.length > 0 && (
                    <div className="mt-2 pt-2 border-t border-gray-200">
                      <p className="text-sm font-medium">Created Rules:</p>
                      <ul className="text-sm list-disc list-inside">
                        {message.rules.map((rule, index) => (
                          <li key={index}>{rule.description}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                  <div className="text-xs opacity-70 mt-1">
                    {message.timestamp.toLocaleTimeString()}
                  </div>
                </div>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>

          {/* Input Area */}
          <div className="bg-white border-t p-4">
            <div className="flex gap-2">
              <textarea
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="Describe your pricing rule... (e.g., 'VIP customers get 15% off all orders over $100')"
                className="flex-1 p-3 border rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
                rows="2"
                disabled={isLoading}
              />
              <button
                onClick={handleSend}
                disabled={isLoading || !inputValue.trim()}
                className="px-6 py-3 bg-green-500 text-white rounded-lg hover:bg-green-600 disabled:bg-gray-300 disabled:cursor-not-allowed"
              >
                {isLoading ? 'Creating...' : 'Create Rule'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}