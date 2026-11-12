import {
  AfterViewInit, Component, ElementRef, HostListener, NgZone, OnDestroy, ViewChild, ViewEncapsulation,
} from '@angular/core';
import { CommonModule, Location } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import * as Blockly from 'blockly/core';
import * as BlocklyCs from 'blockly/msg/cs';
import { AuthService } from '../../services/auth.service';
import { ENAK_THEME, TOOLBOX, defineBlocks, setImagePicker } from './blocks';
import { ImagePickerComponent } from './image-picker.component';
import { ScenarioDocument, ScenarioListItem, ValidationError } from './scenario-model';
import { blockIdForPath, documentToWorkspace, workspaceToDocument } from './serializer';

@Component({
  selector: 'app-scenario-editor',
  standalone: true,
  imports: [CommonModule, FormsModule, ImagePickerComponent],
  templateUrl: './scenario-editor.html',
  styleUrls: ['./scenario-editor.css'],
  // Blockly renders outside Angular's view; its toolbox needs global styles.
  encapsulation: ViewEncapsulation.None,
})
export class ScenarioEditorComponent implements AfterViewInit, OnDestroy {
  @ViewChild('blocklyHost', { static: true }) blocklyHost!: ElementRef<HTMLDivElement>;
  @ViewChild(ImagePickerComponent, { static: true }) imagePicker!: ImagePickerComponent;

  /** Stored custom scenario id ("custom:..."), null for a new scenario. */
  scenarioId: string | null = null;
  name = '';
  templates: ScenarioListItem[] = [];
  selectedTemplate = '';

  isLoading = true;
  isSaving = false;
  dirty = false;
  errors: ValidationError[] = [];
  message = '';

  private workspace: Blockly.WorkspaceSvg | null = null;
  private blockIds = new Map<string, string>();
  private warnedBlocks: string[] = [];
  /** Serialized document as last loaded/saved; null = always unsaved. */
  private baseline: string | null = null;

  constructor(
    private authService: AuthService,
    private route: ActivatedRoute,
    private router: Router,
    private location: Location,
    private zone: NgZone,
  ) {}

  async ngAfterViewInit() {
    Blockly.setLocale(BlocklyCs as any);
    defineBlocks();
    setImagePicker((current) => this.zone.run(() => this.imagePicker.open(current)));

    // Measure block text with the app font, not the fallback.
    try {
      await document.fonts.load("11px 'DINPro-Regular'");
    } catch {
      /* fall back to Arial */
    }

    this.zone.runOutsideAngular(() => {
      this.workspace = Blockly.inject(this.blocklyHost.nativeElement, {
        toolbox: TOOLBOX,
        theme: ENAK_THEME,
        renderer: 'zelos',
        trashcan: true,
        grid: { spacing: 24, length: 2, colour: '#dee2e6', snap: true },
        zoom: { controls: true, wheel: true, startScale: 0.75, maxScale: 2, minScale: 0.3 },
        move: { scrollbars: true, drag: true, wheel: false },
      });
      this.workspace.addChangeListener(Blockly.Events.disableOrphans);
      this.workspace.addChangeListener((event) => this.onWorkspaceChange(event));
    });

    this.loadTemplates();
    const id = this.route.snapshot.paramMap.get('id');
    try {
      if (id) {
        const res = await firstValueFrom(this.authService.getScenarioDocument(id));
        if (res.builtin) {
          // Built-ins are read-only: open them as a template for a new scenario.
          this.applyDocument({ ...res.document, name: `${res.document.name} (kopie)` });
        } else {
          this.scenarioId = id;
          this.applyDocument(res.document);
        }
      } else {
        const res = await firstValueFrom(this.authService.getScenarioDefaults());
        this.applyDocument(res.document);
      }
    } catch (err) {
      console.error('Failed to load scenario', err);
      this.message = 'Scénář se nepodařilo načíst.';
    } finally {
      this.isLoading = false;
    }
  }

  ngOnDestroy() {
    setImagePicker(null);
    this.workspace?.dispose();
    this.workspace = null;
  }

  @HostListener('window:beforeunload', ['$event'])
  onBeforeUnload(event: BeforeUnloadEvent) {
    if (this.dirty) {
      event.preventDefault();
    }
  }

  private onWorkspaceChange(event: Blockly.Events.Abstract) {
    if (event.isUiEvent) return;
    const dirty = this.isDifferentFromBaseline();
    if (dirty !== this.dirty) this.zone.run(() => (this.dirty = dirty));
  }

