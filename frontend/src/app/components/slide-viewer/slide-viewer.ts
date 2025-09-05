import { Component, Input, OnInit, OnDestroy, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-slide-viewer',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="slide-viewer" [class.fullscreen]="isFullscreen">
      <!-- Controls (hidden in fullscreen) -->
      <div class="slide-controls" *ngIf="!isFullscreen">
        <div class="slide-info">
          <h3>{{ title }}</h3>
          <p *ngIf="slides.length > 1">
            Slide {{ currentSlideIndex + 1 }} of {{ slides.length }}
          </p>
          <p *ngIf="slides.length === 1">
            Showing slide {{ slides[0] }}
          </p>
        </div>
        
        <div class="slide-navigation" *ngIf="slides.length > 1">
          <button 
            class="nav-btn" 
            (click)="previousSlide()" 
            [disabled]="currentSlideIndex === 0">
            ← Previous
          </button>
          <button 
            class="nav-btn" 
            (click)="nextSlide()" 
            [disabled]="currentSlideIndex === slides.length - 1">
            Next →
          </button>
        </div>
        
        <div class="view-controls">
          <button class="control-btn" (click)="toggleFullscreen()">
            {{ isFullscreen ? 'Exit Fullscreen' : 'Fullscreen' }}
          </button>
        </div>
      </div>
      
      <!-- Slide Image -->
      <div class="slide-container" (click)="onSlideClick($event)">
        <img 
          [src]="currentSlideUrl" 
          [alt]="'Slide ' + currentSlideNumber"
          class="slide-image"
          (load)="onImageLoad()"
          (error)="onImageError($event)"
          *ngIf="currentSlideUrl" />
        
        <div class="loading" *ngIf="!imageLoaded && !imageError">
          <p>Loading slide {{ currentSlideNumber }}...</p>
        </div>
        
        <div class="error" *ngIf="imageError">
          <p>Failed to load slide {{ currentSlideNumber }}</p>
          <button class="retry-btn" (click)="retryImage()">Retry</button>
        </div>
      </div>
      
      <!-- Fullscreen navigation overlay -->
      <div class="fullscreen-overlay" *ngIf="isFullscreen">
        <div class="fullscreen-controls">
          <button class="fullscreen-nav prev" (click)="previousSlide()" [disabled]="currentSlideIndex === 0" *ngIf="slides.length > 1">
            ←
          </button>
          <div class="fullscreen-info">
            <span *ngIf="slides.length > 1">{{ currentSlideIndex + 1 }} / {{ slides.length }}</span>
            <button class="exit-fullscreen" (click)="toggleFullscreen()">×</button>
          </div>
          <button class="fullscreen-nav next" (click)="nextSlide()" [disabled]="currentSlideIndex === slides.length - 1" *ngIf="slides.length > 1">
            →
          </button>
        </div>
      </div>
    </div>
  `,
  styleUrls: ['./slide-viewer.css']
})
export class SlideViewerComponent implements OnInit, OnDestroy {
  @Input() slides: number[] = []; // Array of slide numbers
  @Input() title: string = 'Presentation';
  
  currentSlideIndex: number = 0;
  isFullscreen: boolean = false;
  imageLoaded: boolean = false;
  imageError: boolean = false;
  
  get currentSlideNumber(): number {
    return this.slides[this.currentSlideIndex] || 1;
  }
  
  get currentSlideUrl(): string {
    return `/coreapi/slide/${this.currentSlideNumber}`;
  }
  
  ngOnInit() {
    this.resetImageState();
  }
  
  ngOnDestroy() {
    if (this.isFullscreen) {
      this.exitFullscreen();
    }
  }
  
  @HostListener('document:keydown', ['$event'])
  handleKeyboardEvent(event: KeyboardEvent) {
    if (!this.isFullscreen) return;
    
    switch (event.key) {
      case 'Escape':
        this.toggleFullscreen();
        break;
      case 'ArrowLeft':
        this.previousSlide();
        break;
      case 'ArrowRight':
      case 'PageDown':
        this.nextSlide();
        break;
    }
  }
  
  previousSlide() {
    if (this.currentSlideIndex > 0) {
      this.currentSlideIndex--;
      this.resetImageState();
    }
  }
  
  nextSlide() {
    if (this.currentSlideIndex < this.slides.length - 1) {
      this.currentSlideIndex++;
      this.resetImageState();
    }
  }
  
  toggleFullscreen() {
    this.isFullscreen = !this.isFullscreen;
    
    if (this.isFullscreen) {
      this.enterFullscreen();
    } else {
      this.exitFullscreen();
    }
  }
  
  private enterFullscreen() {
    document.body.classList.add('fullscreen-active');
  }
  
  private exitFullscreen() {
    document.body.classList.remove('fullscreen-active');
    this.isFullscreen = false;
  }
  
  onSlideClick(event: MouseEvent) {
    if (!this.isFullscreen) return;
    
    // Click on left half = previous slide
    // Click on right half = next slide
    const rect = (event.target as HTMLElement).getBoundingClientRect();
    const clickX = event.clientX - rect.left;
    const centerX = rect.width / 2;
    
    if (clickX < centerX && this.slides.length > 1) {
      this.previousSlide();
    } else if (clickX > centerX && this.slides.length > 1) {
      this.nextSlide();
    }
  }
  
  onImageLoad() {
    this.imageLoaded = true;
    this.imageError = false;
  }
  
  onImageError(event: any) {
    this.imageError = true;
    this.imageLoaded = false;
    console.error('Failed to load slide image:', this.currentSlideUrl);
  }
  
  retryImage() {
    this.resetImageState();
    // Force image reload by adding timestamp
    const img = document.querySelector('.slide-image') as HTMLImageElement;
    if (img) {
      const url = new URL(img.src);
      url.searchParams.set('t', Date.now().toString());
      img.src = url.toString();
    }
  }
  
  private resetImageState() {
    this.imageLoaded = false;
    this.imageError = false;
  }
}
