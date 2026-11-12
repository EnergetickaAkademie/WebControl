import * as Blockly from 'blockly/core';
import { BUILDINGS, SOURCES, WEATHER, slideUrl } from './scenario-model';

/*
 * Connection types (Blockly "checks") enforce where blocks may go:
 *   Settings    – only the "Základní hodnoty" clamp fits under the start block
 *   Step        – top-level stack: rounds, slides, allow production, permanent changes
 *   BaseValue   – rows inside "Základní hodnoty"
 *   DaySetting / NightSetting – blocks inside Den / Noc clamps
 *   SlideItem   – images inside a Prezentace clamp
 *   Building / BuildingList – reporter (data) blocks
 */

const ROUND_SETTING = ['DaySetting', 'NightSetting'];
const ANY_BUILDINGS = ['Building', 'BuildingList'];

const SLIDE_PLACEHOLDER =
  'data:image/svg+xml;charset=utf-8,' +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="128" height="72" viewBox="0 0 128 72">' +
      '<rect x="1" y="1" width="126" height="70" rx="4" fill="#ffffff" stroke="#adb5bd" stroke-dasharray="4 3"/>' +
      '<text x="64" y="41" text-anchor="middle" font-family="Arial" font-size="11" fill="#6c757d">Vybrat obrázek</text>' +
      '</svg>',
  );

const SLIDE_URL_PREFIX = '/coreapi/slide_file/';

/** Called when a slide thumbnail is clicked; resolves to the chosen path or null. */
export type ImagePicker = (currentPath: string) => Promise<string | null>;
let imagePicker: ImagePicker | null = null;
export function setImagePicker(picker: ImagePicker | null) {
  imagePicker = picker;
}

/** Clickable thumbnail whose value is the slide URL (so undo/redo work). */
export class FieldSlideImage extends Blockly.FieldImage {
  override SERIALIZABLE = true;

  constructor(path = '') {
    super(path ? slideUrl(path) : SLIDE_PLACEHOLDER, 128, 72, 'Snímek', (field) => {
      const slideField = field as FieldSlideImage;
      if (!imagePicker) return;
      imagePicker(slideField.getPath()).then((chosen) => {
        if (chosen !== null) slideField.setPath(chosen);
      });
    });
  }

  getPath(): string {
    const value = this.getValue() || '';
    if (!value.startsWith(SLIDE_URL_PREFIX)) return '';
    return value.slice(SLIDE_URL_PREFIX.length).split('/').map(decodeURIComponent).join('/');
  }

  setPath(path: string) {
    this.setValue(path ? slideUrl(path) : SLIDE_PLACEHOLDER);
  }

  static pathToValue(path: string): string {
    return path ? slideUrl(path) : SLIDE_PLACEHOLDER;
  }
}

function sourceDropdown() {
  return { type: 'field_dropdown', name: 'SOURCE', options: SOURCES };
}

function buildingDropdown() {
  return { type: 'field_dropdown', name: 'BUILDING', options: BUILDINGS };
}

function powerField(name: string, value = 0) {
  return { type: 'field_number', name, value, min: -100000, max: 100000, precision: 1 };
}

function icon(src: string, size = 22) {
  return { type: 'field_image', src, width: size, height: size, alt: '' };
}

