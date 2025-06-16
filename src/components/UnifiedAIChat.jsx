import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';

export default function UnifiedAIChat({ onLogout, onHome, brandName }) {
  document.title = brandName ? `${brandName} - AI Storefront Assistant` : 'AI Storefront Assistant - Feather';
  
  const navigate = useNavigate();
  const [conversations, setConversations] = useState([]);
  const [currentConversationId, setCurrentConversationId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const messagesEndRef = useRef(null);

  useEffect(() => {
    // Fetch conversations on load
    fetchConversations();
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const fetchConversations = async () => {
    try {
      const response = await fetch('/api/chat/conversations', { credentials: 'include' });
      if (response.ok) {
        const data = await response.json();
        setConversations(data);
        
        // Auto-select most recent conversation
        if (data.length > 0 && !currentConversationId) {
          setCurrentConversationId(data[0].id);
          fetchMessages(data[0].id);
        }
      }
    } catch (error) {
      console.error('Error fetching conversations:', error);
    }
  };

  const fetchMessages = async (conversationId) => {
    try {
      const response = await fetch(`/api/chat/conversations/${conversationId}/messages`, { 
        credentials: 'include' 
      });
      if (response.ok) {
        const data = await response.json();
        setMessages(data);
      }
    } catch (error) {
      console.error('Error fetching messages:', error);
    }
  };

  const createNewConversation = () => {
    setCurrentConversationId(null);
    setMessages([]);
    
    // Add welcome message for new conversation
    setMessages([{
      role: 'assistant',
      content: `Hi! I'm your unified AI storefront assistant. I can help you with:

🎨 **Visual Customization**
• Change colors, fonts, layouts
• Add banners, messages, and custom content
• Style buttons, cards, and other elements

⚙️ **Business Logic**
• Create validation rules and order requirements
• Set up pricing modifications
• Configure customer-specific restrictions

🚀 **Complex Requests** 
• "Add OrderType dropdown and make it mandatory"
• "Create a VIP customer discount and highlight it"
• "Add shipping options with validation rules"

I remember our previous conversations, so you can reference past work like "make that field we added yesterday required" or "apply the same styling to the cart page."

What would you like to customize today?`,
      created_at: new Date().toISOString(),
      message_type: 'welcome'
    }]);
  };

  const selectConversation = (conversationId) => {
    setCurrentConversationId(conversationId);
    fetchMessages(conversationId);
  };

  const handleSend = async () => {
    if (!inputValue.trim() || isLoading) return;

    const userMessage = inputValue.trim();
    setInputValue('');
    
    // Add user message to UI immediately
    const newUserMessage = {
      role: 'user',
      content: userMessage,
      created_at: new Date().toISOString(),
      message_type: 'user_request'
    };
    
    setMessages(prev => [...prev, newUserMessage]);
    setIsLoading(true);

    try {
      const response = await fetch('/api/unified-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          message: userMessage,
          conversationId: currentConversationId
        })
      });

      if (!response.ok) throw new Error('Failed to get response');

      const data = await response.json();
      
      // Add AI response to messages
      const aiMessage = {
        role: 'assistant',
        content: data.message,
        created_at: new Date().toISOString(),
        message_type: data.intent,
        metadata: JSON.stringify({
          intent: data.intent,
          uiResults: data.uiResults,
          logicResults: data.logicResults
        })
      };
      
      setMessages(prev => [...prev, aiMessage]);
      
      // Update current conversation ID if this was a new conversation
      if (!currentConversationId) {
        setCurrentConversationId(data.conversationId);
      }
      
      // Refresh conversations list to show updated title/timestamp
      fetchConversations();
      
    } catch (error) {
      console.error('Error:', error);
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: 'Sorry, I encountered an error. Please try again.',
        created_at: new Date().toISOString(),
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

  const formatTimestamp = (timestamp) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  const filteredConversations = conversations.filter(conv => 
    !searchQuery || conv.title.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const renderMessage = (message) => {
    let metadata = null;
    try {
      metadata = message.metadata ? JSON.parse(message.metadata) : null;
    } catch (e) {
      // Ignore JSON parse errors
    }

    return (
      <div key={message.id || Math.random()} className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}>
        <div className={`max-w-3xl rounded-lg p-4 ${
          message.role === 'user' 
            ? 'bg-blue-600 text-white' 
            : 'bg-white border shadow-sm'
        }`}>
          <div className="whitespace-pre-wrap">{message.content}</div>
          
          {/* Show operation results if any */}
          {metadata && (metadata.uiResults || metadata.logicResults) && (
            <div className="mt-3 p-2 bg-green-50 border border-green-200 rounded">
              <p className="text-sm font-medium text-green-800 mb-1">Changes Applied:</p>
              <div className="text-sm text-green-700">
                {metadata.uiResults && (
                  <div>✓ UI: {metadata.uiResults.changes?.join(', ') || 'Style modifications applied'}</div>
                )}
                {metadata.logicResults && (
                  <div>✓ Logic: {metadata.logicResults.description || 'Business rule created'}</div>
                )}
              </div>
            </div>
          )}
          
          {message.created_at && (
            <div className={`text-xs mt-2 ${message.role === 'user' ? 'text-blue-100' : 'text-gray-500'}`}>
              {formatTimestamp(message.created_at)}
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Conversations Sidebar */}
      <div className="w-80 bg-white border-r flex flex-col">
        {/* Header */}
        <div className="p-4 border-b">
          <div className="flex justify-between items-center mb-3">
            <h2 className="text-lg font-semibold">AI Assistant</h2>
            <button 
              onClick={createNewConversation}
              className="px-3 py-1 bg-blue-500 text-white rounded text-sm hover:bg-blue-600"
            >
              New Chat
            </button>
          </div>
          
          {/* Search */}
          <input
            type="text"
            placeholder="Search conversations..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full px-3 py-2 border rounded text-sm"
          />
        </div>
        
        {/* Conversations List */}
        <div className="flex-1 overflow-y-auto">
          {filteredConversations.map(conversation => (
            <div
              key={conversation.id}
              onClick={() => selectConversation(conversation.id)}
              className={`p-3 border-b cursor-pointer hover:bg-gray-50 ${
                currentConversationId === conversation.id ? 'bg-blue-50 border-l-4 border-l-blue-500' : ''
              }`}
            >
              <div className="font-medium text-sm truncate">{conversation.title}</div>
              <div className="text-xs text-gray-500 mt-1">
                {formatTimestamp(conversation.updated_at)}
              </div>
            </div>
          ))}
          
          {filteredConversations.length === 0 && (
            <div className="p-4 text-center text-gray-500 text-sm">
              {searchQuery ? 'No conversations found' : 'No conversations yet'}
            </div>
          )}
        </div>
      </div>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col">
        {/* Header */}
        <div className="bg-white shadow-sm border-b p-4">
          <div className="flex justify-between items-center">
            <h1 className="text-2xl font-bold text-gray-800">AI Storefront Assistant</h1>
            <div className="flex gap-2">
              <button onClick={() => navigate('/backoffice')} className="px-3 py-1 bg-blue-500 text-white rounded">Back</button>
              <button onClick={onHome} className="px-3 py-1 bg-gray-400 text-white rounded">Home</button>
              <button onClick={onLogout} className="px-3 py-1 bg-red-500 text-white rounded">Logout</button>
            </div>
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-6">
          <div className="max-w-4xl mx-auto space-y-4">
            {messages.map((message, index) => renderMessage(message))}
            
            {isLoading && (
              <div className="flex justify-start">
                <div className="bg-white border shadow-sm rounded-lg p-4">
                  <div className="flex items-center space-x-2">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
                    <span>AI is thinking...</span>
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
                placeholder="Ask me to customize your storefront... (e.g., 'Add OrderType dropdown and make it mandatory')"
                className="flex-1 border rounded-lg p-3 resize-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                rows="2"
                disabled={isLoading}
              />
              <button
                onClick={handleSend}
                disabled={isLoading || !inputValue.trim()}
                className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed self-end"
              >
                Send
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}