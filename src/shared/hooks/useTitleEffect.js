// Add this hook to your src folder
// src/useTitleEffect.js

import { useEffect } from 'react';

/**
 * Custom hook to update document title
 * @param {string} title - The title to set
 * @param {boolean} [appendSuffix=true] - Whether to append a suffix (e.g., "- Feather")
 */
export default function useTitleEffect(title, appendSuffix = true) {
  useEffect(() => {
    // Save the original title to restore it on unmount
    const originalTitle = document.title;
    
    // Set the new title
    if (appendSuffix) {
      document.title = `${title} - Feather`;
    } else {
      document.title = title;
    }
    
    // Cleanup function to restore the original title when component unmounts
    return () => {
      document.title = originalTitle;
    };
  }, [title, appendSuffix]);
}