const JSON_BLOCKS: any[] = [
  // ---- structure ---------------------------------------------------------
  {
    type: 'scenario_start',
    message0: 'Začátek scénáře',
    nextStatement: 'Settings',
    style: 'start_blocks',
    tooltip: 'Scénář začíná zde. Bloky, které nejsou připojené pod tento blok, se nepoužijí.',
  },
  {
    type: 'base_consumption',
    message0: 'spotřeba %1 den %2 – %3 noc %4 – %5 MW',
    args0: [buildingDropdown(), powerField('DAY_MIN', 100), powerField('DAY_MAX', 100), powerField('NIGHT_MIN', 50), powerField('NIGHT_MAX', 50)],
    previousStatement: 'BaseValue',
    nextStatement: 'BaseValue',
    style: 'settings_blocks',
    tooltip: 'Spotřeba budovy ve dne a v noci. Rozsah min–max znamená náhodnou hodnotu při startu hry.',
  },
  {
    type: 'base_production',
    message0: 'výkon %1 min %2 max %3 MW',
    args0: [sourceDropdown(), powerField('MIN', 0), powerField('MAX', 100)],
    previousStatement: 'BaseValue',
    nextStatement: 'BaseValue',
    style: 'settings_blocks',
    tooltip: 'Minimální a maximální výkon zdroje.',
  },

  // ---- rounds (clamps) ---------------------------------------------------
  {
    type: 'round_day',
    message0: '%1 Den %2',
    args0: [icon('/icons/DASH_sunny.svg'), { type: 'field_input', name: 'NAME', text: '' }],
    message1: '%1',
    args1: [{ type: 'input_statement', name: 'SETTINGS', check: 'DaySetting' }],
    previousStatement: 'Step',
    nextStatement: 'Step',
    style: 'day_blocks',
    tooltip: 'Denní herní kolo. Do pole napište název kola.',
  },
  {
    type: 'round_night',
    message0: '%1 Noc %2',
    args0: [icon('/icons/DASH_moon.svg'), { type: 'field_input', name: 'NAME', text: '' }],
    message1: '%1',
    args1: [{ type: 'input_statement', name: 'SETTINGS', check: 'NightSetting' }],
    previousStatement: 'Step',
    nextStatement: 'Step',
    style: 'night_blocks',
    tooltip: 'Noční herní kolo. Do pole napište název kola.',
  },
  {
    type: 'slide_range',
    message0: 'Prezentace',
    message1: '%1',
    args1: [{ type: 'input_statement', name: 'SLIDES', check: 'SlideItem' }],
    previousStatement: 'Step',
    nextStatement: 'Step',
    style: 'slide_blocks',
    tooltip: 'Několik snímků za sebou. Pořadí změníte přetažením.',
  },

  // ---- between rounds ----------------------------------------------------
  {
    type: 'allow_production',
    message0: 'povolit výrobu %1',
    args0: [sourceDropdown()],
    previousStatement: 'Step',
    nextStatement: 'Step',
    style: 'script_blocks',
    tooltip: 'Od tohoto místa mohou týmy používat zvolený zdroj.',
  },
  {
    type: 'change_consumption',
    message0: 'trvalá změna spotřeby %1 o %2 MW ve dne a %3 MW v noci',
    args0: [{ type: 'input_value', name: 'BUILDINGS', check: ANY_BUILDINGS }, powerField('DAY', 100), powerField('NIGHT', 100)],
    inputsInline: true,
    previousStatement: 'Step',
    nextStatement: 'Step',
    style: 'script_blocks',
    tooltip: 'Trvale zvýší (nebo sníží) spotřebu budov od dalšího kola.',
  },

  {
    type: 'set_consumption',
    message0: 'nastavit spotřebu %1 na %2 MW ve dne a %3 MW v noci',
    args0: [{ type: 'input_value', name: 'BUILDINGS', check: ANY_BUILDINGS }, powerField('DAY', 500), powerField('NIGHT', 300)],
    inputsInline: true,
    previousStatement: 'Step',
    nextStatement: 'Step',
    style: 'script_blocks',
    tooltip: 'Od dalšího kola bude mít budova přesně tuto spotřebu (bez ohledu na předchozí změny).',
  },
  {
    type: 'change_production',
    message0: 'trvalá změna výkonu %1 o min %2 MW a max %3 MW',
    args0: [sourceDropdown(), powerField('MIN', 0), powerField('MAX', 100)],
    previousStatement: 'Step',
    nextStatement: 'Step',
    style: 'script_blocks',
    tooltip: 'Od dalšího kola posune minimální a maximální výkon zdroje o zadané hodnoty.',
  },

  // ---- inside rounds -----------------------------------------------------
  {
    type: 'outage',
    message0: 'výpadek %1',
    args0: [sourceDropdown()],
    previousStatement: ROUND_SETTING,
    nextStatement: ROUND_SETTING,
    style: 'outage_blocks',
    tooltip: 'Zdroj v tomto kole nevyrábí.',
  },
  {
    type: 'modifier_single',
    message0: 'změna spotřeby budovy %1 o %2 MW',
    args0: [{ type: 'input_value', name: 'BUILDING', check: 'Building' }, powerField('VALUE', 100)],
    inputsInline: true,
    previousStatement: ROUND_SETTING,
    nextStatement: ROUND_SETTING,
    style: 'modifier_blocks',
    tooltip: 'Změna spotřeby jedné budovy pouze v tomto kole.',
  },
  {
    type: 'modifier_multi',
    message0: 'změna spotřeby budov %1 o %2 MW',
    args0: [{ type: 'input_value', name: 'BUILDINGS', check: 'BuildingList' }, powerField('VALUE', 100)],
    inputsInline: true,
    previousStatement: ROUND_SETTING,
    nextStatement: ROUND_SETTING,
    style: 'modifier_blocks',
    tooltip: 'Změna spotřeby více budov (např. center měst) pouze v tomto kole.',
  },
  {
    type: 'set_round_consumption',
    message0: 'nastavit spotřebu %1 v tomto kole na %2 MW',
    args0: [{ type: 'input_value', name: 'BUILDINGS', check: ANY_BUILDINGS }, powerField('VALUE', 500)],
    inputsInline: true,
    previousStatement: ROUND_SETTING,
    nextStatement: ROUND_SETTING,
    style: 'modifier_blocks',
    tooltip: 'Spotřeba budov bude v tomto kole přesně tato hodnota.',
  },
  {
    type: 'buildings_comment',
    message0: 'komentář k budovám %1',
    args0: [{ type: 'field_input', name: 'TEXT', text: '' }],
    previousStatement: ROUND_SETTING,
    nextStatement: ROUND_SETTING,
    style: 'comment_blocks',
    tooltip: 'Text zobrazený týmům u budov, např. „Můžete postavit až 4 malé stavby“.',
  },
  {
    type: 'coefficient',
    message0: 'koeficient výroby %1 = %2',
    args0: [sourceDropdown(), { type: 'field_number', name: 'VALUE', value: 1, min: 0, max: 100, precision: 0.01 }],
    previousStatement: ROUND_SETTING,
    nextStatement: ROUND_SETTING,
    style: 'comment_blocks',
    tooltip: 'Násobí výkon zdroje v tomto kole (1 = plný výkon).',
  },

  // ---- data (reporters) --------------------------------------------------
  {
    type: 'building',
    message0: '%1',
    args0: [buildingDropdown()],
    output: 'Building',
    style: 'data_blocks',
    tooltip: 'Budova',
  },
  {
    type: 'city_centers',
    message0: 'centra měst A–F',
    output: 'BuildingList',
    style: 'data_blocks',
    tooltip: 'Všech šest center měst.',
  },
  {
    type: 'building_join',
    message0: '%1 a %2',
    args0: [
      { type: 'input_value', name: 'A', check: ANY_BUILDINGS },
      { type: 'input_value', name: 'B', check: ANY_BUILDINGS },
    ],
    inputsInline: true,
    output: 'BuildingList',
    style: 'data_blocks',
    tooltip: 'Seznam budov. Bloky lze do sebe vkládat pro delší seznamy.',
  },
];

