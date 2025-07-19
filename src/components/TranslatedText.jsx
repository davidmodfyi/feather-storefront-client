import React, { useState, useEffect } from 'react';
import { useTranslation } from '../hooks/useTranslation';

const TranslatedText = ({ 
  children, 
  context = 'General B2B eCommerce interface',
  fallback = null 
}) => {
  console.log('🚨 TESTING: TranslatedText component loaded with text:', children);
  const { translateText, userLanguage, isLoading } = useTranslation();
  const [translatedText, setTranslatedText] = useState(children);
  
  console.log('🚨 TESTING: Current user language:', userLanguage);

  useEffect(() => {
    const translateContent = async () => {
      if (typeof children === 'string' && children.trim()) {
        console.log(`🌍 Translating "${children}" to ${userLanguage}`);
        const translated = await translateText(children, context);
        console.log(`🌍 Translation result: "${translated}"`);
        setTranslatedText(translated);
      }
    };

    // Only translate if user language is not English
    if (userLanguage && userLanguage !== 'en') {
      translateContent();
    } else {
      setTranslatedText(children);
    }
  }, [children, context, userLanguage, translateText]);

  // Return the translated text or fallback
  return translatedText || fallback || children;
};

export default TranslatedText;