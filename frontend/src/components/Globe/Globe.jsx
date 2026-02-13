import { useRef, useState, useEffect, useCallback, useImperativeHandle, forwardRef } from 'react';
import * as Cesium from 'cesium';
import 'cesium/Build/Cesium/Widgets/widgets.css';
import './Globe.css';

Cesium.Ion.defaultAccessToken = undefined;

const GEO_JSON_URL =
  'https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_50m_admin_0_countries.geojson';

const Globe = forwardRef(function Globe(
  { countries, recommendations, onCountryHover, onCountryClick },
  ref,
) {
  const containerRef = useRef(null);
  const viewerRef = useRef(null);
  const countryMapRef = useRef({});
  const geoEntitiesRef = useRef({});
  const photoEntitiesRef = useRef(new Map()); // tabId → [entities]
  const [rotating, setRotating] = useState(false);
  const rotatingRef = useRef(false);
  const onCountryClickRef = useRef(onCountryClick);
  const onCountryHoverRef = useRef(onCountryHover);

  // Keep callback refs fresh
  useEffect(() => { onCountryClickRef.current = onCountryClick; }, [onCountryClick]);
  useEffect(() => { onCountryHoverRef.current = onCountryHover; }, [onCountryHover]);

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

      // Draw framed photo on a canvas for the billboard
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

        // Rounded rect background
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

        // Border glow
        ctx.strokeStyle = 'rgba(0, 204, 255, 0.5)';
        ctx.lineWidth = 1.5;
        ctx.stroke();

        // Photo (clipped with rounded corners)
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

        // Label text
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

        // Add as billboard entity
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
        // If canvas approach fails (CORS), use plain image URL
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

    // Remove photo markers for a specific tab
    removePhotoMarker(tabId) {
      const viewer = viewerRef.current;
      if (!viewer) return;
      const entities = photoEntitiesRef.current.get(tabId) || [];
      for (const entity of entities) {
        viewer.entities.remove(entity);
      }
      photoEntitiesRef.current.delete(tabId);
    },

    // Remove all photo markers from the globe
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

    // Look up any country by name in the GeoJSON data
    lookupCountry(name) {
      const key = name.toLowerCase().trim();
      // Exact match first
      let entry = geoEntitiesRef.current[key];
      // Partial match fallback (require at least 4 chars to avoid false positives)
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
      // Try to get coordinates from the GeoJSON entity
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
              // For polygon entities, compute center from the polygon hierarchy
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

    // Keep a ref to the datasource for ray-based lookups
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
      // Index entities by ISO code and name
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

    // Helper: find GeoJSON entity from a pick list (drillPick results)
    function findGeoEntity(picks) {
      for (const p of picks) {
        if (Cesium.defined(p) && p.id && p.id._geoName) return p.id;
      }
      return null;
    }

    // Helper: find which country polygon contains a cartographic position
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
          // Point-in-polygon test using ray casting on lat/lng
          const pts = hierarchy.positions.map((p) => {
            const c = Cesium.Cartographic.fromCartesian(p);
            return [Cesium.Math.toDegrees(c.longitude), Cesium.Math.toDegrees(c.latitude)];
          });
          if (pointInPolygon(lonDeg, latDeg, pts)) return entity;
        }
      } catch {}
      return null;
    }

    // Ray-casting point-in-polygon
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

    // Helper: open country panel for a given entity — always pass click coordinates
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

    // Hover — show pointer on countries
    handler.setInputAction((movement) => {
      const picks = viewer.scene.drillPick(movement.endPosition, 5);
      const entity = findGeoEntity(picks);
      if (entity) {
        viewer.scene.canvas.style.cursor = 'pointer';
      } else {
        // Fallback: check if the globe surface belongs to a country
        const ray = viewer.camera.getPickRay(movement.endPosition);
        const cartesian = viewer.scene.globe.pick(ray, viewer.scene);
        const fallback = findCountryAtPosition(cartesian);
        viewer.scene.canvas.style.cursor = fallback ? 'pointer' : 'default';
      }
    }, Cesium.ScreenSpaceEventType.MOUSE_MOVE);

    // Click — open country panel
    handler.setInputAction((movement) => {
      // Try drillPick first (gets through overlapping imagery)
      const picks = viewer.scene.drillPick(movement.position, 10);
      const entity = findGeoEntity(picks);
      if (entity) {
        // Get click lat/lng for chat-only countries
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

      // Fallback: ray hit the globe → find which country polygon contains that point
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
      >
        {rotating ? '\u23F8' : '\u25B6'}
      </button>
      <div ref={containerRef} className="globe-container" />
    </div>
  );
});

export default Globe;
