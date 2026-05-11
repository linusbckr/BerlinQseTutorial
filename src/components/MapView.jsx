import React, {useState, useEffect, useRef, useMemo, useCallback} from 'react';
import DeckGL from '@deck.gl/react';
import {ColumnLayer, GeoJsonLayer} from '@deck.gl/layers';
import Map from 'react-map-gl/maplibre';
import 'maplibre-gl/dist/maplibre-gl.css';

const INITIAL_VIEW = {
  longitude: 10.45,
  latitude:  51.17,
  zoom:      5.4,
  pitch:     50,
  bearing:   0,
  minZoom:   4,
  maxZoom:   15,
};

const MAP_STYLE = 'https://basemaps.cartocdn.com/gl/dark-matter-nolabels-gl-style/style.json';

// Plasma colormap — returns [R, G, B, A]
function plasma(t, alpha = 220) {
  const r = Math.round(Math.min(255, 13 + t * 227));
  const g = Math.round(Math.max(0, 8 + Math.sin(t * Math.PI) * 80));
  const b = Math.round(Math.max(0, 135 - t * 135));
  return [r, g, b, alpha];
}

// Blue → white → red diverging colormap (ColorBrewer RdBu)
function colorDiverging(t, alpha = 220) {
  const [r0, g0, b0] = t < 0.5 ? [33, 102, 172]  : [247, 247, 247];
  const [r1, g1, b1] = t < 0.5 ? [247, 247, 247]  : [178, 24,  43];
  const s = t < 0.5 ? t * 2 : (t - 0.5) * 2;
  return [
    Math.round(r0 + s * (r1 - r0)),
    Math.round(g0 + s * (g1 - g0)),
    Math.round(b0 + s * (b1 - b0)),
    alpha,
  ];
}

function makeGradient(fn) {
  const stops = Array.from({length: 12}, (_, i) => {
    const t = i / 11;
    const [r, g, b] = fn(t);
    return `rgb(${r},${g},${b}) ${(t * 100).toFixed(1)}%`;
  });
  return `linear-gradient(to right, ${stops.join(', ')})`;
}

const LEGEND_PLASMA     = makeGradient(plasma);
const LEGEND_DIVERGING  = makeGradient(colorDiverging);

// Normalise value → [0,1] respecting diverging center if needed
function normalise(v, colorMin, colorMax, colorRange, dataset) {
  if (dataset?.diverging) {
    const c       = dataset.center ?? 0;
    const extreme = Math.max(Math.abs(colorMax - c), Math.abs(colorMin - c)) || 1;
    return Math.max(0, Math.min(1, 0.5 + 0.5 * (v - c) / extreme));
  }
  return Math.max(0, Math.min(1, (v - colorMin) / colorRange));
}

