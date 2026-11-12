/** Scenario document exchanged with CoreAPI (see CoreAPI/src/scenario_compiler.py). */

export type Range = [number, number];

export interface ScenarioSettings {
  building_consumptions: { [building: string]: { day: Range; night: Range } };
  source_productions: { [source: string]: Range };
}

export type RoundSetting =
  | { type: 'weather'; weather: string }
  | { type: 'outage'; source: string }
  | { type: 'modifier'; buildings: string[]; value: number }
  | { type: 'set_round_consumption'; buildings: string[]; value: number }
  | { type: 'buildings_comment'; text: string }
  | { type: 'coefficient'; source: string; value: number };

export type ScenarioStep =
  | { type: 'allow_production'; source: string }
  | { type: 'change_consumption'; buildings: string[]; day: number; night: number }
  | { type: 'set_consumption'; buildings: string[]; day: number; night: number }
  | { type: 'change_production'; source: string; min: number; max: number }
  | { type: 'day' | 'night'; name: string; settings: RoundSetting[] }
  | { type: 'slide'; image: string }
  | { type: 'slide_range'; images: string[] };

export interface ScenarioDocument {
  version: number;
  name: string;
  settings: ScenarioSettings;
  steps: ScenarioStep[];
}

export interface ScenarioListItem {
  id: string;
  name: string;
  builtin: boolean;
}

export interface ValidationError {
  path: string;
  message: string;
}

/** [label, enum name] pairs in the order used elsewhere in the app. */
export const SOURCES: [string, string][] = [
  ['Uhelná', 'COAL'],
  ['Plynová', 'GAS'],
  ['Jaderná', 'NUCLEAR'],
  ['Vodní', 'HYDRO'],
  ['Přečerpávací', 'HYDRO_STORAGE'],
  ['Větrná', 'WIND'],
  ['Fotovoltaická', 'PHOTOVOLTAIC'],
  ['Baterie', 'BATTERY'],
];

export const CITY_CENTERS = [
  'CITY_CENTER_A', 'CITY_CENTER_B', 'CITY_CENTER_C',
  'CITY_CENTER_D', 'CITY_CENTER_E', 'CITY_CENTER_F',
];

export const BUILDINGS: [string, string][] = [
  ['Centrum města A', 'CITY_CENTER_A'],
  ['Centrum města B', 'CITY_CENTER_B'],
  ['Centrum města C', 'CITY_CENTER_C'],
  ['Centrum města D', 'CITY_CENTER_D'],
  ['Centrum města E', 'CITY_CENTER_E'],
  ['Centrum města F', 'CITY_CENTER_F'],
  ['Továrna', 'FACTORY'],
  ['Stadion', 'STADIUM'],
  ['Nemocnice', 'HOSPITAL'],
  ['Univerzita', 'UNIVERSITY'],
  ['Letiště', 'AIRPORT'],
  ['Obchodní centrum', 'SHOPPING_MALL'],
  ['Technologické centrum', 'TECHNOLOGY_CENTER'],
  ['Farma', 'FARM'],
  ['Menší obytná čtvrť', 'LIVING_QUARTER_SMALL'],
  ['Větší obytná čtvrť', 'LIVING_QUARTER_LARGE'],
  ['Škola', 'SCHOOL'],
];

/** Weather blocks: enum name, label (same wording as the dashboard), icon. */
export const WEATHER: { name: string; label: string; icon: string; dayOnly?: boolean }[] = [
  { name: 'SUNNY', label: 'slunečno', icon: '/icons/01_SUNNY.svg', dayOnly: true },
  { name: 'PARTLY_CLOUDY', label: 'polojasno', icon: '/icons/02_CLOUDY.svg' },
  { name: 'CLOUDY', label: 'zataženo', icon: '/icons/03_OVERCAST.svg' },
  { name: 'RAINY', label: 'prší', icon: '/icons/04_RAINY.svg' },
  { name: 'SNOWY', label: 'sněží', icon: '/icons/05_SNOW.svg' },
  { name: 'FOGGY', label: 'mlha', icon: '/icons/06_FOG.svg' },
  { name: 'WINDY', label: 'větrno', icon: '/icons/09_WINDY.svg' },
  { name: 'BREEZY', label: 'mírný vítr', icon: '/icons/08_MODERATE-WIND.svg' },
  { name: 'CALM', label: 'bezvětří', icon: '/icons/07_NO-WIND.svg' },
];

export function slideUrl(path: string): string {
  return '/coreapi/slide_file/' + path.split('/').map(encodeURIComponent).join('/');
}
