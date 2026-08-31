import { Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { interval, Subscription, switchMap } from 'rxjs';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-firmware', standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './firmware.html', styleUrls: ['./firmware.css']
})
export class FirmwareComponent implements OnInit, OnDestroy {
  boards: any[] = [];
  releases: any[] = [];
  selectedVersion = '';
  selectedBoards = new Set<string>();
  loading = true;
  refreshing = false;
  gameActive = false;
  job: any = null;
  error = '';
  private poll?: Subscription;

  constructor(private auth: AuthService, private router: Router) {}

  ngOnInit(): void { this.refresh(); }
  ngOnDestroy(): void { this.poll?.unsubscribe(); }

  refresh(): void {
    this.refreshing = true;
    this.auth.getFirmwareBoards().subscribe({
      next: value => {
        this.boards = value.boards || [];
        this.selectedBoards.forEach(boardId => {
          const board = this.boards.find(item => item.board_id === boardId);
          if (!board || !this.eligible(board)) this.selectedBoards.delete(boardId);
        });
        this.gameActive = !!value.game_active;
        this.loading = false;
        this.refreshing = false;
      },
      error: err => { this.error = err?.error?.error || 'Firmware boards could not be loaded'; this.loading = false; this.refreshing = false; }
    });
    this.auth.getFirmwareReleases().subscribe({
      next: value => { this.releases = value.releases || []; this.selectedVersion = this.selectedVersion || this.latestStable()?.version || ''; },
      error: err => { this.error = err?.error?.error || 'Firmware releases could not be loaded'; }
    });
  }

  latestStable(): any { return this.releases.find(item => item.channel === 'stable' && !item.conflict); }
  selectedRelease(): any { return this.releases.find(item => item.version === this.selectedVersion); }
  get connectedBoardsCount(): number { return this.boards.filter(board => !!board.connected).length; }
  get availableBoardsCount(): number { return this.boards.filter(board => this.eligible(board)).length; }
  get selectedBoardsCount(): number { return this.selectedBoards.size; }
  private versionKey(value: string): number[] {
    const match = /^([0-9]+)\.([0-9]+)\.([0-9]+)(?:-.*)?$/.exec(value || '');
    return match ? [Number(match[1]), Number(match[2]), Number(match[3])] : [-1, -1, -1];
  }
  eligible(board: any): boolean { return !!board.connected && !!board.ota_ready && !!board.ota_reachable && !board.firmware_error; }
  toggle(board: any): void { if (!this.eligible(board)) return; this.selectedBoards.has(board.board_id) ? this.selectedBoards.delete(board.board_id) : this.selectedBoards.add(board.board_id); }
  selectEligible(): void { this.boards.filter(board => this.eligible(board)).forEach(board => this.selectedBoards.add(board.board_id)); }
  isSelected(board: any): boolean { return this.selectedBoards.has(board.board_id); }
  getBoardName(board: any): string { return board?.display_name || board?.board_id || 'Board'; }

  getBoardStatus(board: any): string {
    if (!board?.connected) return 'Odpojeno';
    if (board.firmware_error) return board.firmware_error;
    if (!board.ota_ready) return 'Vyžaduje bootstrap';
    if (!board.ota_reachable) return 'OTA nedostupné';
    return 'Připraveno';
  }

  getBoardStatusClass(board: any): string {
    if (this.eligible(board)) return 'ready';
    if (board?.connected) return 'attention';
    return 'offline';
  }

  onBoardKeydown(event: KeyboardEvent, board: any): void {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      this.toggle(board);
    }
  }

  start(): void {
    const ids = [...this.selectedBoards];
    if (!this.selectedVersion || !ids.length || this.gameActive) return;
    const release = this.releases.find(item => item.version === this.selectedVersion);
    const nonUpgrade = ids.some(id => {
      const board = this.boards.find(item => item.board_id === id);
      if (!board?.firmware_version || !release) return false;
      const current = this.versionKey(board.firmware_version);
      const requested = this.versionKey(release.version);
      return current[0] > requested[0] || (current[0] === requested[0] &&
        (current[1] > requested[1] || (current[1] === requested[1] && current[2] >= requested[2])));
    });
    const message = `Update ${ids.join(', ')} to ${this.selectedVersion}?${nonUpgrade ? ' This includes a downgrade or reinstall.' : ''}`;
    if (!window.confirm(message)) return;
    this.auth.createFirmwareJob(this.selectedVersion, ids, nonUpgrade).subscribe({
      next: job => { this.job = job; this.watchJob(job.id); },
      error: err => { this.error = err?.error?.error || 'Firmware update could not be started'; }
    });
  }

  private watchJob(id: string): void {
    this.poll?.unsubscribe();
    this.poll = interval(1000).pipe(switchMap(() => this.auth.getFirmwareJob(id))).subscribe({
      next: job => { this.job = job; if (['succeeded', 'partial', 'failed', 'interrupted'].includes(job.state)) this.poll?.unsubscribe(); },
      error: err => { this.error = err?.error?.error || 'Firmware job status could not be loaded'; this.poll?.unsubscribe(); }
    });
  }

  back(): void { this.router.navigate(['/setup']); }
}
