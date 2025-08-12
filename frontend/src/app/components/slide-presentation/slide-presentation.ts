import { Component, Input, Output, EventEmitter, OnInit, OnDestroy, OnChanges, SimpleChanges, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { AuthService } from '../../services/auth.service';

export interface SlideInfo {
  round: number;
  round_type: number;
  slide_range?: { start: number; end: number };
}

@Component({
  selector: 'app-slide-presentation',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './slide-presentation.html',
  styleUrl: './slide-presentation.css'
})
export class SlidePresentationComponent implements OnInit, OnDestroy, OnChanges {
  @Input() currentRound: SlideInfo | null = null;
  @Input() currentRoundDetails: any = null;
  @Output() advanceToNextRound = new EventEmitter<void>();

  // Slide management
  currentSlideIndex = 0;
  totalSlides = 0;
  slides: string[] = [];
  currentImageUrl: SafeResourceUrl | null = null;
  
  // UI state
  isFullscreen = false;
  isImageLoading = true;
  imageError = false;

  // Track previous slide data to avoid unnecessary reloads
  private previousSlideData: string | null = null;

  constructor(
    private sanitizer: DomSanitizer,
    private authService: AuthService
  ) {}

  ngOnInit() {
    this.loadSlides();
  }

  ngOnChanges(changes: SimpleChanges) {
    // Only reload slides when the actual slide data changes, not just the object reference
    if (changes['currentRound'] || changes['currentRoundDetails']) {
      const currentSlideData = this.getCurrentSlideDataSignature();
      if (currentSlideData !== this.previousSlideData) {
        this.previousSlideData = currentSlideData;
        this.loadSlides();
      }
    }
  }

  private getCurrentSlideDataSignature(): string {
    if (!this.currentRound || !this.currentRoundDetails) return '';
    
    if (this.currentRound.round_type === 3) { // SLIDE
      return `slide:${this.currentRoundDetails.slide || ''}`;
    } else if (this.currentRound.round_type === 4) { // SLIDE_RANGE
      return `slides:${JSON.stringify(this.currentRoundDetails.slides || [])}`;
    }
    
    return '';
  }

  ngOnDestroy() {
    if (this.isFullscreen) {
      this.exitFullscreen();
    }
  }

  loadSlides() {
    if (!this.currentRound || !this.currentRoundDetails) return;

    const previousSlideCount = this.slides.length;
    const previousCurrentIndex = this.currentSlideIndex;
    
    this.slides = [];

    if (this.currentRound.round_type === 3) { // SLIDE
      // Single slide - only use filename from round details
      if (this.currentRoundDetails && this.currentRoundDetails.slide) {
        const slideFilename = this.currentRoundDetails.slide;
        this.slides = [this.authService.getSlideFileUrl(slideFilename)];
        this.totalSlides = 1;
        this.currentSlideIndex = 0; // Always show the single slide
      } else {
        console.warn('No slide filename provided for SLIDE round type');
        return;
      }
    } else if (this.currentRound.round_type === 4) { // SLIDE_RANGE
      // Multiple slides - only use filenames from round details
      if (this.currentRoundDetails && this.currentRoundDetails.slides && Array.isArray(this.currentRoundDetails.slides)) {
        // All slides should be filenames/paths now
        for (const slide of this.currentRoundDetails.slides) {
          if (typeof slide === 'string') {
            this.slides.push(this.authService.getSlideFileUrl(slide));
          } else {
            console.warn('Unexpected slide data type:', typeof slide, slide);
          }
        }
        this.totalSlides = this.slides.length;
        
        // Preserve slide index if the slide count is the same and we're within bounds
        if (this.totalSlides === previousSlideCount && previousCurrentIndex < this.totalSlides) {
          this.currentSlideIndex = previousCurrentIndex;
        } else {
          this.currentSlideIndex = 0;
        }
      } else {
        console.warn('No slides array provided for SLIDE_RANGE round type');
        return;
      }
    } else {
      console.warn('Unknown round type for slides:', this.currentRound.round_type);
      return;
    }

    this.loadCurrentSlide();
  }

  loadCurrentSlide() {
    if (this.slides.length === 0) return;

    this.isImageLoading = true;
    this.imageError = false;
    
    const imageUrl = this.slides[this.currentSlideIndex];
    
    // Directly use the slide URL since the backend will try different extensions
    this.tryLoadImage(imageUrl)
      .then(url => {
        this.currentImageUrl = this.sanitizer.bypassSecurityTrustResourceUrl(url);
        this.isImageLoading = false;
      })
      .catch(() => {
        this.imageError = true;
        this.isImageLoading = false;
        console.error('Failed to load slide image:', imageUrl);
      });
  }

  private tryLoadImage(url: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(url);
      img.onerror = () => reject();
      img.src = url;
    });
  }

  // Navigation methods
  canGoToPrevious(): boolean {
    return this.currentSlideIndex > 0;
  }

  canGoToNext(): boolean {
    return this.currentSlideIndex < this.totalSlides - 1;
  }

  previousSlide() {
    if (this.canGoToPrevious()) {
      this.currentSlideIndex--;
      this.loadCurrentSlide();
    }
  }

  nextSlide() {
    if (this.canGoToNext()) {
      this.currentSlideIndex++;
      this.loadCurrentSlide();
    } else {
      // We're at the last slide, emit event to advance to next round
      this.advanceToNextRound.emit();
    }
  }

  goToSlide(index: number) {
    if (index >= 0 && index < this.totalSlides) {
      this.currentSlideIndex = index;
      this.loadCurrentSlide();
    }
  }

  // Fullscreen methods
  toggleFullscreen() {
    if (this.isFullscreen) {
      this.exitFullscreen();
    } else {
      this.enterFullscreen();
    }
  }

  enterFullscreen() {
    const element = document.documentElement;
    
    if (element.requestFullscreen) {
      element.requestFullscreen();
    } else if ((element as any).webkitRequestFullscreen) {
      (element as any).webkitRequestFullscreen();
    } else if ((element as any).msRequestFullscreen) {
      (element as any).msRequestFullscreen();
    }
    
    this.isFullscreen = true;
  }

  exitFullscreen() {
    if (document.exitFullscreen) {
      document.exitFullscreen();
    } else if ((document as any).webkitExitFullscreen) {
      (document as any).webkitExitFullscreen();
    } else if ((document as any).msExitFullscreen) {
      (document as any).msExitFullscreen();
    }
    
    this.isFullscreen = false;
  }

  // Keyboard navigation
  @HostListener('document:keydown', ['$event'])
  handleKeyDown(event: KeyboardEvent) {
    if (!this.isFullscreen) return;

    switch (event.key) {
      case 'ArrowLeft':
      case 'ArrowUp':
        event.preventDefault();
        this.previousSlide();
        break;
      case 'ArrowRight':
      case 'ArrowDown':
      case ' ': // Space
        event.preventDefault();
        this.nextSlide(); // This will now handle advancing to next round
        break;
      case 'Escape':
        event.preventDefault();
        this.exitFullscreen();
        break;
      case 'f':
      case 'F':
        event.preventDefault();
        this.toggleFullscreen();
        break;
    }
  }

  // Listen for fullscreen changes
  @HostListener('document:fullscreenchange', [])
  @HostListener('document:webkitfullscreenchange', [])
  @HostListener('document:msfullscreenchange', [])
  onFullscreenChange() {
    this.isFullscreen = !!(document.fullscreenElement || 
                          (document as any).webkitFullscreenElement || 
                          (document as any).msFullscreenElement);
  }

  // Helper methods for template
  getCurrentSlideNumber(): number {
    return this.currentSlideIndex + 1;
  }

  getTotalSlides(): number {
    return this.totalSlides;
  }

  getSlideTitle(): string {
    if (!this.currentRound || !this.currentRoundDetails) return 'Presentation';
    
    if (this.currentRound.round_type === 3) { // SLIDE
      // For single slides, extract slide number from filename
      if (this.currentRoundDetails && this.currentRoundDetails.slide) {
        const slideFilename = this.currentRoundDetails.slide;
        const match = slideFilename.match(/(\d+)/);
        if (match) {
          const slideNumber = parseInt(match[1]);
          return `Slide ${slideNumber}`;
        }
        return 'Slide';
      }
    } else if (this.currentRound.round_type === 4) { // SLIDE_RANGE
      // For slide ranges, extract slide number from current slide filename
      if (this.currentRoundDetails && this.currentRoundDetails.slides && 
          this.currentRoundDetails.slides.length > this.currentSlideIndex) {
        const currentSlide = this.currentRoundDetails.slides[this.currentSlideIndex];
        if (typeof currentSlide === 'string') {
          // Extract number from filename
          const match = currentSlide.match(/(\d+)/);
          if (match) {
            const slideNumber = parseInt(match[1]);
            return `Slide ${slideNumber}`;
          }
        }
        return `Slide ${this.currentSlideIndex + 1}`;
      }
    }
    
    return 'Presentation';
  }
}
