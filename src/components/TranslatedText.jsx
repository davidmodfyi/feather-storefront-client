import React, { useState, useEffect } from 'react';
import { useTranslation } from '../hooks/useTranslation';

const TranslatedText = ({ 
  children, 
  context = 'General B2B eCommerce interface',
  fallback = null 
}) => {
  const { translateText, userLanguage, isLoading } = useTranslation();
  const [translatedText, setTranslatedText] = useState(children);

  useEffect(() => {
    // TEMPORARY FIX: Disable translation to stop the infinite loop
    // Only translate if user language is not English
    if (userLanguage && userLanguage !== 'en') {
      console.log(`🌍 DISABLED: Would translate "${children}" to ${userLanguage}`);
      // For now, just show original text to stop the API flood
      setTranslatedText(children);
    } else {
      setTranslatedText(children);
    }
  }, [children, context, userLanguage]);

  // Return the translated text or fallback
  return translatedText || fallback || children;
};

export default TranslatedText;