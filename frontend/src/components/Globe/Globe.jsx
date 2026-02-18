import { useRef, useState, useEffect, useCallback, useImperativeHandle, forwardRef } from 'react';
import * as Cesium from 'cesium';
import 'cesium/Build/Cesium/Widgets/widgets.css';
import './Globe.css';

Cesium.Ion.defaultAccessToken = undefined;

const GEO_JSON_URL =
  'https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_50m_admin_0_countries.geojson';

// ── Globe component ─────────────────────────────────────────────────

const Globe = forwardRef(function Globe(
  { countries, recommendations, onCountryHover, onCountryClick, onPlaceSelect },
  ref,
) {
  const containerRef = useRef(null);
  const viewerRef = useRef(null);
  const countryMapRef = useRef({});
  const geoEntitiesRef = useRef({});
  const photoEntitiesRef = useRef(new Map()); // tabId → [entities]
  const placePinEntitiesRef = useRef([]); // place pin entities
  const [rotating, setRotating] = useState(false);
  const rotatingRef = useRef(false);
  const onCountryClickRef = useRef(onCountryClick);
  const onCountryHoverRef = useRef(onCountryHover);
  const onPlaceSelectRef = useRef(onPlaceSelect);

  // Keep refs fresh
  useEffect(() => { onCountryClickRef.current = onCountryClick; }, [onCountryClick]);
  useEffect(() => { onCountryHoverRef.current = onCountryHover; }, [onCountryHover]);
  useEffect(() => { onPlaceSelectRef.current = onPlaceSelect; }, [onPlaceSelect]);

  // ── Helper: render a rating pill canvas for a place pin ──────────
  function renderPinCanvas(rating, selected) {
    const text = `\u2605 ${rating ? rating.toFixed(1) : '--'}`;
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    ctx.font = 'bold 22px sans-serif';
    const tw = ctx.measureText(text).width;
    const pw = Math.ceil(tw + 24);
    const ph = 36;
    canvas.width = pw;
    canvas.height = ph;

    // Pill background
    const r = ph / 2;
    ctx.fillStyle = selected ? 'rgba(255, 204, 0, 0.25)' : 'rgba(12, 12, 28, 0.92)';
    ctx.beginPath();
    ctx.moveTo(r, 0);
    ctx.lineTo(pw - r, 0);
    ctx.arc(pw - r, r, r, -Math.PI / 2, Math.PI / 2);
    ctx.lineTo(r, ph);
    ctx.arc(r, r, r, Math.PI / 2, -Math.PI / 2);
    ctx.fill();

    // Border
    ctx.strokeStyle = selected ? '#ffcc00' : 'rgba(255, 204, 0, 0.5)';
    ctx.lineWidth = selected ? 2.5 : 1.5;
    ctx.stroke();

    // Rating text
    ctx.fillStyle = selected ? '#ffffff' : '#ffcc00';
    ctx.font = 'bold 22px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, pw / 2, ph / 2);

    return canvas;
  }

  useImperativeHandle(ref, () => ({
    flyTo(lat, lng, altitude = 2500000) {
      const viewer = viewerRef.current;
      if (!viewer) return;
      viewer.camera.flyTo({
        destination: Cesium.Cartesian3.fromDegrees(lng, lat, altitude),
        duration: 2.0,
      });
    },

    // Show a photo billboard pinned on the globe, keyed by tabId
    showPhotoAt(lat, lng, imageUrl, label, tabId) {
      const viewer = viewerRef.current;
      if (!viewer || !imageUrl) return;

      const markerKey = tabId || '_default';

      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        const fw = 200, fh = 150, pad = 4, labelH = 24, radius = 8;
        const cw = fw + pad * 2;
        const ch = fh + pad * 2 + labelH;
        const canvas = document.createElement('canvas');
        canvas.width = cw;
        canvas.height = ch;
        const ctx = canvas.getContext('2d');

        ctx.fillStyle = 'rgba(12, 12, 28, 0.92)';
        ctx.beginPath();
        ctx.moveTo(radius, 0);
        ctx.lineTo(cw - radius, 0);
        ctx.quadraticCurveTo(cw, 0, cw, radius);
        ctx.lineTo(cw, ch - radius);
        ctx.quadraticCurveTo(cw, ch, cw - radius, ch);
        ctx.lineTo(radius, ch);
        ctx.quadraticCurveTo(0, ch, 0, ch - radius);
        ctx.lineTo(0, radius);
        ctx.quadraticCurveTo(0, 0, radius, 0);
        ctx.fill();

        ctx.strokeStyle = 'rgba(0, 204, 255, 0.5)';
        ctx.lineWidth = 1.5;
        ctx.stroke();

        ctx.save();
        const ir = 6;
        ctx.beginPath();
        ctx.moveTo(pad + ir, pad);
        ctx.lineTo(pad + fw - ir, pad);
        ctx.quadraticCurveTo(pad + fw, pad, pad + fw, pad + ir);
        ctx.lineTo(pad + fw, pad + fh - ir);
        ctx.quadraticCurveTo(pad + fw, pad + fh, pad + fw - ir, pad + fh);
        ctx.lineTo(pad + ir, pad + fh);
        ctx.quadraticCurveTo(pad, pad + fh, pad, pad + fh - ir);
        ctx.lineTo(pad, pad + ir);
        ctx.quadraticCurveTo(pad, pad, pad + ir, pad);
        ctx.clip();
        ctx.drawImage(img, pad, pad, fw, fh);
        ctx.restore();

        if (label) {
          ctx.fillStyle = '#ffffff';
          ctx.font = 'bold 13px sans-serif';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          const maxW = cw - 16;
          let text = label;
          if (ctx.measureText(text).width > maxW) {
            while (text.length > 0 && ctx.measureText(text + '...').width > maxW) {
              text = text.slice(0, -1);
            }
            text += '...';
          }
          ctx.fillText(text, cw / 2, pad + fh + labelH / 2 + 2);
        }

        const entity = viewer.entities.add({
          position: Cesium.Cartesian3.fromDegrees(lng, lat, 800),
          billboard: {
            image: canvas,
            width: cw,
            height: ch,
            verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
            heightReference: Cesium.HeightReference.RELATIVE_TO_GROUND,
            disableDepthTestDistance: Number.POSITIVE_INFINITY,
            scaleByDistance: new Cesium.NearFarScalar(500000, 1.0, 8000000, 0.3),
          },
          _isPhotoMarker: true,
        });
        if (!photoEntitiesRef.current.has(markerKey)) {
          photoEntitiesRef.current.set(markerKey, []);
        }
        photoEntitiesRef.current.get(markerKey).push(entity);
      };
      img.onerror = () => {
        const entity = viewer.entities.add({
          position: Cesium.Cartesian3.fromDegrees(lng, lat, 800),
          billboard: {
            image: imageUrl,
            width: 180,
            height: 135,
            verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
            heightReference: Cesium.HeightReference.RELATIVE_TO_GROUND,
            disableDepthTestDistance: Number.POSITIVE_INFINITY,
            scaleByDistance: new Cesium.NearFarScalar(500000, 1.0, 8000000, 0.3),
          },
          label: label ? {
            text: label,
            font: 'bold 14px sans-serif',
            verticalOrigin: Cesium.VerticalOrigin.TOP,
            pixelOffset: new Cesium.Cartesian2(0, 6),
            fillColor: Cesium.Color.WHITE,
            outlineColor: Cesium.Color.BLACK,
            outlineWidth: 2,
            style: Cesium.LabelStyle.FILL_AND_OUTLINE,
            disableDepthTestDistance: Number.POSITIVE_INFINITY,
          } : undefined,
          _isPhotoMarker: true,
        });
        if (!photoEntitiesRef.current.has(markerKey)) {
          photoEntitiesRef.current.set(markerKey, []);
        }
        photoEntitiesRef.current.get(markerKey).push(entity);
      };
      img.src = imageUrl;
    },

    removePhotoMarker(tabId) {
      const viewer = viewerRef.current;
      if (!viewer) return;
      const entities = photoEntitiesRef.current.get(tabId) || [];
      for (const entity of entities) {
        viewer.entities.remove(entity);
      }
      photoEntitiesRef.current.delete(tabId);
    },

    clearPhotoMarkers() {
      const viewer = viewerRef.current;
      if (!viewer) return;
      for (const [, entities] of photoEntitiesRef.current) {
        for (const entity of entities) {
          viewer.entities.remove(entity);
        }
      }
      photoEntitiesRef.current.clear();
    },

    // ── Place pins: show rating pills on the globe ──────────────
    showPlacePins(places) {
      const viewer = viewerRef.current;
      if (!viewer || !places || places.length === 0) return;

      // Clear any existing place pins first
      this.clearPlacePins();

      const positions = [];

      for (const place of places) {
        if (!place.lat || !place.lng) continue;

        const canvas = renderPinCanvas(place.rating, false);
        const position = Cesium.Cartesian3.fromDegrees(place.lng, place.lat, 500);
        positions.push(position);

        const entity = viewer.entities.add({
          position,
          billboard: {
            image: canvas,
            width: canvas.width,
            height: canvas.height,
            verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
            heightReference: Cesium.HeightReference.RELATIVE_TO_GROUND,
            disableDepthTestDistance: Number.POSITIVE_INFINITY,
            scaleByDistance: new Cesium.NearFarScalar(5000, 1.2, 500000, 0.6),
          },
          _isPlacePin: true,
          _placeData: place,
          _pinCanvas: canvas,
        });
        placePinEntitiesRef.current.push(entity);
      }

      // Fly to fit all pins — zoom in close at city level
      if (positions.length > 0) {
        const sphere = Cesium.BoundingSphere.fromPoints(positions);
        // For city-level clusters, enforce a minimum zoom distance (~15km)
        // and cap the range so it doesn't zoom out too far
        const range = Math.max(sphere.radius * 2.5, 5000); // at least 5km
        const maxRange = 30000; // cap at 30km so pins are clearly visible
        viewer.camera.flyToBoundingSphere(sphere, {
          duration: 2.0,
          offset: new Cesium.HeadingPitchRange(0, Cesium.Math.toRadians(-35), Math.min(range, maxRange)),
        });
      }
    },

    clearPlacePins() {
      const viewer = viewerRef.current;
      if (!viewer) return;
      for (const entity of placePinEntitiesRef.current) {
        viewer.entities.remove(entity);
      }
      placePinEntitiesRef.current = [];
    },

    highlightPlacePin(place) {
      const viewer = viewerRef.current;
      if (!viewer || !place) return;
      for (const entity of placePinEntitiesRef.current) {
        const isMatch = entity._placeData?.name === place.name && entity._placeData?.lat === place.lat;
        entity.billboard.image = renderPinCanvas(entity._placeData?.rating, isMatch);
      }
      if (place.lat && place.lng) {
        viewer.camera.flyTo({
          destination: Cesium.Cartesian3.fromDegrees(place.lng, place.lat, 5000),
          duration: 1.0,
        });
      }
    },

    lookupCountry(name) {
      const key = name.toLowerCase().trim();
      let entry = geoEntitiesRef.current[key];
      if (!entry && key.length >= 4) {
        for (const [k, v] of Object.entries(geoEntitiesRef.current)) {
          if (k.length < 4) continue;
          if (k.includes(key) || key.includes(k)) {
            entry = v;
            break;
          }
        }
      }
      if (!entry) return null;
      const viewer = viewerRef.current;
      if (!viewer) return { name: entry.name, code: entry.code, lat: 0, lng: 0 };
      const matchName = entry.name.toLowerCase();
      const dataSources = viewer.dataSources;
      for (let d = 0; d < dataSources.length; d++) {
        const entities = dataSources.get(d).entities.values;
        for (const entity of entities) {
          if (entity._geoName && entity._geoName.toLowerCase() === matchName) {
            let lat = 0, lng = 0;
            try {
              const polygon = entity.polygon;
              if (polygon) {
                const hierarchy = polygon.hierarchy.getValue(Cesium.JulianDate.now());
                if (hierarchy && hierarchy.positions && hierarchy.positions.length > 0) {
                  const center = Cesium.BoundingSphere.fromPoints(hierarchy.positions).center;
                  const carto = Cesium.Cartographic.fromCartesian(center);
                  lat = Cesium.Math.toDegrees(carto.latitude);
                  lng = Cesium.Math.toDegrees(carto.longitude);
                }
              }
            } catch {}
            return { name: entry.name, code: entry.code, lat, lng };
          }
        }
      }
      return { name: entry.name, code: entry.code, lat: 0, lng: 0 };
    },
  }));

  useEffect(() => {
    const map = {};
    countries.forEach((c) => { map[c.code] = c; map[c.name.toLowerCase()] = c; });
    countryMapRef.current = map;
  }, [countries]);

  // Create viewer once
  useEffect(() => {
    if (!containerRef.current || viewerRef.current) return;

    const viewer = new Cesium.Viewer(containerRef.current, {
      timeline: false,
      animation: false,
      homeButton: false,
      geocoder: false,
      sceneModePicker: false,
      baseLayerPicker: false,
      navigationHelpButton: false,
      fullscreenButton: false,
      infoBox: false,
      selectionIndicator: false,
      imageryProvider: false,
      skyBox: false,
      skyAtmosphere: new Cesium.SkyAtmosphere(),
    });

    viewerRef.current = viewer;

    // ESRI satellite + English labels
    Cesium.ArcGisMapServerImageryProvider.fromUrl(
      'https://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer',
    ).then((provider) => {
      viewer.imageryLayers.addImageryProvider(provider);
      return Cesium.ArcGisMapServerImageryProvider.fromUrl(
        'https://services.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer',
      );
    }).then((labelsProvider) => {
      viewer.imageryLayers.addImageryProvider(labelsProvider);
    }).catch(() => {});

    // Globe visuals
    viewer.scene.globe.enableLighting = false;
    viewer.scene.globe.showGroundAtmosphere = true;
    viewer.scene.globe.baseColor = Cesium.Color.fromCssColorString('#0d1b2a');
    viewer.scene.backgroundColor = Cesium.Color.fromCssColorString('#000008');
    viewer.scene.skyAtmosphere.show = true;
    viewer.scene.fog.enabled = false;

    let geoDataSource = null;

    // Load clickable country polygons
    Cesium.GeoJsonDataSource.load(GEO_JSON_URL, {
      fill: Cesium.Color.WHITE.withAlpha(0.04),
      stroke: Cesium.Color.TRANSPARENT,
      strokeWidth: 0,
      clampToGround: true,
    }).then((ds) => {
      geoDataSource = ds;
      viewer.dataSources.add(ds);
      const entities = ds.entities.values;
      for (const entity of entities) {
        const props = entity.properties;
        const code = props?.ISO_A2?.getValue?.() || '';
        const name = props?.NAME?.getValue?.() || '';
        const admin = props?.ADMIN?.getValue?.() || '';
        const displayName = name || admin;
        entity._geoCode = code;
        entity._geoName = displayName;
        const entry = { code, name: displayName };
        if (code) geoEntitiesRef.current[code] = entry;
        if (name) geoEntitiesRef.current[name.toLowerCase()] = entry;
        if (admin && admin.toLowerCase() !== name.toLowerCase()) {
          geoEntitiesRef.current[admin.toLowerCase()] = entry;
        }
      }
    }).catch(() => {});

    // Auto-rotation
    viewer.clock.onTick.addEventListener(() => {
      if (rotatingRef.current) {
        viewer.scene.camera.rotate(Cesium.Cartesian3.UNIT_Z, -0.002);
      }
    });

    // Mouse handlers
    const handler = new Cesium.ScreenSpaceEventHandler(viewer.scene.canvas);

    handler.setInputAction(() => { rotatingRef.current = false; }, Cesium.ScreenSpaceEventType.LEFT_DOWN);
    handler.setInputAction(() => { if (rotatingRef._enabled) rotatingRef.current = true; }, Cesium.ScreenSpaceEventType.LEFT_UP);
    handler.setInputAction(() => { rotatingRef.current = false; }, Cesium.ScreenSpaceEventType.MIDDLE_DOWN);
    handler.setInputAction(() => { if (rotatingRef._enabled) rotatingRef.current = true; }, Cesium.ScreenSpaceEventType.MIDDLE_UP);
    handler.setInputAction(() => { rotatingRef.current = false; }, Cesium.ScreenSpaceEventType.RIGHT_DOWN);
    handler.setInputAction(() => { if (rotatingRef._enabled) rotatingRef.current = true; }, Cesium.ScreenSpaceEventType.RIGHT_UP);

    function findGeoEntity(picks) {
      for (const p of picks) {
        if (Cesium.defined(p) && p.id && p.id._geoName) return p.id;
      }
      return null;
    }

    function findPlacePin(picks) {
      for (const p of picks) {
        if (Cesium.defined(p) && p.id && p.id._isPlacePin) return p.id;
      }
      return null;
    }

    function findCountryAtPosition(cartesian) {
      if (!geoDataSource || !cartesian) return null;
      try {
        const carto = Cesium.Cartographic.fromCartesian(cartesian);
        const lonDeg = Cesium.Math.toDegrees(carto.longitude);
        const latDeg = Cesium.Math.toDegrees(carto.latitude);
        const entities = geoDataSource.entities.values;
        for (const entity of entities) {
          if (!entity._geoName || !entity.polygon) continue;
          const hierarchy = entity.polygon.hierarchy.getValue(Cesium.JulianDate.now());
          if (!hierarchy || !hierarchy.positions || hierarchy.positions.length < 3) continue;
          const pts = hierarchy.positions.map((p) => {
            const c = Cesium.Cartographic.fromCartesian(p);
            return [Cesium.Math.toDegrees(c.longitude), Cesium.Math.toDegrees(c.latitude)];
          });
          if (pointInPolygon(lonDeg, latDeg, pts)) return entity;
        }
      } catch {}
      return null;
    }

    function pointInPolygon(x, y, pts) {
      let inside = false;
      for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
        const xi = pts[i][0], yi = pts[i][1];
        const xj = pts[j][0], yj = pts[j][1];
        if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) {
          inside = !inside;
        }
      }
      return inside;
    }

    function openCountryForEntity(entity, clickLat, clickLng) {
      const code = entity._geoCode;
      const name = entity._geoName;
      const fullData = countryMapRef.current[code] || countryMapRef.current[name.toLowerCase()];
      if (fullData) {
        onCountryClickRef.current(fullData, clickLat, clickLng);
      } else {
        onCountryClickRef.current({
          name, code,
          lat: clickLat || 0, lng: clickLng || 0,
          climate: '',
          safety_index: 0, beach_score: 0, nightlife_score: 0,
          cost_of_living: 0, sightseeing_score: 0, cultural_score: 0,
          adventure_score: 0, food_score: 0, infrastructure_score: 0,
          _chatOnly: true,
        }, clickLat, clickLng);
      }
    }

    // Hover — pointer on countries AND place pins
    handler.setInputAction((movement) => {
      const picks = viewer.scene.drillPick(movement.endPosition, 5);
      const placePin = findPlacePin(picks);
      if (placePin) {
        viewer.scene.canvas.style.cursor = 'pointer';
        return;
      }
      const entity = findGeoEntity(picks);
      if (entity) {
        viewer.scene.canvas.style.cursor = 'pointer';
      } else {
        const ray = viewer.camera.getPickRay(movement.endPosition);
        const cartesian = viewer.scene.globe.pick(ray, viewer.scene);
        const fallback = findCountryAtPosition(cartesian);
        viewer.scene.canvas.style.cursor = fallback ? 'pointer' : 'default';
      }
    }, Cesium.ScreenSpaceEventType.MOUSE_MOVE);

    // Click — place pins FIRST, then country polygons
    handler.setInputAction((movement) => {
      const picks = viewer.scene.drillPick(movement.position, 10);

      // Check place pins first
      const placePin = findPlacePin(picks);
      if (placePin) {
        const placeData = placePin._placeData;
        // Highlight the selected pin, unhighlight others
        for (const entity of placePinEntitiesRef.current) {
          entity.billboard.image = renderPinCanvas(
            entity._placeData?.rating,
            entity === placePin,
          );
        }
        if (onPlaceSelectRef.current) onPlaceSelectRef.current(placeData);
        return;
      }

      // Click on globe background → deselect place pins
      if (placePinEntitiesRef.current.length > 0) {
        for (const entity of placePinEntitiesRef.current) {
          if (entity._placeData) {
            entity.billboard.image = renderPinCanvas(entity._placeData.rating, false);
          }
        }
        if (onPlaceSelectRef.current) onPlaceSelectRef.current(null);
      }

      // Country click (existing logic)
      const entity = findGeoEntity(picks);
      if (entity) {
        let clickLat = 0, clickLng = 0;
        try {
          const ray = viewer.camera.getPickRay(movement.position);
          const cart = viewer.scene.globe.pick(ray, viewer.scene);
          if (cart) {
            const c = Cesium.Cartographic.fromCartesian(cart);
            clickLat = Cesium.Math.toDegrees(c.latitude);
            clickLng = Cesium.Math.toDegrees(c.longitude);
          }
        } catch {}
        openCountryForEntity(entity, clickLat, clickLng);
        return;
      }

      // Fallback: ray hit globe
      try {
        const ray = viewer.camera.getPickRay(movement.position);
        const cartesian = viewer.scene.globe.pick(ray, viewer.scene);
        const fallbackEntity = findCountryAtPosition(cartesian);
        if (fallbackEntity) {
          const c = Cesium.Cartographic.fromCartesian(cartesian);
          openCountryForEntity(
            fallbackEntity,
            Cesium.Math.toDegrees(c.latitude),
            Cesium.Math.toDegrees(c.longitude),
          );
        }
      } catch {}
    }, Cesium.ScreenSpaceEventType.LEFT_CLICK);

    return () => {
      handler.destroy();
      viewer.destroy();
      viewerRef.current = null;
    };
  }, []);

  const toggleRotation = useCallback(() => {
    setRotating((prev) => {
      const next = !prev;
      rotatingRef.current = next;
      rotatingRef._enabled = next;
      return next;
    });
  }, []);

  return (
    <div className="globe-wrapper">
      <button
        className="globe-rotate-btn"
        onClick={toggleRotation}
        title={rotating ? 'Pause rotation' : 'Resume rotation'}
        aria-label={rotating ? 'Pause globe rotation' : 'Start globe rotation'}
      >
        {rotating ? '\u23F8' : '\u25B6'}
      </button>

      {/* Zoom controls */}
      <div className="globe-zoom">
        <button
          className="globe-zoom__btn"
          onClick={() => {
            const viewer = viewerRef.current;
            if (viewer) viewer.camera.zoomIn(viewer.camera.positionCartographic.height * 0.4);
          }}
          title="Zoom in"
          aria-label="Zoom in"
        >+</button>
        <button
          className="globe-zoom__btn"
          onClick={() => {
            const viewer = viewerRef.current;
            if (viewer) viewer.camera.zoomOut(viewer.camera.positionCartographic.height * 0.6);
          }}
          title="Zoom out"
          aria-label="Zoom out"
        >&minus;</button>
      </div>

      <div ref={containerRef} className="globe-container" />
    </div>
  );
});

export default Globe;
