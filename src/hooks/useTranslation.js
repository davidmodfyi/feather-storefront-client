import { useState, useEffect, useCallback } from 'react';

// Simple language detection function
const detectLanguage = (text) => {
  if (!text || typeof text !== 'string') return 'en';
  
  // Simple heuristics for language detection
  const lowerText = text.toLowerCase();
  
  // Spanish indicators
  if (lowerText.includes('ñ') || lowerText.includes('está') || lowerText.includes('con') || 
      lowerText.includes('por') || lowerText.includes('para') || lowerText.includes('producto')) {
    return 'es';
  }
  
  // French indicators  
  if (lowerText.includes('é') || lowerText.includes('è') || lowerText.includes('ç') ||
      lowerText.includes('avec') || lowerText.includes('pour') || lowerText.includes('produit')) {
    return 'fr';
  }
  
  // Chinese indicators (simplified heuristics)
  if (/[\u4e00-\u9fff]/.test(text)) {
    return 'zh';
  }
  
  // Korean indicators
  if (/[\uac00-\ud7af]/.test(text)) {
    return 'ko';
  }
  
  // Portuguese indicators
  if (lowerText.includes('ão') || lowerText.includes('ção') || lowerText.includes('ã') ||
      lowerText.includes('com') || lowerText.includes('para') || lowerText.includes('produto')) {
    return 'pt';
  }
  
  // Default to English
  return 'en';
};

// Check if text should be skipped from translation
const shouldSkipTranslation = (text) => {
  if (!text || typeof text !== 'string') return true;
  
  // Skip very short text
  if (text.length < 2) return true;
  
  // Skip if it's mostly numbers or special characters
  if (/^[\d\s\$\€\£\¥\₽\-\+\.\,\(\)]+$/.test(text)) return true;
  
  // Skip common SKU patterns
  if (/^[A-Z0-9\-_]+$/i.test(text) && text.length < 20) return true;
  
  // Skip URLs and emails
  if (text.includes('@') || text.startsWith('http') || text.startsWith('www.')) return true;
  
  return false;
};

export const useTranslation = () => {
  const [userLanguage, setUserLanguage] = useState('en');
  const [translationCache, setTranslationCache] = useState({});
  const [isLoading, setIsLoading] = useState(false);

  // Fetch user's preferred language
  useEffect(() => {
    const fetchUserLanguage = async () => {
      try {
        console.log('🌍 useTranslation: Fetching user language...');
        const response = await fetch('/api/user/language', {
          credentials: 'include'
        });
        if (response.ok) {
          const data = await response.json();
          console.log('🌍 useTranslation: User language received:', data.language || 'en');
          setUserLanguage(data.language || 'en');
        } else {
          console.log('🌍 useTranslation: API not available, defaulting to en');
          setUserLanguage('en');
        }
      } catch (error) {
        console.error('🌍 useTranslation: Error fetching user language:', error);
        setUserLanguage('en');
      }
    };

    fetchUserLanguage();
    
    // Also listen for language changes
    const handleLanguageChange = () => {
      console.log('🌍 useTranslation: Language change detected, refetching...');
      fetchUserLanguage();
    };
    
    window.addEventListener('languageChanged', handleLanguageChange);
    return () => window.removeEventListener('languageChanged', handleLanguageChange);
  }, []);

  // Main translation function
  const translateTexts = async (texts, context = 'General B2B eCommerce interface') => {
    if (!texts || !Array.isArray(texts) || texts.length === 0) {
      return texts;
    }

    // If user language is English, no translation needed
    if (userLanguage === 'en') {
      return texts;
    }

    setIsLoading(true);

    try {
      // Filter texts that need translation
      const textsToTranslate = [];
      const textMapping = {};
      const results = [...texts];

      texts.forEach((text, index) => {
        // Skip translation if not needed
        if (shouldSkipTranslation(text)) {
          return;
        }

        // Detect source language
        const detectedLanguage = detectLanguage(text);
        
        // Skip if already in target language
        if (detectedLanguage === userLanguage) {
          return;
        }

        // Check cache first
        const cacheKey = `${text}__${userLanguage}`;
        if (translationCache[cacheKey]) {
          results[index] = translationCache[cacheKey];
          return;
        }

        // Add to translation queue
        textsToTranslate.push(text);
        textMapping[text] = index;
      });

      // If no texts need translation, return original
      if (textsToTranslate.length === 0) {
        setIsLoading(false);
        return results;
      }

      // Call translation API
      console.log('🌍 Making translation API call:', {
        textsCount: textsToTranslate.length,
        targetLanguage: userLanguage,
        context,
        texts: textsToTranslate
      });
      
      const response = await fetch('/api/translate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        credentials: 'include',
        body: JSON.stringify({
          texts: textsToTranslate,
          targetLanguage: userLanguage,
          context
        })
      });

      if (response.ok) {
        const data = await response.json();
        const translations = data.translations || [];

        // Update results with translations
        textsToTranslate.forEach((originalText, i) => {
          const translation = translations[i] || originalText;
          const originalIndex = textMapping[originalText];
          results[originalIndex] = translation;

          // Update cache
          const cacheKey = `${originalText}__${userLanguage}`;
          setTranslationCache(prev => ({
            ...prev,
            [cacheKey]: translation
          }));
        });
      }

      setIsLoading(false);
      return results;

    } catch (error) {
      console.error('Translation error:', error);
      setIsLoading(false);
      return texts; // Return original texts on error
    }
  };

  // Translate a single text
  const translateText = useCallback(async (text, context) => {
    if (!text) return text;
    const result = await translateTexts([text], context);
    return result[0] || text;
  }, [userLanguage]);

  return {
    userLanguage,
    translateTexts,
    translateText,
    isLoading
  };
};