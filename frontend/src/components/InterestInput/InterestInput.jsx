import { useState, useRef, useEffect } from 'react';
import './InterestInput.css';

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5 MB

function compressImage(dataUrl, maxSize = 1024, quality = 0.7) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      let { width, height } = img;
      if (width > maxSize || height > maxSize) {
        if (width > height) {
          height = Math.round((height * maxSize) / width);
          width = maxSize;
        } else {
          width = Math.round((width * maxSize) / height);
          height = maxSize;
        }
      }
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, width, height);
      resolve(canvas.toDataURL('image/jpeg', quality));
    };
    img.onerror = () => resolve(dataUrl);
    img.src = dataUrl;
  });
}

function useIsMobile(breakpoint = 600) {
  const [isMobile, setIsMobile] = useState(
    () => typeof window !== 'undefined' && window.innerWidth <= breakpoint,
  );
  useEffect(() => {
    const mql = window.matchMedia(`(max-width: ${breakpoint}px)`);
    const handler = (e) => setIsMobile(e.matches);
    mql.addEventListener('change', handler);
    return () => mql.removeEventListener('change', handler);
  }, [breakpoint]);
  return isMobile;
}

export default function InterestInput({ onSubmit, onImageSubmit, loading, searchHistory, onClearHistory }) {
  const [text, setText] = useState('');
  const [imagePreview, setImagePreview] = useState(null);
  const [showHistory, setShowHistory] = useState(false);
  const fileInputRef = useRef(null);
  const isMobile = useIsMobile();

  const handleSubmit = (e) => {
    e.preventDefault();
    if (loading) return;
    if (imagePreview) {
      onImageSubmit?.(imagePreview);
      return;
    }
    if (text.trim()) {
      onSubmit(text.trim());
    }
  };

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      return;
    }
    if (file.size > MAX_FILE_SIZE) {
      alert('Image must be under 5 MB');
      return;
    }
    const reader = new FileReader();
    reader.onload = async () => {
      const compressed = await compressImage(reader.result);
      setImagePreview(compressed);
    };
    reader.readAsDataURL(file);
    // Reset so the same file can be re-selected
    e.target.value = '';
  };

  const clearImage = () => {
    setImagePreview(null);
  };

  const canSubmit = imagePreview || text.trim();

  return (
    <form className="interest-input" onSubmit={handleSubmit}>
      {imagePreview && (
        <div className="interest-input__preview">
          <img src={imagePreview} alt="Upload preview" />
          <button
            type="button"
            className="interest-input__preview-clear"
            onClick={clearImage}
            aria-label="Remove image"
          >
            &times;
          </button>
        </div>
      )}
      {showHistory && searchHistory?.length > 0 && !imagePreview && (
        <div className="interest-input__history">
          <div className="interest-input__history-header">
            <span>Recent searches</span>
            <button type="button" onClick={onClearHistory} className="interest-input__history-clear">Clear</button>
          </div>
          {searchHistory.map((term, i) => (
            <button
              key={i}
              type="button"
              className="interest-input__history-item"
              onClick={() => { setText(term); setShowHistory(false); }}
            >
              {term}
            </button>
          ))}
        </div>
      )}
      <div className="interest-input__row">
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          style={{ display: 'none' }}
          onChange={handleFileChange}
        />
        <button
          type="button"
          className="interest-input__camera-btn"
          onClick={() => fileInputRef.current?.click()}
          disabled={loading}
          aria-label="Upload a place photo"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
            <circle cx="12" cy="13" r="4" />
          </svg>
        </button>
        <textarea
          className="interest-input__textarea"
          placeholder={isMobile
            ? 'Describe a trip or upload a photo...'
            : 'Describe your ideal trip... (e.g., safe beaches with great food and nightlife)'}
          value={text}
          onChange={(e) => { setText(e.target.value); if (e.target.value.trim()) setShowHistory(false); }}
          onFocus={() => !text.trim() && setShowHistory(true)}
          onBlur={() => setTimeout(() => setShowHistory(false), 200)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              handleSubmit(e);
            }
          }}
          rows={isMobile ? 2 : 3}
          disabled={loading}
        />
        <button
          className="interest-input__button"
          type="submit"
          disabled={!canSubmit || loading}
        >
          {loading ? (isMobile ? '...' : 'Exploring...') : 'Explore'}
        </button>
      </div>
    </form>
  );
}
