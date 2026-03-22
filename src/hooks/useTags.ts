import { useState, useEffect } from 'react';

const DEFAULT_TAGS = ['Personal', 'Home'];

export function useTags() {
  const [tags, setTags] = useState<string[]>(DEFAULT_TAGS);

  useEffect(() => {
    const stored = localStorage.getItem('app_tags');
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setTags(parsed);
        } else {
          setTags(DEFAULT_TAGS);
        }
      } catch (e) {
        setTags(DEFAULT_TAGS);
      }
    } else {
      localStorage.setItem('app_tags', JSON.stringify(DEFAULT_TAGS));
    }
  }, []);

  const addTag = (tag: string) => {
    const trimmed = tag.trim();
    if (!trimmed || tags.includes(trimmed)) return false;
    
    const newTags = [...tags, trimmed];
    setTags(newTags);
    localStorage.setItem('app_tags', JSON.stringify(newTags));
    return true;
  };

  const removeTag = (tag: string) => {
    if (tags.length <= 1) return false; // Keep at least one tag
    const newTags = tags.filter(t => t !== tag);
    setTags(newTags);
    localStorage.setItem('app_tags', JSON.stringify(newTags));
    return true;
  };

  const resetTags = () => {
    setTags(DEFAULT_TAGS);
    localStorage.setItem('app_tags', JSON.stringify(DEFAULT_TAGS));
  };

  return { tags, addTag, removeTag, resetTags };
}
