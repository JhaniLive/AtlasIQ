import { useRef, useEffect, useState, useCallback } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import './LocalPlacesMap.css';

function StarRating({ rating }) {
  const stars = [];
  const full = Math.floor(rating);
  const half = rating - full >= 0.25 && rating - full < 0.75;
  const fullAfterHalf = rating - full >= 0.75;

  const totalFull = fullAfterHalf ? full + 1 : full;
  for (let i = 0; i < totalFull; i++) stars.push(<span key={`f${i}`} className="star star--full">{'\u2605'}</span>);
  if (half) stars.push(<span key="h" className="star star--half">{'\u2605'}</span>);
  const empty = 5 - totalFull - (half ? 1 : 0);
  for (let i = 0; i < empty; i++) stars.push(<span key={`e${i}`} className="star star--empty">{'\u2606'}</span>);
  return <span className="star-rating">{stars}</span>;
}

function PriceLevel({ level }) {
  if (!level) return null;
  return <span className="price-level">{'$'.repeat(level)}</span>;
}

function PlaceCard({ place, selected, onSelect }) {
  return (
    <div
      className={`place-card ${selected ? 'place-card--selected' : ''}`}
      onClick={() => onSelect(place)}
    >
      {place.photo_url && (
        <div className="place-card__thumb">
          <img src={place.photo_url} alt={place.name} loading="lazy" />
        </div>
      )}
      <div className="place-card__info">
        <h4 className="place-card__name">{place.name}</h4>
        <div className="place-card__rating-row">
          <span className="place-card__rating-num">{place.rating ? place.rating.toFixed(1) : '--'}</span>
          {place.rating > 0 && <StarRating rating={place.rating} />}
          {place.review_count > 0 && (
            <span className="place-card__reviews">({place.review_count.toLocaleString()})</span>
          )}
        </div>
        <p className="place-card__address">{place.address}</p>
        <div className="place-card__tags">
          {place.is_open === true && <span className="place-card__tag place-card__tag--open">Open</span>}
          {place.is_open === false && <span className="place-card__tag place-card__tag--closed">Closed</span>}
          <PriceLevel level={place.price_level} />
          {place.types?.map((t) => (
            <span key={t} className="place-card__tag">{t}</span>
          ))}
        </div>
      </div>
    </div>
  );
}

function PlaceDetail({ place, onClose }) {
  if (!place) return null;
  return (
    <div className="place-detail">
      <button className="place-detail__close" onClick={onClose}>&times;</button>
      {place.photo_url && (
        <div className="place-detail__photo">
          <img src={place.photo_url} alt={place.name} />
        </div>
      )}
      <div className="place-detail__body">
        <h3 className="place-detail__name">{place.name}</h3>
        <div className="place-detail__rating-row">
          <span className="place-detail__rating-num">{place.rating ? place.rating.toFixed(1) : '--'}</span>
          {place.rating > 0 && <StarRating rating={place.rating} />}
          {place.review_count > 0 && (
            <span className="place-detail__reviews">({place.review_count.toLocaleString()} reviews)</span>
          )}
        </div>
        <div className="place-detail__meta">
          {place.is_open === true && <span className="place-detail__tag place-detail__tag--open">Open Now</span>}
          {place.is_open === false && <span className="place-detail__tag place-detail__tag--closed">Closed</span>}
          <PriceLevel level={place.price_level} />
          {place.types?.map((t) => (
            <span key={t} className="place-detail__tag">{t}</span>
          ))}
        </div>
        <p className="place-detail__address">{place.address}</p>
        {place.maps_url && (
          <a
            className="place-detail__maps-link"
            href={place.maps_url}
            target="_blank"
            rel="noopener noreferrer"
          >
            Open in Google Maps &rarr;
          </a>
        )}
      </div>
    </div>
  );
}

export default function LocalPlacesMap({ places, query, center, onClose }) {
  const mapContainerRef = useRef(null);
  const mapRef = useRef(null);
  const markersRef = useRef([]);
  const [selectedPlace, setSelectedPlace] = useState(null);
  const [mapLoaded, setMapLoaded] = useState(false);

  const handleSelectPlace = useCallback((place) => {
    setSelectedPlace((prev) => (prev?.id === place.id ? null : place));
    if (mapRef.current && place.lat && place.lng) {
      mapRef.current.flyTo([place.lat, place.lng], 15, { duration: 0.8 });
    }
  }, []);

  // Initialize Leaflet map
  useEffect(() => {
    if (!mapContainerRef.current) return;

    const map = L.map(mapContainerRef.current, {
      center: [center.lat, center.lng],
      zoom: 13,
      zoomControl: true,
    });

    // OpenStreetMap dark tiles (free, no token)
    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/">CARTO</a>',
      maxZoom: 19,
    }).addTo(map);

    mapRef.current = map;
    setMapLoaded(true);

    // Center marker (blue pulsing dot)
    const userIcon = L.divIcon({
      className: 'lpm-user-marker',
      html: '<div class="lpm-user-dot"></div><div class="lpm-user-pulse"></div>',
      iconSize: [20, 20],
      iconAnchor: [10, 10],
    });
    L.marker([center.lat, center.lng], { icon: userIcon }).addTo(map);

    // Place pin markers
    const newMarkers = [];
    const bounds = L.latLngBounds([[center.lat, center.lng]]);

    places.forEach((place) => {
      if (!place.lat || !place.lng) return;

      const pinIcon = L.divIcon({
        className: 'lpm-pin-marker',
        html: `<span class="lpm-pin-rating">\u2605 ${place.rating ? place.rating.toFixed(1) : '--'}</span>`,
        iconSize: [60, 28],
        iconAnchor: [30, 28],
      });

      const marker = L.marker([place.lat, place.lng], { icon: pinIcon }).addTo(map);
      marker.on('click', (e) => {
        L.DomEvent.stopPropagation(e);
        setSelectedPlace((prev) => (prev?.id === place.id ? null : place));
      });
      newMarkers.push(marker);
      bounds.extend([place.lat, place.lng]);
    });

    markersRef.current = newMarkers;

    // Fit bounds to show all pins
    if (places.length > 0) {
      map.fitBounds(bounds, { padding: [60, 60], maxZoom: 15 });
    }

    // Click map background to deselect
    map.on('click', () => setSelectedPlace(null));

    return () => {
      markersRef.current.forEach((m) => m.remove());
      markersRef.current = [];
      map.remove();
      mapRef.current = null;
    };
  }, [center.lat, center.lng, places]);

  // Close on Escape
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="lpm-overlay">
      <div className="lpm-header">
        <h3 className="lpm-header__title">{query}</h3>
        <span className="lpm-header__count">{places.length} places found</span>
        <button className="lpm-header__close" onClick={onClose}>&times;</button>
      </div>

      <div className="lpm-content">
        <div className="lpm-sidebar">
          {places.map((place, i) => (
            <PlaceCard
              key={place.id || i}
              place={place}
              selected={selectedPlace?.id === place.id}
              onSelect={handleSelectPlace}
            />
          ))}
        </div>

        <div className="lpm-map-area">
          <div ref={mapContainerRef} className="lpm-map-container" />
          {!mapLoaded && (
            <div className="lpm-map-loading">Loading map...</div>
          )}
          {selectedPlace && (
            <PlaceDetail
              place={selectedPlace}
              onClose={() => setSelectedPlace(null)}
            />
          )}
        </div>
      </div>
    </div>
  );
}
