import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { FormsModule } from '@angular/forms';

const SOURCE_NAMES = ['COAL', 'GAS', 'NUCLEAR', 'HYDRO', 'HYDRO_STORAGE', 'WIND', 'PHOTOVOLTAIC', 'BATTERY'];
const SOURCE_DISPLAY = ['Uhelné', 'Plynové', 'Jaderné', 'Vodní', 'Přečerpávací', 'Větrné', 'Fotovoltaické', 'Bateriové'];

const BUILDING_DISPLAYS = [
  'Centrum města', 'Centrum města A', 'Centrum města B', 'Centrum města C',
  'Centrum města D', 'Centrum města E', 'Centrum města F', 'Továrna',
  'Stadion', 'Nemocnice', 'Univerzita', 'Letiště',
  'Obchodní centrum', 'Technologické centrum', 'Farma',
  'Menší obytná čtvrť', 'Větší obytná čtvrť', 'Škola'
];

const BUILDING_ENUM_NAMES = [
  'CITY_CENTER', 'CITY_CENTER_A', 'CITY_CENTER_B', 'CITY_CENTER_C',
  'CITY_CENTER_D', 'CITY_CENTER_E', 'CITY_CENTER_F', 'FACTORY',
  'STADIUM', 'HOSPITAL', 'UNIVERSITY', 'AIRPORT',
  'SHOPPING_MALL', 'TECHNOLOGY_CENTER', 'FARM',
  'LIVING_QUARTER_SMALL', 'LIVING_QUARTER_LARGE', 'SCHOOL'
];

@Component({
  selector: 'app-production-manager',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="overlay" *ngIf="visible" (click)="close()">
      <div class="modal" (click)="$event.stopPropagation()">
        <h2>Upravit výrobu a spotřebu</h2>
        <div class="tabs">
          <button [class.active]="activeTab === 'production'" (click)="activeTab = 'production'">
            Výrobní zdroje
          </button>
          <button [class.active]="activeTab === 'consumption'" (click)="activeTab = 'consumption'">
            Spotřeba budov
          </button>
        </div>

        <div *ngIf="activeTab === 'production'" class="tab-content">
          <div class="row-header">
            <span>Zdroj</span>
            <span>Min (MW)</span>
            <span>Max (MW)</span>
            <span>Přepsat</span>
          </div>
          <div *ngFor="let item of productionItems" class="row">
            <span class="label">{{ item.display }}</span>
            <input type="number" [(ngModel)]="item.min" [disabled]="!item.overridden" step="10">
            <input type="number" [(ngModel)]="item.max" [disabled]="!item.overridden" step="10">
            <input type="checkbox" [(ngModel)]="item.overridden">
          </div>
          <div class="actions">
            <button (click)="resetProduction()">Reset na výchozí</button>
          </div>
        </div>

        <div *ngIf="activeTab === 'consumption'" class="tab-content">
          <div class="row-header">
            <span>Budova</span>
            <span>Spotřeba (MW)</span>
            <span>Přepsat</span>
          </div>
          <div *ngFor="let item of consumptionItems" class="row">
            <span class="label">{{ item.display }}</span>
            <input type="number" [(ngModel)]="item.value" [disabled]="!item.overridden" step="10">
            <input type="checkbox" [(ngModel)]="item.overridden">
          </div>
          <div class="actions">
            <button (click)="resetConsumption()">Reset na výchozí</button>
          </div>
        </div>

        <div class="global-actions">
          <button (click)="save()" [disabled]="isSaving">Uložit vše</button>
          <button (click)="close()">Zavřít</button>
        </div>
        <div *ngIf="saveMessage" class="message">{{ saveMessage }}</div>
      </div>
    </div>
  `,
  styles: [
    `.overlay { position: fixed; top:0; left:0; width:100%; height:100%; background: rgba(0,0,0,0.7); z-index:10000; display:flex; justify-content:center; align-items:center; }`,
    `.modal { background: white; padding:20px; border-radius:8px; max-width:600px; width:90%; max-height:90%; overflow-y:auto; }`,
    `.tabs { display: flex; gap: 10px; margin-bottom: 20px; border-bottom: 1px solid #ddd; }`,
    `.tabs button { padding: 8px 16px; background: none; border: none; border-bottom: 3px solid transparent; cursor: pointer; font-weight: bold; }`,
    `.tabs button.active { border-bottom-color: #3498db; color: #3498db; }`,
    `.tab-content { margin-bottom: 20px; }`,
    `.row-header, .row { display: grid; grid-template-columns: 2fr 1fr 1fr 0.8fr; gap: 8px; align-items: center; padding: 4px 0; }`,
    `.row-header { font-weight: bold; border-bottom: 1px solid #ccc; }`,
    `.row { border-bottom: 1px solid #eee; }`,
    `.row input[type="number"] { width: 70px; padding: 4px; border: 1px solid #ccc; border-radius: 4px; }`,
    `.row input[type="checkbox"] { width: 20px; height: 20px; }`,
    `.label { font-weight: 500; }`,
    `.actions { margin-top: 10px; }`,
    `.actions button { padding: 4px 12px; background: #f0f0f0; border: 1px solid #ccc; border-radius: 4px; cursor: pointer; }`,
    `.global-actions { display: flex; gap: 10px; justify-content: flex-end; margin-top: 15px; }`,
    `.global-actions button { padding: 8px 20px; border-radius: 4px; border: none; cursor: pointer; }`,
    `.global-actions button:first-child { background: #27ae60; color: white; }`,
    `.global-actions button:first-child:hover { background: #219a52; }`,
    `.global-actions button:last-child { background: #e74c3c; color: white; }`,
    `.global-actions button:last-child:hover { background: #c0392b; }`,
    `.global-actions button:disabled { opacity: 0.6; cursor: not-allowed; }`,
    `.message { margin-top: 10px; color: #27ae60; text-align: center; }`
  ]
})
export class ProductionManagerComponent {
  visible = false;
  activeTab: 'production' | 'consumption' = 'production';
  isSaving = false;
  saveMessage = '';

