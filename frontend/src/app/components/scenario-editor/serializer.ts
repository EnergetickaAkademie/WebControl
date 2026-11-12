import * as Blockly from 'blockly/core';
import { FieldSlideImage, setBaseValuesVisible } from './blocks';
import {
  CITY_CENTERS, RoundSetting, ScenarioDocument, ScenarioSettings, ScenarioStep, ValidationError,
} from './scenario-model';

/* ------------------------------------------------------------------------ *
 * Document -> Blockly serialization state
 * ------------------------------------------------------------------------ */

type BlockState = { type: string; fields?: any; inputs?: any; next?: { block: BlockState }; x?: number; y?: number };

/** Blockly rejects inputs whose value is undefined; drop empty ones recursively. */
function prune(state: BlockState): BlockState {
  if (state.inputs) {
    const inputs: any = {};
    for (const [name, value] of Object.entries(state.inputs as Record<string, any>)) {
      if (value?.block) inputs[name] = { block: prune(value.block) };
    }
    state.inputs = Object.keys(inputs).length ? inputs : undefined;
    if (!state.inputs) delete state.inputs;
  }
  if (state.next) state.next = { block: prune(state.next.block) };
  return state;
}

/** Link a list of block states into a next-chain; returns the first one. */
function chain(blocks: BlockState[]): BlockState | undefined {
  for (let i = blocks.length - 2; i >= 0; i--) {
    blocks[i].next = { block: blocks[i + 1] };
  }
  return blocks[0];
}

function statement(blocks: BlockState[]) {
  const first = chain(blocks);
  return first ? { block: first } : undefined;
}

function buildingsState(buildings: string[]): BlockState | undefined {
  if (buildings.length === 0) return undefined;
  if (buildings.length === CITY_CENTERS.length && CITY_CENTERS.every((b) => buildings.includes(b))) {
    return { type: 'city_centers' };
  }
  if (buildings.length === 1) {
    return { type: 'building', fields: { BUILDING: buildings[0] } };
  }
  // Use the city-centers block for the city-center part where possible.
  const hasAllCenters = CITY_CENTERS.every((b) => buildings.includes(b));
  const parts: BlockState[] = hasAllCenters ? [{ type: 'city_centers' }] : [];
  for (const b of buildings) {
    if (!(hasAllCenters && CITY_CENTERS.includes(b))) parts.push({ type: 'building', fields: { BUILDING: b } });
  }
  return parts.reduce((acc, part) => ({ type: 'building_join', inputs: { A: { block: acc }, B: { block: part } } }));
}

/** A list reporter always needs a list block (a single building is joined with nothing). */
function buildingListState(buildings: string[]): BlockState | undefined {
  const state = buildingsState(buildings);
  if (state?.type === 'building') {
    return { type: 'building_join', inputs: { A: { block: state } } };
  }
  return state;
}

function input(state: BlockState | undefined) {
  return state ? { block: state } : undefined;
}

function settingState(setting: RoundSetting): BlockState | null {
  switch (setting.type) {
    case 'weather':
      return { type: `weather_${setting.weather}` };
    case 'outage':
      return { type: 'outage', fields: { SOURCE: setting.source } };
    case 'modifier':
      if (setting.buildings.length === 1) {
        return { type: 'modifier_single', fields: { VALUE: setting.value }, inputs: { BUILDING: input(buildingsState(setting.buildings)) } };
      }
      return { type: 'modifier_multi', fields: { VALUE: setting.value }, inputs: { BUILDINGS: input(buildingListState(setting.buildings)) } };
    case 'set_round_consumption':
      return { type: 'set_round_consumption', fields: { VALUE: setting.value }, inputs: { BUILDINGS: input(buildingsState(setting.buildings)) } };
    case 'buildings_comment':
      return { type: 'buildings_comment', fields: { TEXT: setting.text } };
    case 'coefficient':
      return { type: 'coefficient', fields: { SOURCE: setting.source, VALUE: setting.value } };
  }
  return null;
}

