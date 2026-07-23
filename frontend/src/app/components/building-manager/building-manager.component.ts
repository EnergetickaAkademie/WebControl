import { Component, OnInit } from '@angular/core';
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
        <div *ngFor="let board of boards" class="board-row">
          <h3>{{ board.displayName }}</h3>
          <div class="building-controls">
            <div *ngFor="let item of board.items; let i = index" class="control-item">
              <span class="type-name">{{ item.name }}</span>
              <button (click)="adjust(board.id, i, -1)">−</button>
              <span class="count">{{ item.count }}</span>
              <button (click)="adjust(board.id, i, 1)">+</button>
            </div>
          </div>
        </div>
        <div class="actions">
          <button (click)="save()" [disabled]="isSaving">Uložit</button>
          <button (click)="close()">Zavřít</button>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .overlay { position: fixed; top:0; left:0; width:100%; height:100%; background: rgba(0,0,0,0.7); z-index:1000; display:flex; justify-content:center; align-items:center; }
    .modal { background: white; padding:20px; border-radius:8px; max-width:90%; max-height:90%; overflow-y:auto; }
    .board-row { margin-bottom:20px; border-bottom:1px solid #ccc; padding-bottom:10px; }
    .building-controls { display:flex; flex-wrap:wrap; gap:10px; }
    .control-item { display:flex; align-items:center; gap:5px; }
    .type-name { min-width:80px; }
    .count { min-width:30px; text-align:center; }
    .actions { margin-top:20px; display:flex; gap:10px; justify-content:flex-end; }
  `]
})
export class BuildingManagerComponent implements OnInit {
  visible = false;
  boards: { id: string, displayName: string, items: { name: string, count: number }[] }[] = [];
  isSaving = false;

  constructor(private http: HttpClient) {}

  ngOnInit() {}

  show() {
    this.visible = true;
    this.loadData();
  }

  close() {
    this.visible = false;
  }

  loadData() {
    this.http.get('/coreapi/lecturer/board_counts').subscribe((res: any) => {
      this.boards = Object.keys(res).map(boardId => {
        const data = res[boardId];
        return {
          id: boardId,
          displayName: boardId, // You can replace with a service to get friendly names
          items: data.counts.map((count: number, idx: number) => ({
            name: data.names?.[idx] || `Typ ${idx}`,
            count: count
          }))
        };
      });
    });
  }

  adjust(boardId: string, itemIdx: number, delta: number) {
    const board = this.boards.find(b => b.id === boardId);
    if (board) {
      const newCount = board.items[itemIdx].count + delta;
      board.items[itemIdx].count = Math.max(0, newCount);
    }
  }

  save() {
    this.isSaving = true;
    const updates = this.boards.map(board => {
      const counts = board.items.map(item => item.count);
      return this.http.post('/coreapi/lecturer/update_counts', {
        board_id: board.id,
        counts: counts
      }).toPromise();
    });
    Promise.all(updates).then(() => {
      this.isSaving = false;
      this.close();
    }).catch(() => {
      this.isSaving = false;
      alert('Uložení se nezdařilo.');
    });
  }
}