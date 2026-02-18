import { useState, useRef, useEffect, useCallback } from 'react';
import './PlacesPanel.css';

export default function PlacesPanel({ places, onClose, onPlaceSelect, selectedPlace }) {
  const [expandedIdx, setExpandedIdx] = useState(null);
  const expandedRef = useRef(null);

  // Auto-scroll to expanded card
  useEffect(() => {
    if (expandedIdx !== null && expandedRef.current) {
      expandedRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }, [expandedIdx]);

  // When a pin is clicked on the globe, expand its card
  useEffect(() => {
    if (!selectedPlace) return;
    const idx = places.findIndex(
      (p) => p.name === selectedPlace.name && p.lat === selectedPlace.lat,
    );
    if (idx >= 0) setExpandedIdx(idx);
  }, [selectedPlace, places]);

  const handleClick = useCallback(
    (place, idx) => {
      const isExpanding = expandedIdx !== idx;
      setExpandedIdx(isExpanding ? idx : null);
      if (isExpanding && onPlaceSelect) onPlaceSelect(place);
    },
    [expandedIdx, onPlaceSelect],
  );

  if (!places || places.length === 0) return null;

  return (
    <div className="places-panel">
      <div className="places-panel__header">
        <div className="places-panel__header-info">
          <span className="places-panel__count">{places.length}</span>
          <span className="places-panel__header-text">Places Found</span>
        </div>
        <button className="places-panel__close" onClick={onClose} title="Close">
          &times;
        </button>
      </div>

      <div className="places-panel__list">
        {places.map((place, i) => {
          const isExpanded = expandedIdx === i;
          const isSelected =
            selectedPlace?.name === place.name && selectedPlace?.lat === place.lat;
          const dirUrl =
            place.maps_url ||
            (place.lat && place.lng
              ? `https://www.google.com/maps/dir/?api=1&destination=${place.lat},${place.lng}`
              : null);
          return (
            <div
              key={place.name + i}
              ref={isExpanded ? expandedRef : null}
              className={`places-panel__item${isExpanded ? ' places-panel__item--expanded' : ''}${isSelected ? ' places-panel__item--selected' : ''}`}
              onClick={() => handleClick(place, i)}
            >
              {/* Compact row */}
              <div className="places-panel__row">
                <span className="places-panel__num">{i + 1}</span>
                <div className="places-panel__row-info">
                  <span className="places-panel__place-name">{place.name}</span>
                  <div className="places-panel__row-meta">
                    <span className="places-panel__rating">
                      {'\u2605'} {place.rating ? place.rating.toFixed(1) : '--'}
                    </span>
                    {place.is_open === true && (
                      <span className="places-panel__open-badge">Open</span>
                    )}
                    {place.is_open === false && (
                      <span className="places-panel__closed-badge">Closed</span>
                    )}
                  </div>
                </div>
                <span
                  className={`places-panel__chevron${isExpanded ? ' places-panel__chevron--open' : ''}`}
                >
                  {'\u25B8'}
                </span>
              </div>

              {/* Expanded detail */}
              {isExpanded && (
                <div className="places-panel__detail">
                  {place.photo_url && (
                    <div className="places-panel__photo">
                      <img src={place.photo_url} alt={place.name} loading="lazy" />
                    </div>
                  )}
                  {place.address && (
                    <p className="places-panel__address">{place.address}</p>
                  )}
                  <div className="places-panel__tags">
                    {place.price_level > 0 && (
                      <span className="places-panel__price">
                        {'$'.repeat(place.price_level)}
                      </span>
                    )}
                    {place.types?.map((t) => (
                      <span key={t} className="places-panel__tag">
                        {t}
                      </span>
                    ))}
                  </div>
                  {place.review_count > 0 && (
                    <span className="places-panel__reviews">
                      {place.review_count.toLocaleString()} reviews
                    </span>
                  )}
                  {dirUrl && (
                    <a
                      className="places-panel__directions"
                      href={dirUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={(e) => e.stopPropagation()}
                    >
                      Get Directions &rarr;
                    </a>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