function stepState(step: ScenarioStep): BlockState | null {
  switch (step.type) {
    case 'allow_production':
      return { type: 'allow_production', fields: { SOURCE: step.source } };
    case 'change_consumption':
      return {
        type: 'change_consumption',
        fields: { DAY: step.day, NIGHT: step.night },
        inputs: { BUILDINGS: input(buildingsState(step.buildings)) },
      };
    case 'set_consumption':
      return {
        type: 'set_consumption',
        fields: { DAY: step.day, NIGHT: step.night },
        inputs: { BUILDINGS: input(buildingsState(step.buildings)) },
      };
    case 'change_production':
      return { type: 'change_production', fields: { SOURCE: step.source, MIN: step.min, MAX: step.max } };
    case 'day':
    case 'night':
      return {
        type: step.type === 'day' ? 'round_day' : 'round_night',
        fields: { NAME: step.name || '' },
        inputs: { SETTINGS: statement(step.settings.map(settingState).filter((s): s is BlockState => !!s)) },
      };
    case 'slide':
      return { type: 'slide', fields: { IMAGE: FieldSlideImage.pathToValue(step.image) } };
    case 'slide_range':
      return {
        type: 'slide_range',
        inputs: { SLIDES: statement(step.images.map((image) => ({ type: 'slide_item', fields: { IMAGE: FieldSlideImage.pathToValue(image) } }))) },
      };
  }
  return null;
}

function settingsState(settings: ScenarioSettings): BlockState {
  const rows: BlockState[] = [];
  for (const [building, value] of Object.entries(settings.building_consumptions || {})) {
    rows.push({
      type: 'base_consumption',
      fields: { BUILDING: building, DAY_MIN: value.day[0], DAY_MAX: value.day[1], NIGHT_MIN: value.night[0], NIGHT_MAX: value.night[1] },
    });
  }
  for (const [source, value] of Object.entries(settings.source_productions || {})) {
    rows.push({ type: 'base_production', fields: { SOURCE: source, MIN: value[0], MAX: value[1] } });
  }
  return { type: 'scenario_settings', inputs: { VALUES: statement(rows) } };
}

/** Replace the workspace content with the given document. */
export function documentToWorkspace(doc: ScenarioDocument, workspace: Blockly.WorkspaceSvg) {
  const settings = settingsState(doc.settings);
  const steps = doc.steps.map(stepState).filter((s): s is BlockState => !!s);
  const first = chain(steps);
  if (first) settings.next = { block: first };

  const state = { type: 'scenario_start', x: 40, y: 40, next: { block: settings } };

  Blockly.Events.disable();
  try {
    workspace.clear();
  } finally {
    Blockly.Events.enable();
  }
  Blockly.serialization.blocks.append(prune(state) as any, workspace);
  lockStructureBlocks(workspace);
  collapseBaseValues(workspace);
  workspace.clearUndo();
  const start = workspace.getBlocksByType('scenario_start', false)[0];
  if (start) {
    // Show the beginning of the scenario: start block near the top-left.
    const xy = start.getRelativeToSurfaceXY();
    const metrics = workspace.getMetrics();
    workspace.scroll(-(xy.x * workspace.scale - metrics.viewWidth / 4), -(xy.y * workspace.scale - 30));
  }
}

/** The start block and the base-values clamp are always present exactly once. */
export function lockStructureBlocks(workspace: Blockly.WorkspaceSvg) {
  for (const block of workspace.getBlocksByType('scenario_start', false)) {
    block.setDeletable(false);
  }
  for (const block of workspace.getBlocksByType('scenario_settings', false)) {
    block.setDeletable(false);
    block.setMovable(false);
  }
}

/** Hide the long base-values rows so the rounds are visible first. */
export function collapseBaseValues(workspace: Blockly.WorkspaceSvg) {
  for (const block of workspace.getBlocksByType('scenario_settings', false)) {
    setBaseValuesVisible(block, false);
  }
}