// Weather blocks, one per weather type. "slunečno" only fits into Den.
for (const weather of WEATHER) {
  const check = weather.dayOnly ? ['DaySetting'] : ROUND_SETTING;
  JSON_BLOCKS.push({
    type: `weather_${weather.name}`,
    message0: '%1 %2',
    args0: [icon(weather.icon), { type: 'field_label', text: weather.label }],
    previousStatement: check,
    nextStatement: check,
    style: 'weather_blocks',
    tooltip: weather.dayOnly ? 'Počasí (pouze ve dne).' : 'Počasí v tomto kole.',
  });
}

let defined = false;

export function defineBlocks() {
  if (defined) return;
  defined = true;
  Blockly.common.defineBlocksWithJsonArray(JSON_BLOCKS);

  Blockly.Blocks['slide'] = {
    init(this: Blockly.Block) {
      this.appendDummyInput().appendField('Snímek').appendField(new FieldSlideImage(), 'IMAGE');
      this.setPreviousStatement(true, 'Step');
      this.setNextStatement(true, 'Step');
      this.setStyle('slide_blocks');
      this.setTooltip('Jeden snímek. Kliknutím na náhled vyberete nebo nahrajete obrázek.');
    },
  };

  Blockly.Blocks['slide_item'] = {
    init(this: Blockly.Block) {
      this.appendDummyInput().appendField('obrázek').appendField(new FieldSlideImage(), 'IMAGE');
      this.setPreviousStatement(true, 'SlideItem');
      this.setNextStatement(true, 'SlideItem');
      this.setStyle('slide_blocks');
      this.setTooltip('Snímek prezentace. Kliknutím na náhled vyberete nebo nahrajete obrázek.');
    },
  };

  Blockly.Blocks['scenario_settings'] = {
    init(this: Blockly.BlockSvg) {
      const toggle = new Blockly.FieldLabel('▾ skrýt');
      this.appendDummyInput('HEADER')
        .appendField('Základní hodnoty')
        .appendField(toggle, 'TOGGLE');
      this.appendStatementInput('VALUES').setCheck('BaseValue');
      this.setPreviousStatement(true, 'Settings');
      this.setNextStatement(true, 'Step');
      this.setStyle('settings_blocks');
      this.setTooltip('Výchozí spotřeba budov a výkony zdrojů na začátku hry. Kliknutím na „zobrazit“ je upravíte.');
      // The label itself toggles too (labels are not clickable by default).
      (toggle as any).isClickable = () => true;
      (toggle as any).showEditor_ = () => setBaseValuesVisible(this, !this.getInput('VALUES')!.isVisible());
    },
  };

  // Show long texts (comments, round names) in full instead of "…".
  for (const type of Object.keys(Blockly.Blocks)) {
    const definition = Blockly.Blocks[type];
    if (!definition?.init || (definition as any).__enakPatched) continue;
    const init = definition.init;
    definition.init = function (this: Blockly.Block) {
      init.call(this);
      for (const input of this.inputList) {
        for (const field of input.fieldRow) {
          field.maxDisplayLength = 200;
        }
      }
    };
    (definition as any).__enakPatched = true;
  }

  // A chain of setting blocks could smuggle "slunečno" into a Noc clamp;
  // kick it out again when that happens.
  const sunny = Blockly.Blocks['weather_SUNNY'];
  const originalInit = sunny.init;
  sunny.init = function (this: Blockly.BlockSvg) {
    originalInit.call(this);
    this.setOnChange(function (this: Blockly.BlockSvg, event: Blockly.Events.Abstract) {
      if (event.type !== Blockly.Events.BLOCK_MOVE || this.workspace.isDragging() || this.isInFlyout) return;
      let parent = this.getSurroundParent();
      if (parent?.type === 'round_night') {
        this.unplug(true);
        this.bumpNeighbours();
        this.setWarningText('Slunečno lze použít jen ve dne.');
      } else {
        this.setWarningText(null);
      }
    });
  };
}

