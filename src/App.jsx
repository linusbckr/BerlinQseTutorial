import React, {useState, useEffect, useMemo} from 'react';
import MapView from './components/MapView.jsx';
import DatasetSelector, {DATASETS} from './components/DatasetSelector.jsx';
import {useArrowData} from './hooks/useArrowData.js';

export default function App() {
  const [activeId, setActiveId]         = useState(DATASETS[0].id);
  const [selectedYear, setSelectedYear] = useState(null);
  const [is3D, setIs3D]                 = useState(true);
  const [flyTo, setFlyTo]               = useState(null);

  const dataset = DATASETS.find(d => d.id === activeId);

  const handleDatasetChange = (id) => {
    const next = DATASETS.find(d => d.id === id);
    if (next?.crossSection) setSelectedYear(null);
    if (next?.initialView) setFlyTo({...next.initialView, _ts: Date.now()});
    if (next?.idField === 'target_id') setIs3D(true);
    setActiveId(id);
  };

  const {table, loading, error} = useArrowData(dataset?.file ?? null);

  // Derive sorted year list — empty for cross-section files
  const years = useMemo(() => {
    if (!table || dataset?.crossSection) return [];
    const col = table.getChild('year');
    if (!col) return [];
    const set = new Set();
    for (let i = 0; i < col.length; i++) {
      const v = col.get(i);
      if (v != null) set.add(Number(v));
    }
    return Array.from(set).sort((a, b) => a - b);
  }, [table, dataset]);

  // Auto-select latest year on panel load; clear on cross-section load
  useEffect(() => {
    if (dataset?.crossSection) {
      setSelectedYear(null);
    } else if (years.length > 0 && selectedYear === null) {
      setSelectedYear(years[years.length - 1]);
    }
  }, [years, dataset]);

  // Global min/max over the entire table for the active field — keeps the
  // elevation scale fixed as the user steps through years.
  // For cityFilter datasets, restrict domain to the city's rows only.
  const globalDomain = useMemo(() => {
    if (!table || !dataset) return null;
    const col = table.getChild(dataset.field);
    if (!col) return null;

    const cityCol  = dataset.cityFilter ? table.getChild('city') : null;
    const arr      = col.toArray();
    const cityArr  = cityCol ? cityCol.toArray() : null;

    let min = Infinity, max = -Infinity;
    for (let i = 0; i < arr.length; i++) {
      if (cityArr && cityArr[i] !== dataset.cityFilter) continue;
      const v = arr[i];
      if (v != null && isFinite(v)) {
        if (v < min) min = v;
        if (v > max) max = v;
      }
    }
    return min === Infinity ? null : [min, max];
  }, [table, dataset]);

  // Convert Arrow table → plain JS array, applying year and city filters.
  const filteredData = useMemo(() => {
    if (!table) return null;

    const fields  = table.schema.fields.map(f => f.name);
    const columns = fields.map(name => table.getChild(name));

    if (dataset?.crossSection) {
      const cityIdx = dataset.cityFilter ? fields.indexOf('city') : -1;
      const rows = [];
      for (let i = 0; i < table.numRows; i++) {
        if (cityIdx !== -1 && columns[cityIdx].get(i) !== dataset.cityFilter) continue;
        const row = {};
        for (let c = 0; c < fields.length; c++) row[fields[c]] = columns[c].get(i);
        rows.push(row);
      }
      return rows;
    }

    if (selectedYear === null) return null;
    const yearIdx = fields.indexOf('year');
    if (yearIdx === -1) return null;
    const cityIdx = dataset.cityFilter ? fields.indexOf('city') : -1;

    const rows = [];
    for (let i = 0; i < table.numRows; i++) {
      if (Number(columns[yearIdx].get(i)) !== selectedYear) continue;
      if (cityIdx !== -1 && columns[cityIdx].get(i) !== dataset.cityFilter) continue;
      const row = {};
      for (let c = 0; c < fields.length; c++) row[fields[c]] = columns[c].get(i);
      rows.push(row);
    }
    return rows;
  }, [table, dataset, selectedYear]);

  return (
    <div style={{position: 'relative', width: '100vw', height: '100vh', overflow: 'hidden', background: '#0d1117'}}>
      <MapView data={filteredData} dataset={dataset} domain={globalDomain} is3D={is3D} flyTo={flyTo} />

      {/* HUD */}
      <div style={{position: 'absolute', top: 16, left: 16, zIndex: 10, width: 300, display: 'flex', flexDirection: 'column', gap: 12}}>
        {/* Title */}
        <div className="rounded-xl border border-white/10 bg-[#161b22]/90 px-4 py-3 backdrop-blur-sm">
          <h1 className="text-base font-bold tracking-tight text-white">Mietpreis-Explorer</h1>
          <p className="mt-0.5 text-xs text-white/50">Deutschland · PLZ-Ebene · GPU-gerendert</p>
        </div>

        {/* Dataset selector */}
        <div className="rounded-xl border border-white/10 bg-[#161b22]/90 px-4 py-3 backdrop-blur-sm">
          <label className="mb-2 block text-xs font-medium uppercase tracking-widest text-white/60">Kennzahl</label>
          <DatasetSelector value={activeId} onChange={handleDatasetChange} />
        </div>

        {/* 3D / 2D toggle — hide 2D for grid datasets (no polygon layer) */}
        <div className="rounded-xl border border-white/10 bg-[#161b22]/90 px-4 py-3 backdrop-blur-sm">
          <label className="mb-2 block text-xs font-medium uppercase tracking-widest text-white/60">Ansicht</label>
          <div className="flex gap-2">
            {[true, false].map(v => (
              <button
                key={String(v)}
                onClick={() => setIs3D(v)}
                className={`flex-1 rounded-lg py-1.5 text-xs font-medium transition-colors ${
                  is3D === v
                    ? 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
                    : 'text-white/40 hover:text-white/60'
                }`}
              >
                {v ? '3D' : '2D'}
              </button>
            ))}
          </div>
        </div>

        {/* Year slider — only for panel datasets */}
        {years.length > 0 && !dataset?.crossSection && (
          <div className="rounded-xl border border-white/10 bg-[#161b22]/90 px-4 py-3 backdrop-blur-sm">
            <label className="mb-2 block text-xs font-medium uppercase tracking-widest text-white/60">
              Jahr: <span className="text-white font-mono">{selectedYear}</span>
            </label>
            <input
              type="range"
              min={years[0]}
              max={years[years.length - 1]}
              step={1}
              value={selectedYear ?? years[years.length - 1]}
              onChange={e => setSelectedYear(Number(e.target.value))}
              className="w-full accent-blue-400"
            />
            <div className="mt-1 flex justify-between text-[10px] text-white/30">
              <span>{years[0]}</span><span>{years[years.length - 1]}</span>
            </div>
          </div>
        )}

        {/* Status */}
        {loading && (
          <div className="rounded-xl border border-white/10 bg-[#161b22]/90 px-4 py-2 text-xs text-white/50">
            Lade Arrow-Daten…
          </div>
        )}
        {error && (
          <div className="rounded-xl border border-red-500/40 bg-red-950/60 px-4 py-2 text-xs text-red-300">
            Fehler: {error.message}
          </div>
        )}
        {filteredData && !loading && (
          <div className="rounded-xl border border-white/10 bg-[#161b22]/90 px-4 py-2 text-xs text-white/40">
            {filteredData.length.toLocaleString('de-DE')} PLZ-Gebiete
            {dataset?.crossSection && !dataset?.cityFilter && <span className="ml-1 opacity-60">· Querschnitt 2022</span>}
          </div>
        )}
      </div>

      <div style={{position: 'absolute', bottom: 16, left: 16, zIndex: 10, fontSize: 10, color: 'rgba(255,255,255,0.2)', userSelect: 'none'}}>
        Ziehen · Scrollen · Strg+Ziehen zum Neigen
      </div>
    </div>
  );
}