/* ------------------------------------------------------------------------ *
 * Blockly workspace -> document
 * ------------------------------------------------------------------------ */

export interface SerializeResult {
  document: ScenarioDocument;
  /** Document path (as used in server errors) -> block id. */
  blockIds: Map<string, string>;
  errors: ValidationError[];
}

function children(block: Blockly.Block | null): Blockly.Block[] {
  const result: Blockly.Block[] = [];
  for (let b = block; b; b = b.getNextBlock()) {
    if (b.isEnabled()) result.push(b);
  }
  return result;
}

function collectBuildings(block: Blockly.Block | null): string[] {
  if (!block) return [];
  switch (block.type) {
    case 'building':
      return [block.getFieldValue('BUILDING')];
    case 'city_centers':
      return [...CITY_CENTERS];
    case 'building_join':
      return [...collectBuildings(block.getInputTargetBlock('A')), ...collectBuildings(block.getInputTargetBlock('B'))];
  }
  return [];
}

function uniqueBuildings(block: Blockly.Block | null): string[] {
  return Array.from(new Set(collectBuildings(block)));
}

function imagePath(block: Blockly.Block): string {
  return (block.getField('IMAGE') as FieldSlideImage).getPath();
}

export function workspaceToDocument(workspace: Blockly.Workspace, name: string): SerializeResult {
  const blockIds = new Map<string, string>();
  const errors: ValidationError[] = [];
  const document: ScenarioDocument = {
    version: 1,
    name,
    settings: { building_consumptions: {}, source_productions: {} },
    steps: [],
  };

  const start = workspace.getBlocksByType('scenario_start', false)[0];
  const settingsBlock = start?.getNextBlock();
  if (!settingsBlock || settingsBlock.type !== 'scenario_settings') {
    errors.push({ path: 'settings', message: 'Chybí blok „Základní hodnoty“.' });
    return { document, blockIds, errors };
  }

  // Base values
  blockIds.set('settings', settingsBlock.id);
  for (const row of children(settingsBlock.getInputTargetBlock('VALUES'))) {
    if (row.type === 'base_consumption') {
      const building = row.getFieldValue('BUILDING');
      const path = `settings.building_consumptions.${building}`;
      if (document.settings.building_consumptions[building]) {
        errors.push({ path, message: 'Budova je v základních hodnotách vícekrát.' });
      }
      blockIds.set(path, row.id);
      document.settings.building_consumptions[building] = {
        day: [Number(row.getFieldValue('DAY_MIN')), Number(row.getFieldValue('DAY_MAX'))],
        night: [Number(row.getFieldValue('NIGHT_MIN')), Number(row.getFieldValue('NIGHT_MAX'))],
      };
    } else if (row.type === 'base_production') {
      const source = row.getFieldValue('SOURCE');
      const path = `settings.source_productions.${source}`;
      if (document.settings.source_productions[source]) {
        errors.push({ path, message: 'Zdroj je v základních hodnotách vícekrát.' });
      }
      blockIds.set(path, row.id);
      document.settings.source_productions[source] = [Number(row.getFieldValue('MIN')), Number(row.getFieldValue('MAX'))];
    }
  }

  // Steps
  for (const block of children(settingsBlock.getNextBlock())) {
    const index = document.steps.length;
    const path = `steps[${index}]`;
    blockIds.set(path, block.id);
    let step: ScenarioStep | null = null;

    switch (block.type) {
      case 'allow_production':
        step = { type: 'allow_production', source: block.getFieldValue('SOURCE') };
        break;
      case 'change_consumption':
      case 'set_consumption': {
        const buildings = uniqueBuildings(block.getInputTargetBlock('BUILDINGS'));
        if (!buildings.length) errors.push({ path: `${path}.buildings`, message: 'Vložte budovy.' });
        step = { type: block.type, buildings, day: Number(block.getFieldValue('DAY')), night: Number(block.getFieldValue('NIGHT')) };
        break;
      }
      case 'change_production':
        step = { type: 'change_production', source: block.getFieldValue('SOURCE'), min: Number(block.getFieldValue('MIN')), max: Number(block.getFieldValue('MAX')) };
        break;
      case 'round_day':
      case 'round_night': {
        const settings: RoundSetting[] = [];
        for (const s of children(block.getInputTargetBlock('SETTINGS'))) {
          const settingPath = `${path}.settings[${settings.length}]`;
          blockIds.set(settingPath, s.id);
          const setting = readSetting(s, settingPath, errors);
          if (setting) settings.push(setting);
        }
        step = { type: block.type === 'round_day' ? 'day' : 'night', name: (block.getFieldValue('NAME') || '').trim(), settings };
        break;
      }
      case 'slide': {
        const image = imagePath(block);
        if (!image) errors.push({ path: `${path}.image`, message: 'Vyberte obrázek snímku.' });
        step = { type: 'slide', image };
        break;
      }
      case 'slide_range': {
        const items = children(block.getInputTargetBlock('SLIDES'));
        const images = items.map(imagePath);
        items.forEach((item, i) => {
          blockIds.set(`${path}.images[${i}]`, item.id);
          if (!images[i]) errors.push({ path: `${path}.images[${i}]`, message: 'Vyberte obrázek snímku.' });
        });
        if (!images.length) errors.push({ path: `${path}.images`, message: 'Prezentace musí obsahovat alespoň jeden obrázek.' });
        step = { type: 'slide_range', images };
        break;
      }
    }
    if (step) document.steps.push(step);
  }

  if (!document.steps.some((s) => ['day', 'night', 'slide', 'slide_range'].includes(s.type))) {
    errors.push({ path: 'steps', message: 'Scénář musí obsahovat alespoň jedno kolo nebo snímek.' });
  }
  if (!name.trim()) {
    errors.push({ path: 'name', message: 'Zadejte název scénáře.' });
  }
  return { document, blockIds, errors };
}

