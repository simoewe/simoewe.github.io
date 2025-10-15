import React, { useState, useRef, useEffect } from 'react';
import '../Input.css';

const KeywordInput = ({ value, onChange }) => {
  const [keywords, setKeywords] = useState([]);
  const [inputValue, setInputValue] = useState('');
  const [suggestions] = useState([
    'artificial intelligence', 'machine learning', 'deep learning', 'neural networks',
    'data science', 'blockchain', 'cloud computing', 'cybersecurity',
    'internet of things', 'big data', 'automation', 'robotics',
    'virtual reality', 'augmented reality', 'quantum computing', 'edge computing'
  ]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [filteredSuggestions, setFilteredSuggestions] = useState([]);
  const inputRef = useRef(null);
  const lastValueRef = useRef('');

  // Initialize keywords from parent value
  useEffect(() => {
    if (typeof value !== 'string') {
      if (!value && keywords.length) {
        lastValueRef.current = '';
        setKeywords([]);
      }
      return;
    }

    if (value === lastValueRef.current) {
      return;
    }

    const keywordArray = value.split(',').map(k => k.trim()).filter(k => k);
    lastValueRef.current = value;
    setKeywords(keywordArray);
  }, [value, keywords.length]);

  // Update parent when keywords change
  useEffect(() => {
    const keywordString = keywords.join(', ');
    lastValueRef.current = keywordString;
    onChange({ target: { value: keywordString } });
  }, [keywords, onChange]);

  // Filter suggestions based on input
  useEffect(() => {
    if (inputValue.trim()) {
      const filtered = suggestions.filter(suggestion =>
        suggestion.toLowerCase().includes(inputValue.toLowerCase()) &&
        !keywords.includes(suggestion)
      );
      setFilteredSuggestions(filtered);
      setShowSuggestions(filtered.length > 0);
    } else {
      setShowSuggestions(false);
    }
  }, [inputValue, keywords, suggestions]);

  const handleInputChange = (e) => {
    setInputValue(e.target.value);
  };

  const handleInputKeyDown = (e) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      addKeyword();
    } else if (e.key === 'Backspace' && !inputValue && keywords.length > 0) {
      removeKeyword(keywords.length - 1);
    }
  };

  const addKeyword = (keyword = inputValue.trim()) => {
    if (keyword && !keywords.includes(keyword)) {
      setKeywords([...keywords, keyword]);
      setInputValue('');
      setShowSuggestions(false);
    }
  };

  const removeKeyword = (index) => {
    const newKeywords = keywords.filter((_, i) => i !== index);
    setKeywords(newKeywords);
  };

  const selectSuggestion = (suggestion) => {
    addKeyword(suggestion);
    inputRef.current?.focus();
  };

  const clearAll = () => {
    setKeywords([]);
    setInputValue('');
    inputRef.current?.focus();
  };

  return (
    <div className="keyword-input-container">
      <div className="input-header">
        <label htmlFor="keyword-input">Keywords</label>
        {keywords.length > 0 && (
          <button
            type="button"
            onClick={clearAll}
            className="clear-all-btn"
            title="Clear all keywords"
          >
            Clear All
          </button>
        )}
      </div>
      
      <div className="keyword-input-wrapper">
        <div className="keyword-tags">
          {keywords.map((keyword, index) => (
            <div key={index} className="keyword-tag">
              <span className="keyword-text">{keyword}</span>
              <button
                type="button"
                onClick={() => removeKeyword(index)}
                className="remove-keyword"
                title={`Remove "${keyword}"`}
                aria-label={`Remove keyword ${keyword}`}
              >
                ×
              </button>
            </div>
          ))}
          
          <input
            ref={inputRef}
            id="keyword-input"
            type="text"
            value={inputValue}
            onChange={handleInputChange}
            onKeyDown={handleInputKeyDown}
            onFocus={() => inputValue && setShowSuggestions(filteredSuggestions.length > 0)}
            onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
            placeholder={
              keywords.length === 0
                ? "Optional: Enter keywords (press Enter or comma to add)"
                : "Add more..."
            }
            className="keyword-input-field"
            autoComplete="off"
          />
        </div>

        {showSuggestions && (
          <div className="suggestions-dropdown">
            {filteredSuggestions.slice(0, 6).map((suggestion, index) => (
              <button
                key={index}
                type="button"
                onClick={() => selectSuggestion(suggestion)}
                className="suggestion-item"
              >
                <span className="suggestion-icon">💡</span>
                {suggestion}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="input-footer">
        <div className="keyword-count">
          {keywords.length} keyword{keywords.length !== 1 ? 's' : ''} added
        </div>
        <div className="input-hint">
          Keywords are optional • Press Enter or comma to add • Click tags to remove
        </div>
      </div>
    </div>
  );
};

export default KeywordInput;
