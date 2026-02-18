import { useState, useRef, useEffect, useCallback } from 'react';
import './InterestInput.css';

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5 MB

const SpeechRecognition = typeof window !== 'undefined'
  ? (window.SpeechRecognition || window.webkitSpeechRecognition)
  : null;

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

export default function InterestInput({ onSubmit, onImageSubmit, loading, searchHistory, onClearHistory }) {
  const [text, setText] = useState('');
  const [imagePreview, setImagePreview] = useState(null);
  const [showHistory, setShowHistory] = useState(false);
  const [showAttach, setShowAttach] = useState(false);
  const [showCamera, setShowCamera] = useState(false);
  const [listening, setListening] = useState(false);
  const [focused, setFocused] = useState(false);
  const fileInputRef = useRef(null);
  const recognitionRef = useRef(null);
  const textareaRef = useRef(null);
  const attachRef = useRef(null);
  const videoRef = useRef(null);
  const streamRef = useRef(null);

  // Close attach menu on outside click
  useEffect(() => {
    if (!showAttach) return;
    const handler = (e) => {
      if (attachRef.current && !attachRef.current.contains(e.target)) {
        setShowAttach(false);
      }
    };
    document.addEventListener('mousedown', handler);
    document.addEventListener('touchstart', handler);
    return () => {
      document.removeEventListener('mousedown', handler);
      document.removeEventListener('touchstart', handler);
    };
  }, [showAttach]);

  // Cleanup speech recognition on unmount
  useEffect(() => {
    return () => {
      if (recognitionRef.current) recognitionRef.current.abort();
      stopCameraStream();
    };
  }, []);

  // Start webcam when camera modal opens
  useEffect(() => {
    if (!showCamera) return;
    let cancelled = false;
    navigator.mediaDevices.getUserMedia({
      video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } },
      audio: false,
    }).then((stream) => {
      if (cancelled) { stream.getTracks().forEach(t => t.stop()); return; }
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    }).catch((err) => {
      console.warn('Camera access denied:', err);
      setShowCamera(false);
      alert('Could not access camera. Please check permissions.');
    });
    return () => { cancelled = true; stopCameraStream(); };
  }, [showCamera]);

  const stopCameraStream = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
  };

  const capturePhoto = useCallback(async () => {
    if (!videoRef.current) return;
    const video = videoRef.current;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(video, 0, 0);
    const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
    const compressed = await compressImage(dataUrl);
    setImagePreview(compressed);
    setShowCamera(false);
    stopCameraStream();
  }, []);

  // Auto-grow textarea as user types
  const autoResize = useCallback((el) => {
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, 120) + 'px';
  }, []);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (loading) return;
    if (imagePreview) {
      onImageSubmit?.(imagePreview, text.trim());
      setImagePreview(null);
      setText('');
      return;
    }
    if (text.trim()) {
      onSubmit(text.trim());
      setText('');
    }
  };

  const processFile = useCallback(async (file) => {
    if (!file) return;
    if (!file.type.startsWith('image/')) return;
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
  }, []);

  const handleFileChange = (e) => {
    processFile(e.target.files?.[0]);
    e.target.value = '';
    setShowAttach(false);
  };

  const openCamera = () => {
    setShowAttach(false);
    setShowCamera(true);
  };

  // Voice input
  const toggleVoice = useCallback(() => {
    if (!SpeechRecognition) return;
    if (listening && recognitionRef.current) {
      recognitionRef.current.stop();
      setListening(false);
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = 'en-US';
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;
    recognition.continuous = false;

    let finalTranscript = '';
    recognition.onresult = (event) => {
      let interim = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const t = event.results[i][0].transcript;
        if (event.results[i].isFinal) finalTranscript += t;
        else interim = t;
      }
      setText(finalTranscript || interim);
    };
    recognition.onend = () => { setListening(false); recognitionRef.current = null; };
    recognition.onerror = (e) => {
      if (e.error !== 'aborted') console.warn('Speech error:', e.error);
      setListening(false);
      recognitionRef.current = null;
    };

    recognitionRef.current = recognition;
    recognition.start();
    setListening(true);
  }, [listening]);

  const canSubmit = imagePreview || text.trim();

  return (
    <>
      {/* Camera viewfinder modal */}
      {showCamera && (
        <div className="camera-modal">
          <div className="camera-modal__content">
            <video ref={videoRef} className="camera-modal__video" autoPlay playsInline muted />
            <div className="camera-modal__controls">
              <button type="button" className="camera-modal__close" onClick={() => { setShowCamera(false); stopCameraStream(); }}>
                Cancel
              </button>
              <button type="button" className="camera-modal__capture" onClick={capturePhoto} aria-label="Capture photo">
                <span className="camera-modal__shutter" />
              </button>
              <div className="camera-modal__spacer" />
            </div>
          </div>
        </div>
      )}

      <div className="search-bar">
        {/* Image preview above the bar */}
        {imagePreview && (
          <div className="search-bar__preview">
            <img src={imagePreview} alt="Upload preview" />
            <button type="button" className="search-bar__preview-clear" onClick={() => setImagePreview(null)} aria-label="Remove image">&times;</button>
          </div>
        )}

        {/* Main bar */}
        <form className={`search-bar__form ${focused ? 'search-bar__form--focused' : ''}`} onSubmit={handleSubmit}>
          {/* Hidden file input for gallery */}
          <input ref={fileInputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleFileChange} />

          {/* Plus / attach button */}
          <div className="search-bar__attach" ref={attachRef}>
            <button
              type="button"
              className={`search-bar__icon-btn search-bar__plus ${showAttach ? 'search-bar__plus--open' : ''}`}
              onClick={() => setShowAttach((p) => !p)}
              disabled={loading}
              aria-label="Attach image"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <line x1="12" y1="5" x2="12" y2="19" />
                <line x1="5" y1="12" x2="19" y2="12" />
              </svg>
            </button>

            {showAttach && (
              <div className="search-bar__attach-menu">
                <button type="button" onClick={openCamera}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
                    <circle cx="12" cy="13" r="4" />
                  </svg>
                  Take Photo
                </button>
                <button type="button" onClick={() => { fileInputRef.current?.click(); }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                    <circle cx="8.5" cy="8.5" r="1.5" />
                    <polyline points="21 15 16 10 5 21" />
                  </svg>
                  Upload Image
                </button>
              </div>
            )}
          </div>

          {/* Text input */}
          <textarea
            ref={textareaRef}
            className="search-bar__input"
            placeholder="Search any place, landmark, or describe a trip..."
            value={text}
            onChange={(e) => {
              setText(e.target.value);
              autoResize(e.target);
              if (e.target.value.trim()) setShowHistory(false);
            }}
            onFocus={() => { setFocused(true); if (!text.trim()) setShowHistory(true); }}
            onBlur={() => { setFocused(false); setTimeout(() => setShowHistory(false), 200); }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSubmit(e);
                if (textareaRef.current) textareaRef.current.style.height = 'auto';
              }
            }}
            rows={1}
            disabled={loading}
          />

          {/* Right-side action buttons */}
          <div className="search-bar__actions">
            {SpeechRecognition && (
              <button
                type="button"
                className={`search-bar__icon-btn search-bar__mic ${listening ? 'search-bar__mic--active' : ''}`}
                onClick={toggleVoice}
                disabled={loading}
                aria-label={listening ? 'Stop voice input' : 'Voice search'}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
                  <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                  <line x1="12" y1="19" x2="12" y2="23" />
                  <line x1="8" y1="23" x2="16" y2="23" />
                </svg>
              </button>
            )}

            <button
              type="submit"
              className={`search-bar__icon-btn search-bar__send ${canSubmit && !loading ? 'search-bar__send--active' : ''}`}
              disabled={!canSubmit || loading}
              aria-label="Send"
            >
              {loading ? (
                <div className="search-bar__spinner" />
              ) : (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="12" y1="19" x2="12" y2="5" />
                  <polyline points="5 12 12 5 19 12" />
                </svg>
              )}
            </button>
          </div>
        </form>

        {/* Search history dropdown (below bar) */}
        {showHistory && searchHistory?.length > 0 && !imagePreview && (
          <div className="search-bar__history">
            <div className="search-bar__history-head">
              <span>Recent</span>
              <button type="button" onClick={onClearHistory}>Clear</button>
            </div>
            {searchHistory.map((term, i) => (
              <button key={i} type="button" className="search-bar__history-item" onMouseDown={(e) => { e.preventDefault(); onSubmit(term); setShowHistory(false); setText(''); }}>
                {term}
              </button>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
