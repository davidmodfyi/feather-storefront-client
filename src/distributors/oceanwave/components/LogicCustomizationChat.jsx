import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';

export default function LogicCustomizationChat({ onLogout, onHome, brandName }) {
  document.title = brandName ? `${brandName} - Logic Customization` : 'Logic Customization - Feather';
  
  const navigate = useNavigate();
  const [messages, setMessages] = useState([]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [customerAttributes, setCustomerAttributes] = useState([]);
  const [pendingScript, setPendingScript] = useState(null);
  const messagesEndRef = useRef(null);

  useEffect(() => {
    // Fetch customer attributes for context
    fetch('/api/customer-attributes', { credentials: 'include' })
      .then(res => res.json())
      .then(data => setCustomerAttributes(data.attributes || []))
      .catch(console.error);

    // Add initial welcome message
    setMessages([{
      role: 'assistant',
      content: `Hi! I'm here to help you set up custom logic for your storefront. I can help you create rules that run at different points in the customer journey:

**Trigger Points:**
• **Storefront Load** - When customers first visit your store
• **Quantity Change** - When customers modify item quantities  
• **Add to Cart** - When customers add items to their cart
• **Submit Order** - Before orders are finalized

**Example requests:**
• "Prevent customers on hold from placing orders"
• "Add a 20% surcharge for Pennsylvania customers"
• "Require minimum $100 order value"
• "Block certain products for specific customer types"

What kind of business logic would you like to set up?`
    }]);
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const triggerPoints = [
    { key: 'storefront_load', label: 'Storefront Load' },
    { key: 'quantity_change', label: 'Quantity Change' },
    { key: 'add_to_cart', label: 'Add to Cart' },
    { key: 'submit', label: 'Submit Order' }
  ];

  async function handleSend() {
    if (!inputValue.trim() || isLoading) return;

    const userMessage = inputValue.trim();
    setInputValue('');
    setMessages(prev => [...prev, { role: 'user', content: userMessage }]);
    setIsLoading(true);

    try {
      // If confirming a pending script
      if (pendingScript && (userMessage.toLowerCase().includes('confirm') || userMessage.toLowerCase().includes('yes'))) {
        await confirmScript();
        return;
      }

      // Call Claude API to generate script
      const response = await fetch('/api/claude-logic-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          message: userMessage,
          customerAttributes: customerAttributes,
          triggerPoints: triggerPoints.map(tp => tp.label)
        })
      });

      if (!response.ok) throw new Error('Failed to get response');

      const data = await response.json();
      
      setMessages(prev => [...prev, { role: 'assistant', content: data.message }]);
      
      if (data.script) {
        setPendingScript(data.script);
      }
    } catch (error) {
      console.error('Error:', error);
      setMessages(prev => [...prev, { 
        role: 'assistant', 
        content: 'Sorry, I encountered an error. Please try again.' 
      }]);
    } finally {
      setIsLoading(false);
    }
  }

  async function confirmScript() {
    if (!pendingScript) return;
    
    setIsLoading(true);
    try {
      const response = await fetch('/api/logic-scripts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(pendingScript)
      });

      if (!response.ok) throw new Error('Failed to save script');

      setMessages(prev => [...prev, { 
        role: 'assistant', 
        content: '✅ Perfect! Your logic script has been saved and is now active. You can view and manage all your scripts by clicking "Manage Scripts" above.' 
      }]);
      
      setPendingScript(null);
    } catch (error) {
      console.error('Error saving script:', error);
      setMessages(prev => [...prev, { 
        role: 'assistant', 
        content: 'Sorry, there was an error saving your script. Please try again.' 
      }]);
    } finally {
      setIsLoading(false);
    }
  }

  function handleKeyPress(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  return (
    <div className="flex flex-col h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b p-4">
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-4">
            <h1 className="text-2xl font-bold text-gray-800">Storefront Logic Customization</h1>
            <button 
              onClick={() => navigate('/backoffice/logic-scripts')}
              className="px-4 py-2 bg-purple-600 text-white rounded hover:bg-purple-700"
            >
              Manage Scripts
            </button>
          </div>
          <div className="flex gap-2">
            <button onClick={() => navigate('/backoffice')} className="px-3 py-1 bg-blue-500 text-white rounded">Back</button>
            <button onClick={onHome} className="px-3 py-1 bg-gray-400 text-white rounded">Home</button>
            <button onClick={onLogout} className="px-3 py-1 bg-red-500 text-white rounded">Logout</button>
          </div>
        </div>
      </div>

      {/* Chat Messages */}
      <div className="flex-1 overflow-y-auto p-6">
        <div className="max-w-4xl mx-auto space-y-4">
          {messages.map((message, index) => (
            <div key={index} className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-3xl rounded-lg p-4 ${
                message.role === 'user' 
                  ? 'bg-blue-600 text-white' 
                  : 'bg-white border shadow-sm'
              }`}>
                <div className="whitespace-pre-wrap">{message.content}</div>
              </div>
            </div>
          ))}
          
          {/* Pending Script Preview */}
          {pendingScript && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
              <h3 className="font-semibold text-yellow-800 mb-2">📋 Script Preview</h3>
              <div className="space-y-2 text-sm">
                <p><strong>Description:</strong> {pendingScript.description}</p>
                <p><strong>Trigger Point:</strong> {triggerPoints.find(tp => tp.key === pendingScript.trigger_point)?.label}</p>
                <details className="mt-2">
                  <summary className="cursor-pointer font-medium text-yellow-700">View Generated Code</summary>
                  <pre className="mt-2 p-3 bg-gray-100 rounded text-xs overflow-x-auto">
                    {pendingScript.script_content}
                  </pre>
                </details>
              </div>
              <div className="mt-3 pt-3 border-t border-yellow-200">
                <p className="text-yellow-700 font-medium">Type "confirm" to save this script, or ask me to make changes.</p>
              </div>
            </div>
          )}
          
          {isLoading && (
            <div className="flex justify-start">
              <div className="bg-white border shadow-sm rounded-lg p-4">
                <div className="flex items-center space-x-2">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-purple-600"></div>
                  <span>Claude is thinking...</span>
                </div>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Input Area */}
      <div className="bg-white border-t p-4">
        <div className="max-w-4xl mx-auto">
          <div className="flex gap-3">
            <textarea
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Describe the business logic you want to implement..."
              className="flex-1 border rounded-lg p-3 resize-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              rows="2"
              disabled={isLoading}
            />
            <button
              onClick={handleSend}
              disabled={isLoading || !inputValue.trim()}
              className="px-6 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed self-end"
            >
              Send
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}