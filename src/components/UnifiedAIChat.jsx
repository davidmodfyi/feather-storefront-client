import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import ScriptPanel from './ScriptPanel';

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
  const [dashboardScripts, setDashboardScripts] = useState({
    storefrontUI: [],
    cartUI: [],
    storefrontLogic: [],
    cartLogic: []
  });
  const [expandedPanels, setExpandedPanels] = useState({
    storefrontUI: false,
    cartUI: false,
    storefrontLogic: false,
    cartLogic: false
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

    // Fetch dashboard scripts
    fetchDashboardScripts();

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

  // Fetch dashboard scripts
  const fetchDashboardScripts = async () => {
    try {
      const response = await fetch('/api/dashboard/scripts', { credentials: 'include' });
      if (response.ok) {
        const scripts = await response.json();
        setDashboardScripts(scripts);
      }
    } catch (error) {
      console.error('Error fetching dashboard scripts:', error);
    }
  };

  // Enhanced intent detection for UI + Logic combinations
  const detectIntent = (message) => {
    const lowerMessage = message.toLowerCase();
    
    // Business logic keywords
    const logicKeywords = [
      'validation', 'validate', 'prevent', 'block', 'require', 'mandatory', 'minimum', 'maximum',
      'surcharge', 'discount', 'pricing', 'price', 'rule', 'restriction', 'logic', 'business',
      'customer type', 'hold', 'pennsylvania', 'california', 'state', 'order value', 'trigger',
      'script', 'function', 'ordertype', 'shipping', 'tax'
    ];
    
    // UI/Visual keywords (enhanced with placement actions)
    const uiKeywords = [
      'color', 'button', 'style', 'background', 'font', 'size', 'layout', 'appearance',
      'brown', 'blue', 'green', 'red', 'shadow', 'border', 'rounded', 'header',
      'banner', 'message', 'content', 'dropdown', 'field', 'form', 'input',
      'add to', 'display on', 'show on', 'place on', 'screen', 'cart', 'storefront',
      'near', 'above', 'below', 'beside', 'create', 'add'
    ];
    
    const logicMatches = logicKeywords.filter(keyword => lowerMessage.includes(keyword)).length;
    const uiMatches = uiKeywords.filter(keyword => lowerMessage.includes(keyword)).length;
    
    // Enhanced detection for 'both' scenarios
    const hasMandatoryPattern = lowerMessage.includes('mandatory') || lowerMessage.includes('required') || lowerMessage.includes('require');
    const hasUIPlacement = lowerMessage.includes('add to') || lowerMessage.includes('display on') || 
                          lowerMessage.includes('show on') || lowerMessage.includes('place on') ||
                          lowerMessage.includes('screen') || lowerMessage.includes('cart') || 
                          lowerMessage.includes('storefront');
    const hasUIElement = lowerMessage.includes('dropdown') || lowerMessage.includes('field') || 
                        lowerMessage.includes('form') || lowerMessage.includes('input') || 
                        lowerMessage.includes('button');
    
    // Complex patterns that indicate both UI and logic work needed
    const bothPatterns = [
      /add.*and.*(?:mandatory|required|require)/i,
      /create.*and.*(?:mandatory|required|require)/i,
      /(?:mandatory|required|require).*(?:add to|display on|show on)/i,
      /(?:add to|display on|show on).*(?:mandatory|required|require)/i
    ];
    
    const hasBothPattern = bothPatterns.some(pattern => pattern.test(message));
    
    // Return 'both' if we detect UI + Logic combination
    if (hasBothPattern || (hasMandatoryPattern && (hasUIPlacement || hasUIElement))) {
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
      
      console.log(`🔍 DIAGNOSIS: Intent detected as "${intent}" for message: "${userMessage}"`);
      
      if (intent === 'both') {
        console.log('🎯 ROUTING: Sequential API calls - UI first, then Logic');
        let allChanges = [];
        let combinedMessages = [];
        
        // Step 1: Call UI API first to create the visual elements
        console.log('📱 Step 1: Creating UI components...');
        try {
          const uiResponse = await fetch('/api/ai-customize', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({
              message: userMessage,
              distributorSlug: distributorSlug,
              currentPageContext: currentPageContext
            })
          });

          if (uiResponse.ok) {
            const uiData = await uiResponse.json();
            console.log('📋 UI API RESPONSE:', uiData);
            
            if (uiData.changes && uiData.changes.length > 0) {
              allChanges.push(...uiData.changes);
              combinedMessages.push(`✅ UI Components: ${uiData.response}`);
            }
          } else {
            console.log('⚠️ UI API call failed, but continuing with logic...');
          }
        } catch (uiError) {
          console.error('❌ UI API ERROR:', uiError);
          combinedMessages.push('⚠️ UI creation encountered an issue, but continuing with logic...');
        }

        // Step 2: Call Logic API to add validation rules
        console.log('⚙️ Step 2: Creating logic validation...');
        try {
          const logicResponse = await fetch('/api/claude-logic-chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({
              message: `${userMessage}

IMPORTANT: For dynamic form fields created via UI customization, access them directly on the cart object. For example:
- OrderType field: access as cart.OrderType (exact case match)
- DeliveryDate field: access as cart.DeliveryDate  
- Dynamic form values are merged into the cart object, so use cart.FieldName where FieldName matches the exact label from the UI.`,
              customerAttributes: customerAttributes,
              dynamicFormFields: dynamicFormFields,
              triggerPoints: ['Storefront Load', 'Quantity Change', 'Add to Cart', 'Submit Order'],
              currentPageContext: currentPageContext
            })
          });

          if (logicResponse.ok) {
            const logicData = await logicResponse.json();
            console.log('📋 LOGIC API RESPONSE:', logicData);
            
            combinedMessages.push(`✅ Business Logic: ${logicData.message}`);
            
            // Save the logic script if generated
            if (logicData.script) {
              console.log('💾 SAVING LOGIC SCRIPT:', logicData.script);
              const saveResponse = await fetch('/api/logic-scripts', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({
                  ...logicData.script,
                  original_prompt: userMessage
                })
              });

              if (saveResponse.ok) {
                console.log('✅ LOGIC SCRIPT SAVED SUCCESSFULLY');
                allChanges.push(logicData.script.description);
              }
            }
          } else {
            console.log('⚠️ Logic API call failed');
            combinedMessages.push('⚠️ Logic validation setup encountered an issue.');
          }
        } catch (logicError) {
          console.error('❌ LOGIC API ERROR:', logicError);
          combinedMessages.push('⚠️ Logic validation setup encountered an issue.');
        }

        // Add combined response message
        const combinedContent = combinedMessages.length > 0 
          ? combinedMessages.join('\n\n') 
          : 'I attempted to create both UI and logic components for your request.';
          
        const aiMessage = {
          id: Date.now() + 1,
          role: 'assistant',
          content: combinedContent,
          changes: allChanges,
          timestamp: new Date(),
          message_type: 'both_response'
        };
        
        setMessages(prev => [...prev, aiMessage]);

        // Show success notification and refresh
        if (allChanges.length > 0) {
          setTimeout(() => {
            fetchCurrentPageContext();
            fetchDashboardScripts();
          }, 500);
          
          setTimeout(() => {
            alert(`Successfully applied ${allChanges.length} change(s)! Both UI and logic components created. Refresh the page to see updates.`);
          }, 1000);
        }
        
      } else if (intent === 'logic') {
        console.log('🎯 ROUTING: Sending to LOGIC API (/api/claude-logic-chat)');
        // Pure logic customization API
        response = await fetch('/api/claude-logic-chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            message: `${userMessage}

IMPORTANT: For dynamic form fields created via UI customization, access them directly on the cart object. For example:
- OrderType field: access as cart.OrderType (exact case match)
- DeliveryDate field: access as cart.DeliveryDate  
- Dynamic form values are merged into the cart object, so use cart.FieldName where FieldName matches the exact label from the UI.`,
            customerAttributes: customerAttributes,
            dynamicFormFields: dynamicFormFields,
            triggerPoints: ['Storefront Load', 'Quantity Change', 'Add to Cart', 'Submit Order'],
            currentPageContext: currentPageContext
          })
        });

        if (!response.ok) throw new Error('Failed to get logic response');
        data = await response.json();
        console.log('📋 LOGIC API RESPONSE:', data);
        
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
          console.log('💾 SAVING LOGIC SCRIPT:', data.script);
          try {
            const saveResponse = await fetch('/api/logic-scripts', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              credentials: 'include',
              body: JSON.stringify({
                ...data.script,
                original_prompt: userMessage
              })
            });

            if (saveResponse.ok) {
              console.log('✅ LOGIC SCRIPT SAVED SUCCESSFULLY');
              setMessages(prev => [...prev, { 
                id: Date.now() + 2,
                role: 'assistant', 
                content: '✅ Perfect! Your logic script has been saved and is now active.',
                timestamp: new Date(),
                changes: [data.script.description],
                message_type: 'success'
              }]);
              
              setTimeout(() => {
                fetchCurrentPageContext();
                fetchDashboardScripts();
              }, 500);
              
              setTimeout(() => {
                alert('Logic script successfully created and saved!');
              }, 1000);
            }
          } catch (saveError) {
            console.error('❌ ERROR SAVING LOGIC SCRIPT:', saveError);
          }
        } else {
          console.log('⚠️ NO LOGIC SCRIPT WAS GENERATED');
        }
        
      } else {
        console.log('🎯 ROUTING: Sending to UI API (/api/ai-customize)');
        // Pure UI customization API
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
          setTimeout(() => {
            fetchCurrentPageContext();
            fetchDashboardScripts();
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

  // Handle script analysis (view original prompt and generated script)
  const handleAnalyzeScript = (script) => {
    // Create a more detailed analysis display
    let content = '';
    let title = '';
    
    if (script.type === 'ui' || script.styles) {
      title = 'UI Style Script';
      content = `CSS Selector: ${script.selector || 'Unknown'}\n\nGenerated Styles:\n${script.styles || 'No styles available'}`;
    } else if (script.script_content || script.scriptContent) {
      title = 'Logic Script';
      content = `Description: ${script.description || 'No description'}\n\nTrigger Point: ${script.trigger_point || script.triggerPoint || 'Unknown'}\n\nGenerated Script:\n${script.script_content || script.scriptContent || 'No script content'}`;
    } else {
      title = 'Script Details';
      content = `Type: ${script.type || 'Unknown'}\n\nContent: ${JSON.stringify(script, null, 2)}`;
    }
    
    const fullMessage = `🔍 ${title}\n\n📝 Original Prompt:\n${script.originalPrompt || script.original_prompt || 'Not available'}\n\n⚙️ Generated Content:\n${content}`;
    
    // Create a more user-friendly display
    const textarea = document.createElement('textarea');
    textarea.value = fullMessage;
    textarea.style.width = '80vw';
    textarea.style.height = '60vh';
    textarea.style.fontFamily = 'monospace';
    textarea.style.fontSize = '12px';
    textarea.style.padding = '10px';
    textarea.style.border = '1px solid #ccc';
    textarea.style.borderRadius = '4px';
    textarea.readOnly = true;
    
    const container = document.createElement('div');
    container.style.position = 'fixed';
    container.style.top = '0';
    container.style.left = '0';
    container.style.width = '100vw';
    container.style.height = '100vh';
    container.style.backgroundColor = 'rgba(0, 0, 0, 0.5)';
    container.style.display = 'flex';
    container.style.alignItems = 'center';
    container.style.justifyContent = 'center';
    container.style.zIndex = '9999';
    
    const modal = document.createElement('div');
    modal.style.backgroundColor = 'white';
    modal.style.padding = '20px';
    modal.style.borderRadius = '8px';
    modal.style.boxShadow = '0 4px 6px rgba(0, 0, 0, 0.1)';
    modal.style.maxWidth = '90vw';
    modal.style.maxHeight = '90vh';
    modal.style.overflow = 'auto';
    
    const closeButton = document.createElement('button');
    closeButton.textContent = '✕ Close';
    closeButton.style.marginBottom = '10px';
    closeButton.style.padding = '5px 10px';
    closeButton.style.backgroundColor = '#f0f0f0';
    closeButton.style.border = '1px solid #ccc';
    closeButton.style.borderRadius = '4px';
    closeButton.style.cursor = 'pointer';
    closeButton.onclick = () => document.body.removeChild(container);
    
    const copyButton = document.createElement('button');
    copyButton.textContent = '📋 Copy';
    copyButton.style.marginBottom = '10px';
    copyButton.style.marginLeft = '10px';
    copyButton.style.padding = '5px 10px';
    copyButton.style.backgroundColor = '#007bff';
    copyButton.style.color = 'white';
    copyButton.style.border = 'none';
    copyButton.style.borderRadius = '4px';
    copyButton.style.cursor = 'pointer';
    copyButton.onclick = () => {
      navigator.clipboard.writeText(fullMessage);
      copyButton.textContent = '✅ Copied!';
      setTimeout(() => copyButton.textContent = '📋 Copy', 2000);
    };
    
    modal.appendChild(closeButton);
    modal.appendChild(copyButton);
    modal.appendChild(textarea);
    container.appendChild(modal);
    document.body.appendChild(container);
    
    // Close on background click
    container.onclick = (e) => {
      if (e.target === container) {
        document.body.removeChild(container);
      }
    };
  };

  // Handle script deletion
  const handleDeleteScript = async (script) => {
    if (!confirm(`Are you sure you want to delete this ${script.type} script?`)) return;
    
    try {
      const endpoint = script.type === 'ui' 
        ? `/api/styles/${script.id}` 
        : `/api/logic-scripts/${script.id}`;
      
      const response = await fetch(endpoint, {
        method: 'DELETE',
        credentials: 'include'
      });
      
      if (response.ok) {
        // Refresh the dashboard scripts
        fetchDashboardScripts();
        alert('Script deleted successfully');
      } else {
        alert('Failed to delete script');
      }
    } catch (error) {
      console.error('Error deleting script:', error);
      alert('Error deleting script');
    }
  };

  // Toggle panel expansion
  const togglePanel = (panelKey) => {
    setExpandedPanels(prev => ({
      ...prev,
      [panelKey]: !prev[panelKey]
    }));
  };

  // Handle script reordering
  const handleReorderScripts = async (reorderedScripts) => {
    console.log('Reordering scripts:', reorderedScripts);
    
    try {
      // Update sequence order for logic scripts in the database
      for (const script of reorderedScripts) {
        if (script.sequence_order !== undefined) {
          const response = await fetch(`/api/logic-scripts/${script.id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({
              sequence_order: script.sequenceOrder || script.sequence_order
            })
          });
          
          if (!response.ok) {
            throw new Error(`Failed to update script ${script.id}`);
          }
        }
      }
      
      // Refresh the dashboard scripts after reordering
      fetchDashboardScripts();
      
    } catch (error) {
      console.error('Error reordering scripts:', error);
      alert('Failed to reorder scripts. Please try again.');
    }
  };

  return (
    <div className="h-screen flex flex-col p-4">
      {/* Header */}
      <div className="flex justify-between mb-4 flex-shrink-0">
        <h1 className="text-2xl font-bold">AI Storefront Assistant</h1>
        <div className="flex gap-2">
          <button onClick={() => navigate('/backoffice')} className="px-3 py-1 bg-blue-500 text-white rounded">Back</button>
          <button onClick={onHome} className="px-3 py-1 bg-gray-400 text-white rounded">Home</button>
          <button onClick={onLogout} className="px-3 py-1 bg-red-500 text-white rounded">Logout</button>
        </div>
      </div>

      {/* Dashboard Panels - Vertical Stack */}
      <div className="mb-4 flex-shrink-0 space-y-2">
        {console.log('🔍 Rendering dashboard with scripts:', dashboardScripts)}
        
        {/* Storefront UI Panel */}
        <div className="bg-white border rounded-lg shadow">
          <div 
            className="px-4 py-3 cursor-pointer hover:bg-gray-50 flex justify-between items-center"
            onClick={() => togglePanel('storefrontUI')}
          >
            <div className="flex items-center gap-2">
              <span className="text-lg">📱</span>
              <h3 className="text-lg font-semibold text-gray-800">Storefront UI</h3>
              <span className="text-sm bg-blue-100 text-blue-800 px-2 py-1 rounded">
                {dashboardScripts.storefrontUI.length}
              </span>
            </div>
            <span className="text-gray-400">
              {expandedPanels.storefrontUI ? '▲' : '▼'}
            </span>
          </div>
          {expandedPanels.storefrontUI && (
            <div className="border-t bg-gray-50">
              <div className="p-2 space-y-1 max-h-64 overflow-y-auto">
                {dashboardScripts.storefrontUI.length === 0 ? (
                  <div className="text-center py-4 text-gray-500">
                    <p className="text-sm">No scripts yet. Use the chat below to create customizations!</p>
                  </div>
                ) : (
                  dashboardScripts.storefrontUI.map((script) => (
                    <div key={script.id} className="bg-white border rounded p-2 flex justify-between items-center hover:shadow-sm">
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-sm truncate">
                          {script.selector || 'Unknown selector'}
                        </div>
                        <div className="text-xs text-gray-500">
                          {new Date(script.createdAt).toLocaleDateString()}
                        </div>
                      </div>
                      <div className="flex gap-1 ml-2">
                        <button
                          onClick={() => handleAnalyzeScript(script)}
                          className="text-blue-500 hover:text-blue-700 text-sm"
                          title="Inspect script"
                        >
                          🔍
                        </button>
                        <button
                          onClick={() => handleDeleteScript(script)}
                          className="text-red-500 hover:text-red-700 text-sm"
                          title="Delete script"
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

        {/* Storefront Logic Panel */}
        <div className="bg-white border rounded-lg shadow">
          <div 
            className="px-4 py-3 cursor-pointer hover:bg-gray-50 flex justify-between items-center"
            onClick={() => togglePanel('storefrontLogic')}
          >
            <div className="flex items-center gap-2">
              <span className="text-lg">⚙️</span>
              <h3 className="text-lg font-semibold text-gray-800">Storefront Logic</h3>
              <span className="text-sm bg-green-100 text-green-800 px-2 py-1 rounded">
                {dashboardScripts.storefrontLogic.length}
              </span>
            </div>
            <span className="text-gray-400">
              {expandedPanels.storefrontLogic ? '▲' : '▼'}
            </span>
          </div>
          {expandedPanels.storefrontLogic && (
            <div className="border-t bg-gray-50">
              <div className="p-2 space-y-1 max-h-64 overflow-y-auto">
                {dashboardScripts.storefrontLogic.length === 0 ? (
                  <div className="text-center py-4 text-gray-500">
                    <p className="text-sm">No scripts yet. Use the chat below to create customizations!</p>
                  </div>
                ) : (
                  dashboardScripts.storefrontLogic.map((script) => (
                    <div key={script.id} className="bg-white border rounded p-2 flex justify-between items-center hover:shadow-sm">
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-sm truncate">
                          {script.description || 'Unknown description'}
                        </div>
                        <div className="text-xs text-gray-500">
                          Trigger: {script.triggerPoint} • {script.active ? '🟢 Active' : '🔴 Inactive'} • {new Date(script.createdAt).toLocaleDateString()}
                        </div>
                      </div>
                      <div className="flex gap-1 ml-2">
                        <button
                          onClick={() => handleAnalyzeScript(script)}
                          className="text-blue-500 hover:text-blue-700 text-sm"
                          title="Inspect script"
                        >
                          🔍
                        </button>
                        <button
                          onClick={() => handleDeleteScript(script)}
                          className="text-red-500 hover:text-red-700 text-sm"
                          title="Delete script"
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

        {/* Cart UI Panel */}
        <div className="bg-white border rounded-lg shadow">
          <div 
            className="px-4 py-3 cursor-pointer hover:bg-gray-50 flex justify-between items-center"
            onClick={() => togglePanel('cartUI')}
          >
            <div className="flex items-center gap-2">
              <span className="text-lg">🛒</span>
              <h3 className="text-lg font-semibold text-gray-800">Cart UI</h3>
              <span className="text-sm bg-yellow-100 text-yellow-800 px-2 py-1 rounded">
                {dashboardScripts.cartUI.length}
              </span>
            </div>
            <span className="text-gray-400">
              {expandedPanels.cartUI ? '▲' : '▼'}
            </span>
          </div>
          {expandedPanels.cartUI && (
            <div className="border-t bg-gray-50">
              <div className="p-2 space-y-1 max-h-64 overflow-y-auto">
                {dashboardScripts.cartUI.length === 0 ? (
                  <div className="text-center py-4 text-gray-500">
                    <p className="text-sm">No scripts yet. Use the chat below to create customizations!</p>
                  </div>
                ) : (
                  dashboardScripts.cartUI.map((script) => (
                    <div key={script.id} className="bg-white border rounded p-2 flex justify-between items-center hover:shadow-sm">
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-sm truncate">
                          {script.selector || 'Unknown selector'}
                        </div>
                        <div className="text-xs text-gray-500">
                          {new Date(script.createdAt).toLocaleDateString()}
                        </div>
                      </div>
                      <div className="flex gap-1 ml-2">
                        <button
                          onClick={() => handleAnalyzeScript(script)}
                          className="text-blue-500 hover:text-blue-700 text-sm"
                          title="Inspect script"
                        >
                          🔍
                        </button>
                        <button
                          onClick={() => handleDeleteScript(script)}
                          className="text-red-500 hover:text-red-700 text-sm"
                          title="Delete script"
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

        {/* Cart Logic Panel */}
        <div className="bg-white border rounded-lg shadow">
          <div 
            className="px-4 py-3 cursor-pointer hover:bg-gray-50 flex justify-between items-center"
            onClick={() => togglePanel('cartLogic')}
          >
            <div className="flex items-center gap-2">
              <span className="text-lg">🔧</span>
              <h3 className="text-lg font-semibold text-gray-800">Cart Logic</h3>
              <span className="text-sm bg-red-100 text-red-800 px-2 py-1 rounded">
                {dashboardScripts.cartLogic.length}
              </span>
            </div>
            <span className="text-gray-400">
              {expandedPanels.cartLogic ? '▲' : '▼'}
            </span>
          </div>
          {expandedPanels.cartLogic && (
            <div className="border-t bg-gray-50">
              <div className="p-2 space-y-1 max-h-64 overflow-y-auto">
                {dashboardScripts.cartLogic.length === 0 ? (
                  <div className="text-center py-4 text-gray-500">
                    <p className="text-sm">No scripts yet. Use the chat below to create customizations!</p>
                  </div>
                ) : (
                  dashboardScripts.cartLogic.map((script) => (
                    <div key={script.id} className="bg-white border rounded p-2 flex justify-between items-center hover:shadow-sm">
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-sm truncate">
                          {script.description || 'Unknown description'}
                        </div>
                        <div className="text-xs text-gray-500">
                          Trigger: {script.triggerPoint} • {script.active ? '🟢 Active' : '🔴 Inactive'} • {new Date(script.createdAt).toLocaleDateString()}
                        </div>
                      </div>
                      <div className="flex gap-1 ml-2">
                        <button
                          onClick={() => handleAnalyzeScript(script)}
                          className="text-blue-500 hover:text-blue-700 text-sm"
                          title="Inspect script"
                        >
                          🔍
                        </button>
                        <button
                          onClick={() => handleDeleteScript(script)}
                          className="text-red-500 hover:text-red-700 text-sm"
                          title="Delete script"
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
      </div>

      {/* Chat Container - Remaining height */}
      <div className="flex-1 bg-gray-50 rounded-lg flex flex-col overflow-hidden min-h-0">
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