export default function MapView({data, dataset, domain, is3D, flyTo}) {
  const [hoverInfo, setHoverInfo] = useState(null);
  const [geoData,   setGeoData]   = useState(null);

  // Track current position without triggering re-renders during pan/zoom
  const positionRef   = useRef(INITIAL_VIEW);
  const loadedGeoRef  = useRef(null);

  // Re-initialise view with animated pitch on 3D↔2D toggle, or fly to dataset city
  const [pitchView, setPitchView] = useState(INITIAL_VIEW);
  useEffect(() => {
    setPitchView({...positionRef.current, pitch: is3D ? 50 : 0, transitionDuration: 600});
  }, [is3D]);
  useEffect(() => {
    if (flyTo) setPitchView({...flyTo, transitionDuration: 1200});
  }, [flyTo]);

  // Clear stale GeoJSON when dataset switches to a different geo file
  useEffect(() => {
    const file = dataset?.geoFile;
    if (file !== loadedGeoRef.current) setGeoData(null);
  }, [dataset?.geoFile]);

  // Lazy-fetch GeoJSON for 2D mode — only when needed and not already loaded
  useEffect(() => {
    const file = dataset?.geoFile;
    if (is3D || !file || geoData !== null) return;
    fetch(file)
      .then(r => r.json())
      .then(d => { setGeoData(d); loadedGeoRef.current = file; });
  }, [is3D, dataset?.geoFile, geoData]);

  // Elevation: global domain (stable across years/slices)
  const elevMin   = domain ? domain[0] : 0;
  const elevMax   = domain ? domain[1] : 1;
  const elevRange = elevMax - elevMin || 1;

  // Colour: per-slice domain for maximum contrast
  const {colorMin, colorMax} = useMemo(() => {
    if (!data || !dataset || data.length === 0) return {colorMin: 0, colorMax: 1};
    let min = Infinity, max = -Infinity;
    for (const row of data) {
      const v = row[dataset.field];
      if (v != null && isFinite(v)) {
        if (v < min) min = v;
        if (v > max) max = v;
      }
    }
    return {colorMin: min === Infinity ? 0 : min, colorMax: max === -Infinity ? 1 : max};
  }, [data, dataset]);
  const colorRange = colorMax - colorMin || 1;

  const colorFn = dataset?.diverging ? colorDiverging : plasma;

  // ID → row lookup: only built in 2D mode where it is needed
  const dataById = useMemo(() => {
    if (is3D || !data || !dataset) return null;
    const idField = dataset.idField ?? 'plz';
    const map = {};
    for (const row of data) map[row[idField]] = row;
    return map;
  }, [is3D, data, dataset]);

  const handleHover = useCallback(info => setHoverInfo(info.object ? info : null), []);

  const layers = useMemo(() => {
    if (!data || !dataset || data.length === 0) return [];

    if (!is3D) {
      if (!geoData) return [];
      const geoKey = dataset.geoKey ?? 'postcode';
      return [
        new GeoJsonLayer({
          id:                 `geo-${dataset.id}`,
          data:               geoData,
          filled:             true,
          stroked:            true,
          lineWidthMinPixels: 0.5,
          getLineColor:       [255, 255, 255, 25],
          getFillColor: f => {
            const row = dataById?.[f.properties[geoKey]];
            if (!row) return [30, 30, 30, 80];
            const t = normalise(row[dataset.field], colorMin, colorMax, colorRange, dataset);
            return colorFn(t);
          },
          pickable:       true,
          autoHighlight:  true,
          highlightColor: [255, 255, 255, 40],
          onHover:        handleHover,
          updateTriggers: {getFillColor: [dataset.field, colorMin, colorMax, dataById]},
        }),
      ];
    }

    return [
      new ColumnLayer({
        id:             `col-${dataset.id}`,
        data,
        diskResolution: 12,
        radius:         dataset.idField === 'ags' ? 8000 : 2200,
        extruded:       true,
        pickable:       true,
        autoHighlight:  true,
        highlightColor: [255, 255, 255, 80],
        getPosition:    d => [d.longitude, d.latitude],
        getElevation:   d => Math.max(0, ((d[dataset.field] ?? elevMin) - elevMin) / elevRange) * 60_000,
        getFillColor:   d => colorFn(normalise(d[dataset.field] ?? colorMin, colorMin, colorMax, colorRange, dataset)),
        onHover:        handleHover,
        updateTriggers: {
          getElevation: [dataset.field, elevMin, elevMax],
          getFillColor: [dataset.field, colorMin, colorMax],
        },
      }),
    ];
  }, [data, dataset, is3D, geoData, dataById, elevMin, elevRange, colorMin, colorMax, colorRange, colorFn, handleHover]);

  // Resolve hovered row — 3D: object IS the row; 2D: look up by geo key
  const hoveredRow = useMemo(() => {
    if (!hoverInfo?.object || !dataset) return null;
    if (hoverInfo.object.properties) {
      const geoKey = dataset.geoKey ?? 'postcode';
      return dataById?.[hoverInfo.object.properties[geoKey]] ?? null;
    }
    return hoverInfo.object;
  }, [hoverInfo, dataset, dataById]);

  const idField = dataset?.idField ?? 'plz';

  return (
    <div style={{position: 'absolute', inset: 0}}>
      <DeckGL
        initialViewState={pitchView}
        onViewStateChange={({viewState: vs}) => { positionRef.current = vs; }}
        controller={{maxPitch: is3D ? 60 : 0}}
        layers={layers}
        style={{position: 'absolute', inset: 0}}
      >
        <Map mapStyle={MAP_STYLE} />
      </DeckGL>

      {/* Tooltip */}
      {hoveredRow && (
        <div style={{
          position: 'absolute', left: hoverInfo.x + 14, top: hoverInfo.y + 14,
          pointerEvents: 'none', zIndex: 20,
          background: 'rgba(22,27,34,0.95)', border: '1px solid rgba(255,255,255,0.1)',
          borderRadius: 8, padding: '8px 12px', fontSize: 12, color: 'white',
          boxShadow: '0 4px 24px rgba(0,0,0,0.5)', lineHeight: 1.6,
        }}>
          {hoveredRow.kreis_name
            ? <div style={{fontWeight: 600}}>{hoveredRow.kreis_name}</div>
            : <div style={{fontWeight: 600}}>PLZ {hoveredRow[idField]}</div>
          }
          {/* PLZ area name · city (city shown only when different from area name) */}
          {hoveredRow.district_name && (
            <div style={{opacity: 0.65, fontSize: 11, marginBottom: 2}}>
              {hoveredRow.district_name}
              {hoveredRow.city_name && hoveredRow.city_name !== hoveredRow.district_name
                ? ` · ${hoveredRow.city_name}` : ''}
            </div>
          )}
          <div>
            <span style={{opacity: 0.55}}>{dataset.unit}: </span>
            {Number(hoveredRow[dataset.field]).toFixed(3)}
          </div>
          {hoveredRow.outer_radius_used != null && (
            <div style={{opacity: 0.4, fontSize: 10}}>
              r_outer = {Number(hoveredRow.outer_radius_used).toFixed(1)} km ·{' '}
              n = {Number(hoveredRow.outer_obs_used).toLocaleString('de-DE')}
            </div>
          )}
          {hoveredRow.n_listings != null && (
            <div style={{opacity: 0.4, fontSize: 10}}>
              n = {Number(hoveredRow.n_listings).toLocaleString('de-DE')} Inserate
            </div>
          )}
          {hoveredRow.male_total != null && (
            <div style={{opacity: 0.4, fontSize: 10}}>
              {Number(hoveredRow.male_total).toLocaleString('de-DE')} M ·{' '}
              {Number(hoveredRow.female_total).toLocaleString('de-DE')} F
            </div>
          )}
        </div>
      )}

      {/* Legend */}
      {dataset && data && data.length > 0 && (
        <div style={{
          position: 'absolute', bottom: 32, right: 16, zIndex: 10,
          background: 'rgba(22,27,34,0.9)', border: '1px solid rgba(255,255,255,0.1)',
          borderRadius: 8, padding: '8px 12px', fontSize: 11, color: 'white',
        }}>
          <div style={{fontWeight: 600, marginBottom: 4}}>{dataset.unit}</div>
          <div style={{display: 'flex', alignItems: 'center', gap: 8}}>
            <span style={{opacity: 0.6}}>{colorMin.toFixed(1)}</span>
            <div style={{
              width: 96, height: 8, borderRadius: 4,
              background: dataset.diverging ? LEGEND_DIVERGING : LEGEND_PLASMA,
            }} />
            <span style={{opacity: 0.6}}>{colorMax.toFixed(1)}</span>
          </div>
          {dataset.diverging && (
            <div style={{opacity: 0.35, fontSize: 10, marginTop: 3, textAlign: 'center'}}>
              Mitte = {dataset.center}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
