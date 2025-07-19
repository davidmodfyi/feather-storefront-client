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
    console.log(`🌍 TranslatedText: "${children}" - userLanguage: ${userLanguage}`);
    
    // Only translate if user language is not English
    if (userLanguage && userLanguage !== 'en') {
      console.log(`🌍 Will translate "${children}" to ${userLanguage}`);
      
      // Check cache first
      const cacheKey = `${children}__${userLanguage}`;
      const cached = localStorage.getItem(cacheKey);
      if (cached) {
        console.log(`🌍 Found cached translation for "${children}": "${cached}"`);
        setTranslatedText(cached);
        return;
      }
      
      console.log(`🌍 No cache found for "${children}", will translate in 500ms...`);
      
      // Add delay to prevent API flooding
      const timeoutId = setTimeout(async () => {
        if (typeof children === 'string' && children.trim()) {
          try {
            console.log(`🌍 Starting translation for: "${children}"`);
            const translated = await translateText(children, context);
            console.log(`🌍 Translation complete: "${children}" -> "${translated}"`);
            setTranslatedText(translated);
            // Cache the result
            localStorage.setItem(cacheKey, translated);
          } catch (error) {
            console.error('🌍 Translation failed for:', children, error);
            setTranslatedText(children); // Fallback to original
          }
        }
      }, 500); // Fixed delay instead of random
      
      return () => clearTimeout(timeoutId);
    } else {
      console.log(`🌍 No translation needed for "${children}" (language: ${userLanguage})`);
      setTranslatedText(children);
    }
  }, [children, userLanguage]);

  // Return the translated text or fallback
  return translatedText || fallback || children;
};

export default TranslatedText;