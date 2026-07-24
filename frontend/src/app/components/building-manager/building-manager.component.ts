import { Component, OnInit, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-building-manager',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="overlay" *ngIf="visible" (click)="close()">
      <div class="modal" (click)="$event.stopPropagation()">
        <h2>Upravit budovy</h2>
        <div *ngIf="boardsData && boardsData.length > 0">
          <div class="team-selector">
            <label for="teamSelect">Vyber tým:</label>
            <select id="teamSelect" [(ngModel)]="selectedBoardId" (change)="onTeamChange()">
              <option *ngFor="let board of boardsData" [value]="board.id">
                {{ board.displayName }}
              </option>
            </select>
          </div>
          <div *ngIf="selectedBoard" class="building-list">
            <div *ngFor="let item of selectedBoard.items; let i = index" class="building-row">
              <span class="building-name">{{ item.name }}</span>
              <div class="controls">
                <button (click)="adjust(selectedBoard.id, i, -1)">−</button>
                <span class="count">{{ item.count }}</span>
                <button (click)="adjust(selectedBoard.id, i, 1)">+</button>
              </div>
            </div>
          </div>
          <div class="actions">
            <button (click)="save()" [disabled]="isSaving">Uložit</button>
            <button (click)="close()">Zavřít</button>
          </div>
          <div *ngIf="saveMessage" class="message">{{ saveMessage }}</div>
        </div>
        <div *ngIf="!boardsData || boardsData.length === 0" class="loading">
          <p>Žádný tým není připojen...</p>
        </div>
      </div>
    </div>
  `,
  styles: [
    `.overlay { position: fixed; top:0; left:0; width:100%; height:100%; background: rgba(0,0,0,0.7); z-index:10000; display:flex; justify-content:center; align-items:center; }`,
    `.modal { background: white; padding:20px; border-radius:8px; max-width:600px; width:90%; max-height:90%; overflow-y:auto; }`,
    `.team-selector { margin-bottom: 20px; }`,
    `.team-selector label { margin-right: 10px; font-weight: bold; }`,
    `.team-selector select { padding: 5px 10px; border-radius: 4px; border: 1px solid #ccc; }`,
    `.building-list { display: flex; flex-direction: column; gap: 8px; max-height: 50vh; overflow-y: auto; }`,
    `.building-row { display: flex; justify-content: space-between; align-items: center; padding: 6px 10px; border-bottom: 1px solid #eee; }`,
    `.building-name { font-weight: 500; }`,
    `.controls { display: flex; align-items: center; gap: 8px; }`,
    `.controls button { width: 30px; height: 30px; border-radius: 4px; border: 1px solid #ccc; background: #f5f5f5; font-size: 18px; cursor: pointer; }`,
    `.controls button:hover { background: #e0e0e0; }`,
    `.count { min-width: 30px; text-align: center; font-weight: bold; }`,
    `.actions { margin-top: 20px; display: flex; gap: 10px; justify-content: flex-end; }`,
    `.actions button { padding: 8px 16px; border-radius: 4px; border: none; cursor: pointer; }`,
    `.actions button:first-child { background: #27ae60; color: white; }`,
    `.actions button:first-child:hover { background: #219a52; }`,
    `.actions button:last-child { background: #e74c3c; color: white; }`,
    `.actions button:last-child:hover { background: #c0392b; }`,
    `.actions button:disabled { opacity: 0.6; cursor: not-allowed; }`,
    `.message { margin-top: 10px; color: #27ae60; text-align: center; }`
  ]
})
export class BuildingManagerComponent implements OnInit {
  @Input() boardNames: { [key: string]: string } = {};

  visible = false;
  boardsData: { id: string, displayName: string, items: { name: string, count: number }[] }[] = [];
  selectedBoardId: string = '';
  selectedBoard: any = null;
  isSaving = false;
  saveMessage = '';

  constructor(private http: HttpClient) {}

  ngOnInit() {}

  show() {
    this.visible = true;
    this.loadData();
  }

  close() {
    this.visible = false;
    this.saveMessage = '';
  }

  loadData() {
    this.http.get('/coreapi/lecturer/board_counts').subscribe((res: any) => {
      this.boardsData = Object.keys(res).map(boardId => {
        const data = res[boardId];
        const displayName = this.boardNames[boardId] || boardId;
        return {
          id: boardId,
          displayName: displayName,
          items: data.counts.map((count: number, idx: number) => ({
            name: data.names?.[idx] || `Typ ${idx}`,
            count: count
          }))
        };
      });
      if (this.boardsData.length > 0) {
        this.selectedBoardId = this.boardsData[0].id;
        this.onTeamChange();
      }
    });
  }

  onTeamChange() {
    this.selectedBoard = this.boardsData.find(b => b.id === this.selectedBoardId);
  }

  adjust(boardId: string, itemIdx: number, delta: number) {
    const board = this.boardsData.find(b => b.id === boardId);
    if (board) {
      const newCount = board.items[itemIdx].count + delta;
      board.items[itemIdx].count = Math.max(0, newCount);
      if (this.selectedBoard && this.selectedBoard.id === boardId) {
        this.selectedBoard = board;
      }
    }
  }

  save() {
    this.isSaving = true;
    this.saveMessage = '';

    const payload: any = {};
    for (const board of this.boardsData) {
      const counts = board.items.map(item => item.count);
      payload[board.id] = counts;
    }

    const updates = this.boardsData.map(board => {
      const counts = board.items.map(item => item.count);
      return this.http.post('/coreapi/lecturer/update_counts', {
        board_id: board.id,
        counts: counts
      }).toPromise();
    });

    Promise.all(updates).then(() => {
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