import { useState, useEffect, useRef, useCallback } from 'react';
import './WelcomeScreen.css';

const TAGLINES = [
  'Explore the world with AI',
  'Upload a photo — find the place instantly',
  'Chat about any country on Earth',
  'Discover hidden gems in 190+ countries',
  'Your AI-powered travel companion',
];

const TYPE_SPEED = 55;
const ERASE_SPEED = 30;
const PAUSE_AFTER_TYPE = 1800;
const PAUSE_AFTER_ERASE = 400;

export default function WelcomeScreen({ onStart }) {
  const [displayText, setDisplayText] = useState('');
  const [taglineIndex, setTaglineIndex] = useState(0);
  const [isTyping, setIsTyping] = useState(true);
  const [fading, setFading] = useState(false);
  const [showCTA, setShowCTA] = useState(false);
  const timerRef = useRef(null);
  const cycleCountRef = useRef(0);

  // Show the CTA button after the first full tagline types out
  useEffect(() => {
    if (!isTyping && displayText.length === 0 && cycleCountRef.current >= 1) {
      // already shown
    }
  }, [isTyping, displayText]);

  const tick = useCallback(() => {
    setDisplayText((prev) => {
      const full = TAGLINES[taglineIndex];

      if (isTyping) {
        if (prev.length < full.length) {
          return full.slice(0, prev.length + 1);
        }
        // Finished typing — show CTA after first cycle, pause, then erase
        if (cycleCountRef.current === 0) setShowCTA(true);
        cycleCountRef.current++;
        timerRef.current = setTimeout(() => setIsTyping(false), PAUSE_AFTER_TYPE);
        return prev;
      } else {
        if (prev.length > 0) {
          return prev.slice(0, -1);
        }
        // Finished erasing — move to next tagline
        timerRef.current = setTimeout(() => {
          setTaglineIndex((i) => (i + 1) % TAGLINES.length);
          setIsTyping(true);
        }, PAUSE_AFTER_ERASE);
        return prev;
      }
    });
  }, [taglineIndex, isTyping]);

  useEffect(() => {
    const speed = isTyping ? TYPE_SPEED : ERASE_SPEED;
    timerRef.current = setTimeout(tick, speed);
    return () => clearTimeout(timerRef.current);
  }, [tick, displayText, isTyping]);

  const handleStart = () => {
    setFading(true);
    setTimeout(() => onStart(), 600);
  };

  return (
    <div className={`welcome ${fading ? 'welcome--fading' : ''}`}>
      <div className="welcome__content">
        <h1 className="welcome__title">
          Atlas<span className="welcome__title-accent">IQ</span>
        </h1>
        <p className="welcome__subtitle">AI-Powered World Explorer</p>

        <div className="welcome__tagline-box">
          <span className="welcome__tagline-text">{displayText}</span>
          <span className="welcome__cursor">|</span>
        </div>

        <button
          className={`welcome__cta ${showCTA ? 'welcome__cta--visible' : ''}`}
          onClick={handleStart}
          tabIndex={showCTA ? 0 : -1}
        >
          Start Exploring
        </button>

        <div className="welcome__features">
          <div className="welcome__feature">
            <span className="welcome__feature-icon">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
            </span>
            <span>Search any place</span>
          </div>
          <div className="welcome__feature">
            <span className="welcome__feature-icon">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>
            </span>
            <span>Photo detection</span>
          </div>
          <div className="welcome__feature">
            <span className="welcome__feature-icon">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
            </span>
            <span>AI travel chat</span>
          </div>
          <div className="welcome__feature">
            <span className="welcome__feature-icon">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>
            </span>
            <span>Interactive 3D globe</span>
          </div>
        </div>
      </div>
    </div>
  );
}
