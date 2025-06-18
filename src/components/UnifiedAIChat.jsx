import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';

export default function UnifiedAIChat({ onLogout, onHome, brandName }) {
  document.title = brandName ? `${brandName} - AI Storefront Assistant` : 'AI Storefront Assistant - Feather';
  
  const navigate = useNavigate();
  const [messages, setMessages] = useState([]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [distributorSlug, setDistributorSlug] = useState('');
  const [customerAttributes, setCustomerAttributes] = useState([]);
  const [dynamicFormFields, setDynamicFormFields] = useState([]);
  const [currentPageContext, setCurrentPageContext] = useState({});
  const messagesEndRef = useRef(null);

  useEffect(() => {
    // Get distributor info
    fetch('/api/me', { credentials: 'include' })
      .then(res => res.json())
      .then(data => {
        setDistributorSlug(data.distributorSlug || 'default');
      })
      .catch(console.error);

    // Fetch customer attributes for logic context
    fetch('/api/customer-attributes', { credentials: 'include' })
      .then(res => res.json())
      .then(data => setCustomerAttributes(data.attributes || []))
      .catch(console.error);

    // Fetch dynamic form fields for logic context
    fetch('/api/dynamic-content', { credentials: 'include' })
      .then(res => res.json())
      .then(data => {
        const formFields = [];
        Object.entries(data).forEach(([zone, content]) => {
          content.forEach(item => {
            if (item.type === 'form-field') {
              formFields.push({
                zone: zone,
                label: item.data.label,
                fieldType: item.data.fieldType,
                options: item.data.options
              });
            }
          });
        });
        setDynamicFormFields(formFields);
      })
      .catch(console.error);

    // Fetch current page context (what elements already exist)
    fetchCurrentPageContext();

    // Add welcome message
    setMessages([{
      id: 1,
      role: 'assistant',
      content: `Hi! I'm your unified AI storefront assistant for ${brandName}. I can help you with:

🎨 **Visual Customization**
• Change colors, fonts, layouts (e.g., "Make the Add to Cart buttons brown")
• Add banners, messages, and custom content
• Style buttons, cards, and other elements

⚙️ **Business Logic**
• Create validation rules and order requirements
• Set up pricing modifications (e.g., "Add 20% surcharge for Pennsylvania customers")
• Configure customer-specific restrictions
• Make fields mandatory before order submission

🚀 **Complex Requests** 
• "Add OrderType dropdown and make it mandatory"
• "Create a VIP customer discount and highlight it"
• "Add shipping options with validation rules"

What would you like to customize today?`,
      timestamp: new Date(),
      message_type: 'welcome'
    }]);
  }, [brandName]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Fetch current page context to understand what elements already exist
  const fetchCurrentPageContext = async () => {
    try {
      // Get current dynamic content (shows what form fields, etc. are already on pages)
      const dynamicResponse = await fetch('/api/dynamic-content', { credentials: 'include' });
      const dynamicData = await dynamicResponse.json();
      
      // Get current styles (shows what visual customizations exist)
      const stylesResponse = await fetch('/api/styles', { credentials: 'include' });
      const stylesData = await stylesResponse.json();
      
      // Build context summary
      const context = {
        existingFormFields: [],
        existingStyles: Object.keys(stylesData || {}),
        pageElements: {}
      };
      
      // Extract form fields by page
      Object.entries(dynamicData || {}).forEach(([zone, content]) => {
        if (!context.pageElements[zone]) context.pageElements[zone] = [];
        
        content.forEach(item => {
          if (item.type === 'form-field') {
            context.existingFormFields.push({
              zone: zone,
              label: item.data.label,
              type: item.data.fieldType,
              hasOptions: !!(item.data.options && item.data.options.length > 0)
            });
          }
          context.pageElements[zone].push({
            type: item.type,
            details: item.data
          });
        });
      });
      
      setCurrentPageContext(context);
      console.log('Current page context:', context);
    } catch (error) {
      console.error('Error fetching page context:', error);
    }
  };

  // Simple intent detection based on keywords
  const detectIntent = (message) => {
    const lowerMessage = message.toLowerCase();
    
    // Business logic keywords
    const logicKeywords = [
      'validation', 'validate', 'prevent', 'block', 'require', 'mandatory', 'minimum', 'maximum',
      'surcharge', 'discount', 'pricing', 'price', 'rule', 'restriction', 'logic', 'business',
      'customer type', 'hold', 'pennsylvania', 'california', 'state', 'order value', 'trigger',
      'script', 'function', 'ordertype', 'shipping', 'tax'
    ];
    
    // UI/Visual keywords
    const uiKeywords = [
      'color', 'button', 'style', 'background', 'font', 'size', 'layout', 'appearance',
      'brown', 'blue', 'green', 'red', 'shadow', 'border', 'rounded', 'header', 'cart',
      'banner', 'message', 'content', 'dropdown', 'field', 'form', 'input'
    ];
    
    const logicMatches = logicKeywords.filter(keyword => lowerMessage.includes(keyword)).length;
    const uiMatches = uiKeywords.filter(keyword => lowerMessage.includes(keyword)).length;
    
    // If it mentions making something mandatory/required with visual elements, it's likely both
    if ((lowerMessage.includes('mandatory') || lowerMessage.includes('required')) && 
        (lowerMessage.includes('dropdown') || lowerMessage.includes('field'))) {
      return 'both';
    }
    
    // If logic keywords dominate, it's logic
    if (logicMatches > uiMatches && logicMatches > 0) {
      return 'logic';
    }
    
    // Default to UI for styling requests or when UI keywords dominate
    return 'ui';
  };

  const handleSend = async () => {
    if (!inputValue.trim() || isLoading) return;

    const userMessage = inputValue.trim();
    const intent = detectIntent(userMessage);
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
      let response, data;
      
      if (intent === 'logic') {
        // Use logic customization API
        response = await fetch('/api/claude-logic-chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            message: userMessage,
            customerAttributes: customerAttributes,
            dynamicFormFields: dynamicFormFields,
            triggerPoints: ['Storefront Load', 'Quantity Change', 'Add to Cart', 'Submit Order'],
            currentPageContext: currentPageContext
          })
        });

        if (!response.ok) throw new Error('Failed to get logic response');
        data = await response.json();
        
        // Add AI response
        const aiMessage = {
          id: Date.now() + 1,
          role: 'assistant',
          content: data.message,
          timestamp: new Date(),
          message_type: 'logic_response'
        };
        
        setMessages(prev => [...prev, aiMessage]);
        
        // If a script was generated, save it and show success
        if (data.script) {
          try {
            const saveResponse = await fetch('/api/logic-scripts', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              credentials: 'include',
              body: JSON.stringify(data.script)
            });

            if (saveResponse.ok) {
              setMessages(prev => [...prev, { 
                id: Date.now() + 2,
                role: 'assistant', 
                content: '✅ Perfect! Your logic script has been saved and is now active.',
                timestamp: new Date(),
                changes: [data.script.description],
                message_type: 'success'
              }]);
              
              // Refresh page context after logic changes
              setTimeout(() => {
                fetchCurrentPageContext();
              }, 500);
              
              setTimeout(() => {
                alert('Logic script successfully created and saved!');
              }, 1000);
            }
          } catch (saveError) {
            console.error('Error saving script:', saveError);
          }
        }
        
      } else {
        // Use UI customization API
        response = await fetch('/api/ai-customize', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            message: userMessage,
            distributorSlug: distributorSlug,
            currentPageContext: currentPageContext
          })
        });

        if (!response.ok) throw new Error('Failed to get UI response');
        data = await response.json();

        const aiMessage = {
          id: Date.now() + 1,
          role: 'assistant',
          content: data.response,
          changes: data.changes || [],
          timestamp: new Date(),
          message_type: 'ui_response'
        };

        setMessages(prev => [...prev, aiMessage]);

        // Show success notification if changes were made
        if (data.changes && data.changes.length > 0) {
          // Refresh page context after changes
          setTimeout(() => {
            fetchCurrentPageContext();
          }, 500);
          
          setTimeout(() => {
            alert(`Successfully applied ${data.changes.length} change(s)! Refresh the page to see updates.`);
          }, 1000);
        }
      }
      
    } catch (error) {
      console.error('Error:', error);
      setMessages(prev => [...prev, {
        id: Date.now() + 1,
        role: 'assistant',
        content: 'Sorry, I encountered an error. Please try again or contact support if the issue persists.',
        timestamp: new Date(),
        message_type: 'error'
      }]);
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

  const formatTime = (timestamp) => {
    return timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="p-6 h-screen flex flex-col">
      {/* Header */}
      <div className="flex justify-between mb-4">
        <h1 className="text-2xl font-bold">AI Storefront Assistant</h1>
        <div className="flex gap-2">
          <button onClick={() => navigate('/backoffice')} className="px-3 py-1 bg-blue-500 text-white rounded">Back</button>
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
              className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-3xl p-3 rounded-lg ${
                  message.role === 'user'
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
                  message.role === 'user' ? 'text-blue-100' : 'text-gray-500'
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
              placeholder="Ask me to customize your storefront... (e.g., 'Make the buttons blue' or 'Add 20% surcharge for Pennsylvania')"
              className="flex-1 border rounded-lg p-3 resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
              rows="2"
              disabled={isLoading}
            />
            <button
              onClick={handleSend}
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