import React, { useState, useEffect } from 'react';
import { useTranslation } from '../hooks/useTranslation';

// Clear bad cached translations (where translation equals original)
const clearBadCache = () => {
  const keysToRemove = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && key.includes('__')) {
      const value = localStorage.getItem(key);
      const originalText = key.split('__')[0];
      if (value === originalText) {
        keysToRemove.push(key);
      }
    }
  }
  keysToRemove.forEach(key => localStorage.removeItem(key));
  if (keysToRemove.length > 0) {
    console.log(`🌍 Cleared ${keysToRemove.length} bad cached translations`);
  }
};

// Clear bad cache on first load
if (typeof window !== 'undefined') {
  clearBadCache();
}

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
      
      // Check cache first (but skip if cached translation equals original text)
      const cacheKey = `${children}__${userLanguage}`;
      const cached = localStorage.getItem(cacheKey);
      if (cached && cached !== children) {
        console.log(`🌍 Found valid cached translation for "${children}": "${cached}"`);
        setTranslatedText(cached);
        return;
      } else if (cached) {
        console.log(`🌍 Found bad cached translation for "${children}" (same as original), will retranslate`);
        localStorage.removeItem(cacheKey); // Clear bad cache
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