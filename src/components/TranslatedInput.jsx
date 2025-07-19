import React, { useState, useEffect } from 'react';
import { useTranslation } from '../hooks/useTranslation';

const TranslatedInput = ({ 
  placeholder, 
  translationContext = 'General B2B eCommerce interface',
  ...props 
}) => {
  const { translateText, userLanguage } = useTranslation();
  const [translatedPlaceholder, setTranslatedPlaceholder] = useState(placeholder);

  useEffect(() => {
    const translatePlaceholder = async () => {
      if (placeholder && userLanguage !== 'en') {
        const translated = await translateText(placeholder, translationContext);
        setTranslatedPlaceholder(translated);
      } else {
        setTranslatedPlaceholder(placeholder);
      }
    };

    translatePlaceholder();
  }, [placeholder, userLanguage, translateText, translationContext]);

  return (
    <input
      {...props}
      placeholder={translatedPlaceholder}
    />
  );
};

export default TranslatedInput;