  productionItems: {
    name: string;
    display: string;
    baseMin: number;
    baseMax: number;
    min: number;
    max: number;
    overridden: boolean;
  }[] = [];

  consumptionItems: {
    enumName: string;
    display: string;
    baseValue: number;
    value: number;
    overridden: boolean;
  }[] = [];

  constructor(private http: HttpClient) {}

  show() {
    this.visible = true;
    this.loadData();
  }

  close() {
    this.visible = false;
    this.saveMessage = '';
  }

  loadData() {
    Promise.all([
      this.http.get('/coreapi/lecturer/production_overrides').toPromise(),
      this.http.get('/coreapi/lecturer/consumption_overrides').toPromise()
    ]).then(([prodOver, consOver]: any) => {
      return Promise.all([
        this.http.get('/coreapi/lecturer/current_production_ranges').toPromise(),
        this.http.get('/coreapi/lecturer/current_consumption_values').toPromise()
      ]).then(([prodBase, consBase]: any) => {
        this.productionItems = SOURCE_NAMES.map((name, idx) => {
          const base = prodBase[name] || { min: 0, max: 0 };
          const override = prodOver[name] || null;
          return {
            name: name,
            display: SOURCE_DISPLAY[idx] || name,
            baseMin: base.min,
            baseMax: base.max,
            min: override ? override.min : base.min,
            max: override ? override.max : base.max,
            overridden: !!override
          };
        });

        this.consumptionItems = BUILDING_ENUM_NAMES.map((enumName, idx) => {
          const base = consBase[enumName] || 0;
          const override = consOver[enumName];
          return {
            enumName: enumName,
            display: BUILDING_DISPLAYS[idx] || enumName,
            baseValue: base,
            value: override !== undefined ? override : base,
            overridden: override !== undefined
          };
        });
      });
    }).catch(err => {
      console.error('Failed to load data:', err);
    });
  }

  resetProduction() {
    this.productionItems.forEach(item => {
      item.min = item.baseMin;
      item.max = item.baseMax;
      item.overridden = false;
    });
  }

  resetConsumption() {
    this.consumptionItems.forEach(item => {
      item.value = item.baseValue;
      item.overridden = false;
    });
  }

  save() {
    const errors: string[] = [];

    for (const item of this.productionItems) {
      if (item.overridden) {
        const minNum = Number(item.min);
        const maxNum = Number(item.max);
        // Check for null/undefined (Angular sets these on invalid input) and NaN
        if (item.min == null || isNaN(minNum)) {
          errors.push(`"${item.display}" musí mít číselnou hodnotu (min).`);
        } else if (item.max == null || isNaN(maxNum)) {
          errors.push(`"${item.display}" musí mít číselnou hodnotu (max).`);
        } else if (minNum > maxNum) {
          errors.push(`"${item.display}" – minimální hodnota nesmí být větší než maximální.`);
        }
      }
    }

    for (const item of this.consumptionItems) {
      if (item.overridden) {
        const valNum = Number(item.value);
        if (item.value == null || isNaN(valNum)) {
          errors.push(`"${item.display}" musí mít číselnou hodnotu.`);
        }
      }
    }

    if (errors.length > 0) {
      this.saveMessage = 'Chyba: ' + errors.join(' ');
      setTimeout(() => this.saveMessage = '', 5000);
      return;
    }

    this.isSaving = true;
    this.saveMessage = '';

    const prodPayload: any = {};
    for (const item of this.productionItems) {
      if (item.overridden) {
        prodPayload[item.name] = { min: item.min, max: item.max };
      }
    }

    const consPayload: any = {};
    for (const item of this.consumptionItems) {
      if (item.overridden) {
        consPayload[item.enumName] = item.value;
      }
    }

    Promise.all([
      this.http.post('/coreapi/lecturer/production_overrides', prodPayload).toPromise(),
      this.http.post('/coreapi/lecturer/consumption_overrides', consPayload).toPromise()
    ]).then(() => {
      this.isSaving = false;
      this.saveMessage = 'Změny uloženy.';
      this.loadData();
      setTimeout(() => this.saveMessage = '', 3000);
    }).catch(err => {
      this.isSaving = false;
      this.saveMessage = 'Chyba při ukládání.';
      console.error(err);
      setTimeout(() => this.saveMessage = '', 3000);
    });
  }
}