/** Show or hide the rows inside "Základní hodnoty". */
export function setBaseValuesVisible(block: Blockly.Block, visible: boolean) {
  const input = block.getInput('VALUES');
  if (!input) return;
  const rows = block.getInputTargetBlock('VALUES') ? countRows(block.getInputTargetBlock('VALUES')) : 0;
  input.setVisible(visible);
  block.setFieldValue(visible ? '▾ skrýt' : `▸ zobrazit (${rows})`, 'TOGGLE');
  if (block instanceof Blockly.BlockSvg && block.rendered) {
    block.render();
    block.bumpNeighbours();
  }
}

function countRows(first: Blockly.Block | null): number {
  let count = 0;
  for (let b = first; b; b = b.getNextBlock()) count++;
  return count;
}

export const ENAK_THEME = Blockly.Theme.defineTheme('enak', {
  name: 'enak',
  base: Blockly.Themes.Classic,
  startHats: false,
  blockStyles: {
    start_blocks: { colourPrimary: '#495057', colourSecondary: '#6c757d', colourTertiary: '#343a40', hat: 'cap' },
    settings_blocks: { colourPrimary: '#7f8c8d', colourSecondary: '#95a5a6', colourTertiary: '#6c7a7b', hat: '' },
    day_blocks: { colourPrimary: '#f0a830', colourSecondary: '#fbb03b', colourTertiary: '#c98a1f', hat: '' },
    night_blocks: { colourPrimary: '#2c3e50', colourSecondary: '#3d5166', colourTertiary: '#1f2d3a', hat: '' },
    slide_blocks: { colourPrimary: '#4a7fb5', colourSecondary: '#6a98c6', colourTertiary: '#386491', hat: '' },
    script_blocks: { colourPrimary: '#27ae60', colourSecondary: '#52be80', colourTertiary: '#1e8449', hat: '' },
    weather_blocks: { colourPrimary: '#5aa9d6', colourSecondary: '#85c1e3', colourTertiary: '#3f8dbb', hat: '' },
    outage_blocks: { colourPrimary: '#e74c3c', colourSecondary: '#ec7063', colourTertiary: '#c0392b', hat: '' },
    modifier_blocks: { colourPrimary: '#d35400', colourSecondary: '#e67e22', colourTertiary: '#b84700', hat: '' },
    comment_blocks: { colourPrimary: '#8e7cc3', colourSecondary: '#a597d1', colourTertiary: '#6f5fa6', hat: '' },
    data_blocks: { colourPrimary: '#95a5a6', colourSecondary: '#b2bdbe', colourTertiary: '#7f8c8d', hat: '' },
  },
  categoryStyles: {
    rounds_category: { colour: '#f0a830' },
    settings_category: { colour: '#5aa9d6' },
    script_category: { colour: '#27ae60' },
    data_category: { colour: '#95a5a6' },
    base_category: { colour: '#7f8c8d' },
  },
  componentStyles: {
    workspaceBackgroundColour: '#f8f9fa',
    toolboxBackgroundColour: '#ffffff',
    toolboxForegroundColour: '#2c3e50',
    flyoutBackgroundColour: '#eef1f4',
    flyoutForegroundColour: '#2c3e50',
    flyoutOpacity: 1,
    scrollbarColour: '#ced4da',
    scrollbarOpacity: 0.8,
    insertionMarkerColour: '#2c3e50',
    insertionMarkerOpacity: 0.3,
  },
  fontStyle: { family: "'DINPro-Regular', Arial, sans-serif", weight: 'normal', size: 11 },
});