  private snapshot(): string {
    if (!this.workspace) return '';
    return JSON.stringify(workspaceToDocument(this.workspace, this.name.trim()).document);
  }

  private isDifferentFromBaseline(): boolean {
    return this.baseline === null || this.snapshot() !== this.baseline;
  }

  onNameChange() {
    this.dirty = this.isDifferentFromBaseline();
  }

  private loadTemplates() {
    this.authService.getScenarios().subscribe({
      next: (res: any) => {
        this.templates = (res?.scenarios || []).map((s: any) =>
          typeof s === 'string' ? { id: s, name: s, builtin: true } : { id: s.id, name: s.name, builtin: !!s.builtin },
        );
      },
      error: () => (this.templates = []),
    });
  }

  builtinTemplates() {
    return this.templates.filter((t) => t.builtin);
  }

  customTemplates() {
    return this.templates.filter((t) => !t.builtin && t.id !== this.scenarioId);
  }

  private applyDocument(doc: ScenarioDocument, dirtyAfter = false) {
    if (!this.workspace) return;
    this.name = doc.name || '';
    this.clearErrors();
    documentToWorkspace(doc, this.workspace);
    this.baseline = dirtyAfter ? null : this.snapshot();
    this.dirty = dirtyAfter;
  }

  async importTemplate() {
    if (!this.selectedTemplate) return;
    if (!confirm('Načtením šablony nahradíte všechny bloky v editoru. Pokračovat?')) return;
    try {
      const res = await firstValueFrom(this.authService.getScenarioDocument(this.selectedTemplate));
      const keepName = this.name.trim() && this.scenarioId;
      this.applyDocument({ ...res.document, name: keepName ? this.name : `${res.document.name} (kopie)` }, true);
      this.message = `Šablona „${res.document.name}“ byla načtena.`;
      this.selectedTemplate = '';
    } catch (err) {
      console.error('Failed to import template', err);
      this.message = 'Šablonu se nepodařilo načíst.';
    }
  }

  async save() {
    if (!this.workspace || this.isSaving) return;
    this.clearErrors();
    this.message = '';

    const result = workspaceToDocument(this.workspace, this.name.trim());
    this.blockIds = result.blockIds;
    if (result.errors.length) {
      this.showErrors(result.errors);
      return;
    }

    this.isSaving = true;
    try {
      if (this.scenarioId) {
        await firstValueFrom(this.authService.updateCustomScenario(this.scenarioId, result.document));
      } else {
        const res = await firstValueFrom(this.authService.createCustomScenario(result.document));
        this.scenarioId = res.id;
        // Update the URL without re-creating the editor.
        this.location.replaceState(`/scenario-editor/${encodeURIComponent(res.id)}`);
      }
      this.baseline = this.snapshot();
      this.dirty = false;
      this.message = 'Scénář byl uložen.';
    } catch (err: any) {
      const serverErrors: ValidationError[] = err?.error?.errors;
      if (Array.isArray(serverErrors) && serverErrors.length) {
        this.showErrors(serverErrors);
      } else {
        this.errors = [{ path: '', message: err?.error?.error || 'Uložení se nezdařilo.' }];
      }
    } finally {
      this.isSaving = false;
    }
  }

  back() {
    if (this.dirty && !confirm('Máte neuložené změny. Opravdu odejít?')) return;
    this.dirty = false;
    this.router.navigate(['/setup']);
  }

  focusError(error: ValidationError) {
    const id = blockIdForPath(error.path, this.blockIds);
    const block = id ? this.workspace?.getBlockById(id) : null;
    if (block && this.workspace) {
      this.workspace.centerOnBlock(block.id);
      block.select();
    }
  }

  private showErrors(errors: ValidationError[]) {
    this.errors = errors;
    for (const error of errors) {
      const id = blockIdForPath(error.path, this.blockIds);
      const block = id ? this.workspace?.getBlockById(id) : null;
      if (block) {
        block.setWarningText(error.message, 'validation');
        this.warnedBlocks.push(block.id);
      }
    }
    if (errors.length) this.focusError(errors[0]);
  }

  private clearErrors() {
    this.errors = [];
    for (const id of this.warnedBlocks) {
      this.workspace?.getBlockById(id)?.setWarningText(null, 'validation');
    }
    this.warnedBlocks = [];
  }
}
