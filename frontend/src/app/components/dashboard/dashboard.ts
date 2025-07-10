import { Component, OnInit, OnDestroy } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '../../services';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { interval, Subscription } from 'rxjs';

@Component({
  selector: 'app-dashboard',
  imports: [CommonModule, FormsModule],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.css'
})
export class DashboardComponent implements OnInit, OnDestroy {
  userInfo: any = null;
  gameStatus: any = null;
  isLoading = true;
  isGameLoading = false;
  private gameStatusSubscription?: Subscription;
  private pollSubscription?: Subscription;

  // Building management properties
  buildingTable: any = null;
  originalBuildingTable: any = null;
  isBuildingTableDirty = false;
  isSavingBuildingTable = false;
  buildingTableSaveStatus: any = null;
  newBuildingType = '';
  newBuildingConsumption: number | null = null;

  // Building type names mapping
  private buildingTypeNames: { [key: number]: string } = {
    1: 'Residential',
    2: 'Commercial', 
    3: 'Industrial',
    4: 'Educational',
    5: 'Hospital',
    6: 'Public',
    7: 'Data Center',
    8: 'Agricultural',
    9: 'Office',
    10: 'Retail',
    11: 'Warehouse',
    12: 'Manufacturing'
  };

  constructor(
    private authService: AuthService,
    private router: Router
  ) {}

  ngOnInit() {
    this.loadProfile();
    this.startGameStatusPolling();
    this.loadBuildingTable();
  }

  ngOnDestroy() {
    if (this.gameStatusSubscription) {
      this.gameStatusSubscription.unsubscribe();
    }
    if (this.pollSubscription) {
      this.pollSubscription.unsubscribe();
    }
  }

  startGameStatusPolling() {
    // Initial load
    this.loadGameStatus();
    
    // Poll every 3 seconds
    this.pollSubscription = interval(3000).subscribe(() => {
      this.loadGameStatus();
    });
  }

  loadGameStatus() {
    this.gameStatusSubscription = this.authService.getGameStatus().subscribe({
      next: (status: any) => {
        this.gameStatus = status;
      },
      error: (error: any) => {
        console.error('Failed to load game status', error);
      }
    });
  }

  loadProfile() {
    this.authService.profile().subscribe({
      next: (profile: any) => {
        this.userInfo = profile;
        this.isLoading = false;
      },
      error: (error: any) => {
        console.error('Failed to load profile', error);
        this.isLoading = false;
        if (error.status === 401) {
          this.router.navigate(['/login']);
        }
      }
    });
  }

  nextRound() {
    if (this.isGameLoading) return;
    
    this.isGameLoading = true;
    this.authService.nextRound().subscribe({
      next: (response: any) => {
        console.log('Next round successful', response);
        this.isGameLoading = false;
        // Immediately refresh game status
        this.loadGameStatus();
      },
      error: (error: any) => {
        console.error('Failed to advance to next round', error);
        this.isGameLoading = false;
      }
    });
  }

  startGame() {
    if (this.isGameLoading) return;
    
    this.isGameLoading = true;
    this.authService.startGame().subscribe({
      next: (response: any) => {
        console.log('Game started successfully', response);
        this.isGameLoading = false;
        // Immediately refresh game status
        this.loadGameStatus();
      },
      error: (error: any) => {
        console.error('Failed to start game', error);
        this.isGameLoading = false;
      }
    });
  }

  logout() {
    this.authService.signout().subscribe({
      next: () => {
        this.router.navigate(['/login']);
      },
      error: (error: any) => {
        console.error('Logout failed', error);
        // Navigate to login anyway
        this.router.navigate(['/login']);
      }
    });
  }

  // Building Management Methods
  loadBuildingTable() {
    console.log('Loading building table...');
    this.authService.getBuildingTable().subscribe({
      next: (response: any) => {
        console.log('Building table loaded successfully:', response);
        this.buildingTable = response;
        this.originalBuildingTable = JSON.parse(JSON.stringify(response));
        this.isBuildingTableDirty = false;
      },
      error: (error: any) => {
        console.error('Failed to load building table', error);
        // Set default empty table on error to prevent infinite loading
        this.buildingTable = { 
          success: false, 
          table: {}, 
          version: 0,
          error: error.message || 'Failed to load' 
        };
      }
    });
  }

  getBuildingTableEntries() {
    if (!this.buildingTable?.table) return [];
    return Object.entries(this.buildingTable.table).map(([type, consumption]) => ({
      type: parseInt(type),
      consumption: consumption as number
    })).sort((a, b) => a.type - b.type);
  }

  updateBuildingConsumption(type: number, value: number) {
    if (this.buildingTable?.table) {
      this.buildingTable.table[type] = value;
      this.markBuildingTableDirty();
    }
  }

  getBuildingTypeName(type: number): string {
    return this.buildingTypeNames[type] || `Building Type ${type}`;
  }

  isDefaultBuildingType(type: number): boolean {
    return type >= 1 && type <= 8; // Default types from 1-8
  }

  getAvailableBuildingTypes(): number[] {
    const usedTypes = new Set(Object.keys(this.buildingTable?.table || {}).map(Number));
    const availableTypes = [];
    
    for (let i = 1; i <= 12; i++) {
      if (!usedTypes.has(i)) {
        availableTypes.push(i);
      }
    }
    
    return availableTypes;
  }

  markBuildingTableDirty() {
    this.isBuildingTableDirty = true;
    this.buildingTableSaveStatus = null;
  }

  addBuildingType() {
    if (!this.newBuildingType || this.newBuildingConsumption === null) return;
    
    const type = parseInt(this.newBuildingType);
    if (!this.buildingTable.table) {
      this.buildingTable.table = {};
    }
    
    this.buildingTable.table[type] = this.newBuildingConsumption;
    this.newBuildingType = '';
    this.newBuildingConsumption = null;
    this.markBuildingTableDirty();
  }

  removeBuildingType(type: number) {
    if (this.buildingTable?.table && type in this.buildingTable.table) {
      delete this.buildingTable.table[type];
      this.markBuildingTableDirty();
    }
  }

  saveBuildingTable() {
    if (!this.isBuildingTableDirty || this.isSavingBuildingTable) return;
    
    this.isSavingBuildingTable = true;
    this.buildingTableSaveStatus = null;
    
    this.authService.updateBuildingTable(this.buildingTable.table).subscribe({
      next: (response: any) => {
        this.isSavingBuildingTable = false;
        this.isBuildingTableDirty = false;
        this.originalBuildingTable = JSON.parse(JSON.stringify(this.buildingTable));
        this.buildingTable.version = response.version;
        this.buildingTableSaveStatus = {
          type: 'success',
          message: 'Building table saved successfully!'
        };
        
        // Clear status after 3 seconds
        setTimeout(() => {
          this.buildingTableSaveStatus = null;
        }, 3000);
      },
      error: (error: any) => {
        console.error('Failed to save building table', error);
        this.isSavingBuildingTable = false;
        this.buildingTableSaveStatus = {
          type: 'error',
          message: 'Failed to save building table. Please try again.'
        };
      }
    });
  }

  resetBuildingTable() {
    if (!this.isBuildingTableDirty) return;
    
    this.buildingTable = JSON.parse(JSON.stringify(this.originalBuildingTable));
    this.isBuildingTableDirty = false;
    this.buildingTableSaveStatus = null;
  }
}