function readSetting(block: Blockly.Block, path: string, errors: ValidationError[]): RoundSetting | null {
  if (block.type.startsWith('weather_')) {
    return { type: 'weather', weather: block.type.slice('weather_'.length) };
  }
  switch (block.type) {
    case 'outage':
      return { type: 'outage', source: block.getFieldValue('SOURCE') };
    case 'modifier_single':
    case 'modifier_multi': {
      const buildings = uniqueBuildings(block.getInputTargetBlock(block.type === 'modifier_single' ? 'BUILDING' : 'BUILDINGS'));
      if (!buildings.length) errors.push({ path: `${path}.buildings`, message: 'Vložte budovy.' });
      return { type: 'modifier', buildings, value: Number(block.getFieldValue('VALUE')) };
    }
    case 'set_round_consumption': {
      const buildings = uniqueBuildings(block.getInputTargetBlock('BUILDINGS'));
      if (!buildings.length) errors.push({ path: `${path}.buildings`, message: 'Vložte budovy.' });
      return { type: 'set_round_consumption', buildings, value: Number(block.getFieldValue('VALUE')) };
    }
    case 'buildings_comment': {
      const text = (block.getFieldValue('TEXT') || '').trim();
      if (!text) errors.push({ path: `${path}.text`, message: 'Komentář je prázdný.' });
      return { type: 'buildings_comment', text };
    }
    case 'coefficient':
      return { type: 'coefficient', source: block.getFieldValue('SOURCE'), value: Number(block.getFieldValue('VALUE')) };
  }
  return null;
}

/** Block id for a server error path: the deepest known prefix of the path. */
export function blockIdForPath(path: string, blockIds: Map<string, string>): string | undefined {
  let candidate = path;
  while (candidate) {
    const id = blockIds.get(candidate);
    if (id) return id;
    const cut = Math.max(candidate.lastIndexOf('.'), candidate.lastIndexOf('['));
    if (cut <= 0) break;
    candidate = candidate.slice(0, cut);
  }
  return undefined;
}
