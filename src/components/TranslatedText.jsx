import React, { useState, useEffect } from 'react';
import { useTranslation } from '../hooks/useTranslation';

const TranslatedText = ({ 
  children, 
  context = 'General B2B eCommerce interface',
  fallback = null 
}) => {
  const { translateText, userLanguage } = useTranslation();
  const [translatedText, setTranslatedText] = useState(children);

  useEffect(() => {
    const translateContent = async () => {
      if (typeof children === 'string' && children.trim()) {
        const translated = await translateText(children, context);
        setTranslatedText(translated);
      }
    };

    // Only translate if user language is not English
    if (userLanguage !== 'en') {
      translateContent();
    } else {
      setTranslatedText(children);
    }
  }, [children, context, userLanguage, translateText]);

  // Return the translated text or fallback
  return translatedText || fallback || children;
};

export default TranslatedText;