// src/distributors/[DISTRIBUTOR]/components/AIChat.jsx
import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';

export default function AIChat({ onLogout, onHome, brandName }) {
  const [messages, setMessages] = useState([]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [distributorSlug, setDistributorSlug] = useState('');
  const messagesEndRef = useRef(null);
  const navigate = useNavigate();

  // Set title
  document.title = brandName ? `${brandName} - AI Customization` : 'AI Customization - Feather';

  useEffect(() => {
    // Get distributor info
    fetch('/api/me', { credentials: 'include' })
      .then(res => res.json())
      .then(data => {
        setDistributorSlug(data.distributorSlug || 'default');
      })
      .catch(console.error);

    // Add welcome message
    setMessages([
      {
        id: 1,
        type: 'ai',
        content: `Hello! I'm your AI customization assistant for ${brandName}. I can help you modify your storefront appearance and functionality. 

For example, you can ask me to:
• "Make the Add to Cart buttons brown instead of green"
• "Change the header background to blue"
• "Make the product cards have rounded corners"
• "Add a shadow to the navigation bar"

What would you like to customize today?`,
        timestamp: new Date()
      }
    ]);
  }, [brandName]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleSendMessage = async () => {
    if (!inputValue.trim() || isLoading) return;

    const userMessage = {
      id: Date.now(),
      type: 'user',
      content: inputValue.trim(),
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    setInputValue('');
    setIsLoading(true);

    try {
      // Send to AI customization endpoint
      const response = await fetch('/api/ai-customize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          message: userMessage.content,
          distributorSlug: distributorSlug
        })
      });

      if (!response.ok) {
        throw new Error('Failed to get AI response');
      }

      const data = await response.json();

      const aiMessage = {
        id: Date.now() + 1,
        type: 'ai',
        content: data.response,
        changes: data.changes || [],
        timestamp: new Date()
      };

      setMessages(prev => [...prev, aiMessage]);

      // If changes were made, show success notification
      if (data.changes && data.changes.length > 0) {
        setTimeout(() => {
          alert(`Successfully applied ${data.changes.length} change(s)! Refresh the page to see updates.`);
        }, 1000);
      }

    } catch (error) {
      console.error('AI Chat error:', error);
      const errorMessage = {
        id: Date.now() + 1,
        type: 'ai',
        content: 'Sorry, I encountered an error. Please try again or contact support if the issue persists.',
        timestamp: new Date()
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const goToBackoffice = () => {
    navigate('/backoffice');
  };

  const formatTime = (timestamp) => {
    return timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="p-6 h-screen flex flex-col">
      {/* Header */}
      <div className="flex justify-between mb-4">
        <h1 className="text-2xl font-bold">AI Customization Assistant</h1>
        <div className="flex gap-2">
          <button onClick={goToBackoffice} className="px-3 py-1 bg-blue-500 text-white rounded">Back</button>
          <button onClick={onHome} className="px-3 py-1 bg-gray-400 text-white rounded">Home</button>
          <button onClick={onLogout} className="px-3 py-1 bg-red-500 text-white rounded">Logout</button>
        </div>
      </div>

      {/* Chat Container */}
      <div className="flex-1 bg-gray-50 rounded-lg flex flex-col overflow-hidden">
        {/* Messages Area */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.map((message) => (
            <div
              key={message.id}
              className={`flex ${message.type === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-3xl p-3 rounded-lg ${
                  message.type === 'user'
                    ? 'bg-blue-500 text-white'
                    : 'bg-white border shadow-sm'
                }`}
              >
                <div className="whitespace-pre-wrap">{message.content}</div>
                
                {/* Show changes if any */}
                {message.changes && message.changes.length > 0 && (
                  <div className="mt-3 p-2 bg-green-50 border border-green-200 rounded">
                    <p className="text-sm font-medium text-green-800 mb-1">Changes Applied:</p>
                    <ul className="text-sm text-green-700">
                      {message.changes.map((change, index) => (
                        <li key={index} className="flex items-start">
                          <span className="text-green-500 mr-1">✓</span>
                          {change}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                
                <div className={`text-xs mt-1 ${
                  message.type === 'user' ? 'text-blue-100' : 'text-gray-500'
                }`}>
                  {formatTime(message.timestamp)}
                </div>
              </div>
            </div>
          ))}
          
          {/* Loading indicator */}
          {isLoading && (
            <div className="flex justify-start">
              <div className="bg-white border shadow-sm p-3 rounded-lg">
                <div className="flex items-center space-x-2">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-500"></div>
                  <span className="text-gray-500">AI is thinking...</span>
                </div>
              </div>
            </div>
          )}
          
          <div ref={messagesEndRef} />
        </div>

        {/* Input Area */}
        <div className="border-t bg-white p-4">
          <div className="flex space-x-2">
            <textarea
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Ask me to customize your storefront... (e.g., 'Make the buttons blue')"
              className="flex-1 border rounded-lg p-3 resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
              rows="2"
              disabled={isLoading}
            />
            <button
              onClick={handleSendMessage}
              disabled={!inputValue.trim() || isLoading}
              className={`px-6 py-2 rounded-lg font-medium ${
                !inputValue.trim() || isLoading
                  ? 'bg-gray-300 cursor-not-allowed'
                  : 'bg-blue-500 hover:bg-blue-600 text-white'
              }`}
            >
              Send
            </button>
          </div>
          
          <div className="mt-2 text-xs text-gray-500">
            Press Enter to send, Shift+Enter for new line
          </div>
        </div>
      </div>
    </div>
  );
}