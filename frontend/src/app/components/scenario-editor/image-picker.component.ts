import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AuthService } from '../../services/auth.service';
import { slideUrl } from './scenario-model';

type Tab = 'library' | 'uploads';

@Component({
  selector: 'app-image-picker',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="overlay" *ngIf="visible" (click)="cancel()">
      <div class="modal" (click)="$event.stopPropagation()">
        <h2>Vybrat snímek</h2>

        <div class="tabs">
          <button [class.active]="tab === 'library'" (click)="tab = 'library'">Knihovna prezentací</button>
          <button [class.active]="tab === 'uploads'" (click)="tab = 'uploads'">Moje nahrané obrázky</button>
          <label class="upload-button" [class.disabled]="isUploading">
            {{ isUploading ? 'Nahrávání...' : '+ Nahrát obrázek' }}
            <input type="file" accept="image/png,image/jpeg,image/gif,image/webp" (change)="onFileSelected($event)" [disabled]="isUploading" hidden>
          </label>
        </div>
        <div *ngIf="error" class="error">{{ error }}</div>

        <div *ngIf="isLoading" class="empty">Načítání...</div>
        <div *ngIf="!isLoading" class="grid">
          <button *ngFor="let path of currentList()" class="thumb" [class.selected]="path === selected"
                  (click)="selected = path" (dblclick)="choose(path)" [title]="path">
            <img [src]="url(path)" [alt]="path" loading="lazy">
            <span>{{ label(path) }}</span>
          </button>
          <div *ngIf="currentList().length === 0" class="empty">
            {{ tab === 'uploads' ? 'Zatím jste nenahráli žádný obrázek.' : 'Knihovna je prázdná.' }}
          </div>
        </div>

        <div class="actions">
          <button class="save-button" (click)="choose(selected)" [disabled]="!selected">Vybrat</button>
          <button class="close-button" (click)="cancel()">Zrušit</button>
        </div>
      </div>
    </div>
  `,
  styles: [
    `.overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.7); z-index: 10000; display: flex; justify-content: center; align-items: center; }`,
    `.modal { background: white; padding: 20px; border-radius: 8px; max-width: 900px; width: 92%; max-height: 90%; display: flex; flex-direction: column; font-family: 'DINPro-Regular', Arial, sans-serif; }`,
    `h2 { margin: 0 0 14px; color: #2c3e50; }`,
    `.tabs { display: flex; gap: 8px; align-items: center; margin-bottom: 12px; flex-wrap: wrap; }`,
    `.tabs button, .upload-button { padding: 8px 14px; border-radius: 4px; border: 1px solid #ced4da; background: #f8f9fa; cursor: pointer; font-family: inherit; font-size: 14px; }`,
    `.tabs button.active { background: #495057; color: white; border-color: #495057; }`,
    `.upload-button { margin-left: auto; background: #27ae60; color: white; border-color: #27ae60; }`,
    `.upload-button:hover { background: #219a52; }`,
    `.upload-button.disabled { opacity: 0.6; cursor: not-allowed; }`,
    `.grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: 10px; overflow-y: auto; min-height: 200px; padding: 2px; }`,
    `.thumb { display: flex; flex-direction: column; gap: 4px; padding: 6px; border: 2px solid #e9ecef; border-radius: 6px; background: #fff; cursor: pointer; font-family: inherit; }`,
    `.thumb:hover { border-color: #adb5bd; }`,
    `.thumb.selected { border-color: #27ae60; background: #eafaf1; }`,
    `.thumb img { width: 100%; aspect-ratio: 16 / 9; object-fit: contain; background: #f8f9fa; }`,
    `.thumb span { font-size: 12px; color: #495057; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }`,
    `.empty { color: #6c757d; padding: 20px; grid-column: 1 / -1; text-align: center; }`,
    `.error { color: #c0392b; margin-bottom: 10px; }`,
    `.actions { margin-top: 16px; display: flex; gap: 10px; justify-content: flex-end; }`,
    `.actions button { padding: 8px 16px; border-radius: 4px; border: none; cursor: pointer; font-family: inherit; }`,
    `.save-button { background: #27ae60; color: white; }`,
    `.save-button:hover { background: #219a52; }`,
    `.close-button { background: #e74c3c; color: white; }`,
    `.close-button:hover { background: #c0392b; }`,
    `.actions button:disabled { opacity: 0.6; cursor: not-allowed; }`,
  ],
})
export class ImagePickerComponent {
  visible = false;
  tab: Tab = 'library';
  library: string[] = [];
  uploads: string[] = [];
  selected = '';
  isLoading = false;
  isUploading = false;
  error = '';

  private resolve: ((value: string | null) => void) | null = null;

  constructor(private authService: AuthService) {}

  /** Open the picker; resolves to the chosen path, or null when cancelled. */
  open(current: string): Promise<string | null> {
    this.resolve?.(null);
    this.selected = current;
    this.tab = current.startsWith('uploads/') ? 'uploads' : 'library';
    this.error = '';
    this.visible = true;
    this.load();
    return new Promise((resolve) => (this.resolve = resolve));
  }

  private load() {
    this.isLoading = true;
    this.authService.getPresentationFiles().subscribe({
      next: (res: any) => {
        this.library = res.library || [];
        this.uploads = res.uploads || [];
        this.isLoading = false;
      },
      error: () => {
        this.error = 'Nepodařilo se načíst seznam obrázků.';
        this.isLoading = false;
      },
    });
  }

  currentList(): string[] {
    return this.tab === 'library' ? this.library : this.uploads;
  }

  url(path: string) {
    return slideUrl(path);
  }

  label(path: string) {
    return this.tab === 'uploads' ? 'Nahraný obrázek' : path;
  }

  onFileSelected(event: Event) {
    const inputEl = event.target as HTMLInputElement;
    const file = inputEl.files?.[0];
    inputEl.value = '';
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) {
      this.error = 'Soubor je příliš velký (max. 10 MB).';
      return;
    }
    this.isUploading = true;
    this.error = '';
    this.authService.uploadScenarioAsset(file).subscribe({
      next: (res: any) => {
        this.isUploading = false;
        this.uploads = [...this.uploads, res.path];
        this.tab = 'uploads';
        this.selected = res.path;
      },
      error: (err) => {
        this.isUploading = false;
        this.error = err?.error?.error || 'Nahrání se nezdařilo.';
      },
    });
  }

  choose(path: string) {
    if (!path) return;
    this.finish(path);
  }

  cancel() {
    this.finish(null);
  }

  private finish(value: string | null) {
    this.visible = false;
    const resolve = this.resolve;
    this.resolve = null;
    resolve?.(value);
  }
}
