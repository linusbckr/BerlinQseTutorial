import React from 'react';
import * as Select from '@radix-ui/react-select';
import {CheckIcon, ChevronDownIcon, ChevronUpIcon} from '@radix-ui/react-icons';

const AHS_CITIES = [
  {city: 'Berlin',    lon: 13.405, lat: 52.52},
  {city: 'Hamburg',   lon: 10.000, lat: 53.55},
  {city: 'München',   lon: 11.576, lat: 48.137},
  {city: 'Köln',      lon:  6.957, lat: 50.938},
  {city: 'Frankfurt', lon:  8.682, lat: 50.110},
];

const makeAhsDatasets = (type, file) =>
  AHS_CITIES.map(({city, lon, lat}) => ({
    id:           `panel_${type}_${city.toLowerCase().replace('ü', 'ue')}`,
    label:        city,
    file,
    unit:         'log €/m²',
    field:        'lprice',
    crossSection: false,
    idField:      'plz',
    geoFile:      './data/plz.geojson',
    geoKey:       'postcode',
    cityFilter:   city,
    initialView:  {longitude: lon, latitude: lat, zoom: 11, pitch: 50, bearing: 0},
  }));

export const DATASETS = [
  // ── PLZ Panel (2007–2022) ────────────────────────────────────────────────
  {
    id: 'median_panel', label: 'Median Mietpreis – Panel (2007–2022)',
    file: './data/rent_sqm.arrow', unit: '€/m²', field: 'median_rent_sqm',
    crossSection: false, idField: 'plz', geoFile: './data/plz.geojson', geoKey: 'postcode',
  },
  {
    id: 'mean_panel', label: 'Ø Mietpreis – Panel (2007–2022)',
    file: './data/rent_sqm.arrow', unit: '€/m²', field: 'mean_rent_sqm',
    crossSection: false, idField: 'plz', geoFile: './data/plz.geojson', geoKey: 'postcode',
  },
  // ── PLZ Cross-section 2022 ───────────────────────────────────────────────
  {
    id: 'median_cs22', label: 'Median Mietpreis – Querschnitt 2022',
    file: './data/rent_sqm_2022cs.arrow', unit: '€/m²', field: 'median_rent_sqm',
    crossSection: true, idField: 'plz', geoFile: './data/plz.geojson', geoKey: 'postcode',
  },
  {
    id: 'mean_cs22', label: 'Ø Mietpreis – Querschnitt 2022',
    file: './data/rent_sqm_2022cs.arrow', unit: '€/m²', field: 'mean_rent_sqm',
    crossSection: true, idField: 'plz', geoFile: './data/plz.geojson', geoKey: 'postcode',
  },
  {
    id: 'listings_cs22', label: 'Anzahl Inserate – Querschnitt 2022',
    file: './data/rent_sqm_2022cs.arrow', unit: 'Inserate', field: 'n_listings',
    crossSection: true, idField: 'plz', geoFile: './data/plz.geojson', geoKey: 'postcode',
  },
  // ── Kreis 2022 ───────────────────────────────────────────────────────────
  {
    id: 'kreis_employ_gap', label: 'Beschäftigungslücke M−F – Kreise 2022',
    file: './data/kreis_pop.arrow', unit: 'Pp', field: 'employ_gap',
    crossSection: true, idField: 'ags', geoFile: './data/kreis_polygons.geojson', geoKey: 'ags',
    diverging: true, center: 0,
  },
  // ── AHS2023 Panel indices (2007–2022) ────────────────────────────────────
  ...makeAhsDatasets('wm', './data/panel_index_wm.arrow'),
  ...makeAhsDatasets('wk', './data/panel_index_wk.arrow'),
  ...makeAhsDatasets('hk', './data/panel_index_hk.arrow'),
];

const GROUPS = [
  {label: 'Mietpreise PLZ – Panel (2007–2022)',      filter: d => ['median_panel', 'mean_panel'].includes(d.id)},
  {label: 'Mietpreise PLZ – Querschnitt 2022',       filter: d => d.crossSection && d.idField === 'plz'},
  {label: 'Arbeitsmarkt Kreise 2022',                filter: d => d.idField === 'ags'},
  {label: 'AHS2023 Mietpreis (2007–2022)',           filter: d => d.id?.startsWith('panel_wm_')},
  {label: 'AHS2023 Wohnungskauf (2007–2022)',        filter: d => d.id?.startsWith('panel_wk_')},
  {label: 'AHS2023 Hauskauf (2007–2022)',            filter: d => d.id?.startsWith('panel_hk_')},
];

export default function DatasetSelector({value, onChange}) {
  const selected = DATASETS.find(d => d.id === value);

  return (
    <Select.Root value={value} onValueChange={onChange}>
      <Select.Trigger className="select-trigger" aria-label="Datensatz wählen">
        <span className="flex-1 text-left truncate text-sm">
          {selected?.label ?? 'Datensatz wählen…'}
        </span>
        <Select.Icon asChild>
          <ChevronDownIcon className="opacity-60 shrink-0" />
        </Select.Icon>
      </Select.Trigger>

      <Select.Portal>
        <Select.Content className="select-content" position="popper" sideOffset={6}>
          <Select.ScrollUpButton className="flex justify-center py-1 opacity-60">
            <ChevronUpIcon />
          </Select.ScrollUpButton>

          <Select.Viewport className="p-1 overflow-y-auto">
            {GROUPS.map((group, gi) => (
              <React.Fragment key={group.label}>
                {gi > 0 && <Select.Separator className="my-1 h-px bg-white/10" />}
                <Select.Group>
                  <Select.Label className="px-3 py-1 text-[10px] font-semibold uppercase tracking-widest text-white/30">
                    {group.label}
                  </Select.Label>
                  {DATASETS.filter(group.filter).map(ds => (
                    <Select.Item key={ds.id} value={ds.id} className="select-item">
                      <Select.ItemIndicator asChild>
                        <CheckIcon className="text-[--color-accent] shrink-0" />
                      </Select.ItemIndicator>
                      <Select.ItemText>{ds.label}</Select.ItemText>
                    </Select.Item>
                  ))}
                </Select.Group>
              </React.Fragment>
            ))}
          </Select.Viewport>

          <Select.ScrollDownButton className="flex justify-center py-1 opacity-60">
            <ChevronDownIcon />
          </Select.ScrollDownButton>
        </Select.Content>
      </Select.Portal>
    </Select.Root>
  );
}
