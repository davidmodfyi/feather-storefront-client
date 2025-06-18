// Test script for intent detection
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
  
  console.log(`Message: "${message}"`);
  console.log(`Logic matches: ${logicMatches}`, logicKeywords.filter(keyword => lowerMessage.includes(keyword)));
  console.log(`UI matches: ${uiMatches}`, uiKeywords.filter(keyword => lowerMessage.includes(keyword)));
  
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

// Test cases
const testMessages = [
  "Make the Add to Cart buttons brown",
  "Add 20% surcharge for Pennsylvania customers", 
  "Make the buttons blue",
  "Add OrderType dropdown and make it mandatory",
  "Change header background to blue",
  "Prevent customers on hold from placing orders"
];

console.log("Testing intent detection:");
testMessages.forEach(msg => {
  const intent = detectIntent(msg);
  console.log(`"${msg}" -> ${intent}\n`);
});