const cityCenters = { block: { type: 'city_centers' } };
const oneBuilding = { block: { type: 'building', fields: { BUILDING: 'STADIUM' } } };

export const TOOLBOX = {
  kind: 'categoryToolbox',
  contents: [
    {
      kind: 'category',
      name: 'Kola',
      categorystyle: 'rounds_category',
      contents: [
        { kind: 'block', type: 'round_day', fields: { NAME: 'Den' } },
        { kind: 'block', type: 'round_night', fields: { NAME: 'Noc' } },
        { kind: 'block', type: 'slide' },
        { kind: 'block', type: 'slide_range', inputs: { SLIDES: { block: { type: 'slide_item' } } } },
        { kind: 'block', type: 'slide_item' },
      ],
    },
    {
      kind: 'category',
      name: 'Nastavení kola',
      categorystyle: 'settings_category',
      contents: [
        ...WEATHER.map((w) => ({ kind: 'block', type: `weather_${w.name}` })),
        { kind: 'sep', gap: 24 },
        { kind: 'block', type: 'outage', fields: { SOURCE: 'GAS' } },
        { kind: 'block', type: 'modifier_single', inputs: { BUILDING: oneBuilding } },
        { kind: 'block', type: 'modifier_multi', inputs: { BUILDINGS: cityCenters } },
        { kind: 'block', type: 'set_round_consumption', inputs: { BUILDINGS: oneBuilding } },
        { kind: 'block', type: 'buildings_comment' },
        { kind: 'block', type: 'coefficient' },
      ],
    },
    {
      kind: 'category',
      name: 'Mezi koly',
      categorystyle: 'script_category',
      contents: [
        { kind: 'block', type: 'allow_production' },
        { kind: 'block', type: 'change_consumption', inputs: { BUILDINGS: cityCenters } },
        { kind: 'block', type: 'set_consumption', inputs: { BUILDINGS: oneBuilding } },
        { kind: 'block', type: 'change_production', fields: { SOURCE: 'COAL' } },
      ],
    },
    {
      kind: 'category',
      name: 'Budovy',
      categorystyle: 'data_category',
      contents: [
        { kind: 'block', type: 'building' },
        { kind: 'block', type: 'city_centers' },
        { kind: 'block', type: 'building_join' },
      ],
    },
    {
      kind: 'category',
      name: 'Základní hodnoty',
      categorystyle: 'base_category',
      contents: [
        { kind: 'block', type: 'base_consumption' },
        { kind: 'block', type: 'base_production' },
      ],
    },
  ],
};
