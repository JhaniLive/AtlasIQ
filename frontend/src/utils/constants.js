export const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

export const GLOBE_CONFIG = {
  // High-res 8K Earth texture
  globeImageUrl: '//unpkg.com/three-globe/example/img/earth-blue-marble.jpg',
  bumpImageUrl: '//unpkg.com/three-globe/example/img/earth-topology.png',
  backgroundImageUrl: '//unpkg.com/three-globe/example/img/night-sky.png',
  // Higher-res GeoJSON (50m instead of 110m)
  geoJsonUrl:
    'https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_50m_admin_0_countries.geojson',
  pointAltitude: 0.07,
  pointRadius: 0.5,
};

export const SCORE_COLORS = {
  high: '#00ff88',
  medium: '#ffaa00',
  low: '#ff4466',
};
