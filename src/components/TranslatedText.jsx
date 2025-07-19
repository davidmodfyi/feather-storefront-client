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
    // Only translate if user language is not English
    if (userLanguage && userLanguage !== 'en') {
      // Check cache first
      const cacheKey = `${children}__${userLanguage}`;
      const cached = localStorage.getItem(cacheKey);
      if (cached) {
        setTranslatedText(cached);
        return;
      }
      
      // Add delay to prevent API flooding
      const timeoutId = setTimeout(async () => {
        if (typeof children === 'string' && children.trim()) {
          try {
            const translated = await translateText(children, context);
            setTranslatedText(translated);
            // Cache the result
            localStorage.setItem(cacheKey, translated);
          } catch (error) {
            console.error('Translation failed for:', children, error);
            setTranslatedText(children); // Fallback to original
          }
        }
      }, Math.random() * 500); // Random delay 0-500ms to spread out API calls
      
      return () => clearTimeout(timeoutId);
    } else {
      setTranslatedText(children);
    }
  }, [children, userLanguage]); // Removed translateText from dependencies

  // Return the translated text or fallback
  return translatedText || fallback || children;
};

export default TranslatedText;