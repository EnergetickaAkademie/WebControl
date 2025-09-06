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
  @Input() externalFullscreen: boolean = false; // Accept external fullscreen state
  @Input() gameStatus: any = null; // Accept game status to check if at end of scenario
  @Output() advanceToNextRound = new EventEmitter<void>();
  @Output() toggleFullscreenRequest = new EventEmitter<void>(); // Emit fullscreen toggle requests
  @Output() scenarioFinished = new EventEmitter<void>(); // Inform parent that scenario ended

  // Slide management
  currentSlideIndex = 0;
  totalSlides = 0;
  slides: string[] = [];
  currentImageUrl: SafeResourceUrl | null = null;
  
  // UI state - use external fullscreen if provided
  get isFullscreen(): boolean {
    return this.externalFullscreen;
  }
  
  private _internalFullscreen = false;
  
  isImageLoading = true;
  imageError = false;
  // Removed internal end notification overlay; parent handles final dialog

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
        
        // Don't automatically exit fullscreen - let user control it
        // The user can manually exit with ESC or F key
        
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
    // Only exit fullscreen if using internal fullscreen management
    if (this.externalFullscreen === undefined && this._internalFullscreen) {
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
        console.warn('Nebyl poskytnut název souboru snímku pro typ kola SLIDE');
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
            console.warn('Neočekávaný typ dat snímku:', typeof slide, slide);
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
        console.warn('Nebyl poskytnut seznam snímků pro typ kola SLIDE_RANGE');
        return;
      }
    } else {
      console.warn('Neznámý typ kola pro snímky:', this.currentRound.round_type);
      return;
    }

    this.loadCurrentSlide();
    
    // Don't auto-enter fullscreen here anymore - dashboard handles it
    // The dashboard will manage fullscreen state across all round types
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
        console.error('Nepodařilo se načíst obrázek snímku:', imageUrl);
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
      // At last slide - user is trying to advance beyond last slide
      console.log('User trying to advance from last slide - checking if scenario end');
      this.handleEndOfSlides();
    }
  }

  goToSlide(index: number) {
    if (index >= 0 && index < this.totalSlides) {
      this.currentSlideIndex = index;
      this.loadCurrentSlide();
    }
  }

  private handleEndOfSlides() {
    console.log('handleEndOfSlides called - gameStatus:', this.gameStatus);
    // If not last round of scenario, ask parent to advance
    if (this.gameStatus && this.gameStatus.current_round < this.gameStatus.total_rounds) {
      console.log('Not last round, advancing to next round');
      this.advanceToNextRound.emit();
    } else {
      // This is the last round of the scenario - scenario finished when user tries to advance
      console.log('Last round detected, emitting scenarioFinished');
      this.scenarioFinished.emit();
    }
  }

  // Fullscreen methods - delegate to parent if external fullscreen is used
  toggleFullscreen() {
    if (this.externalFullscreen !== undefined) {
      // Emit request to parent component
      this.toggleFullscreenRequest.emit();
    } else {
      // Handle internally
      if (this._internalFullscreen) {
        this.exitFullscreen();
      } else {
        this.enterFullscreen();
      }
    }
  }

  enterFullscreen() {
    if (this.externalFullscreen !== undefined) {
      // Delegate to parent
      this.toggleFullscreenRequest.emit();
      return;
    }
    
    // Check if we're already in fullscreen
    const isActuallyFullscreen = !!(document.fullscreenElement || 
                                   (document as any).webkitFullscreenElement || 
                                   (document as any).msFullscreenElement);
    
    if (isActuallyFullscreen) {
      this._internalFullscreen = true;
      return;
    }
    
    const element = document.documentElement;
    
    try {
      if (element.requestFullscreen) {
        element.requestFullscreen().then(() => {
          this._internalFullscreen = true;
        }).catch((error) => {
          console.warn('Nepodařilo se přejít do celé obrazovky:', error);
        });
      } else if ((element as any).webkitRequestFullscreen) {
        (element as any).webkitRequestFullscreen();
        this._internalFullscreen = true;
      } else if ((element as any).msRequestFullscreen) {
        (element as any).msRequestFullscreen();
        this._internalFullscreen = true;
      }
    } catch (error) {
      console.warn('Error entering fullscreen:', error);
    }
  }

  exitFullscreen() {
    if (this.externalFullscreen !== undefined) {
      // Delegate to parent
      this.toggleFullscreenRequest.emit();
      return;
    }
    
    // Check if we're actually in fullscreen before trying to exit
    const isActuallyFullscreen = !!(document.fullscreenElement || 
                                   (document as any).webkitFullscreenElement || 
                                   (document as any).msFullscreenElement);
    
    if (!isActuallyFullscreen) {
      // Update our state to match reality
      this._internalFullscreen = false;
      return;
    }
    
    try {
      if (document.exitFullscreen) {
        document.exitFullscreen().catch((error) => {
          console.warn('Failed to exit fullscreen:', error);
          this._internalFullscreen = false;
        });
      } else if ((document as any).webkitExitFullscreen) {
        (document as any).webkitExitFullscreen();
      } else if ((document as any).msExitFullscreen) {
        (document as any).msExitFullscreen();
      }
    } catch (error) {
      console.warn('Error exiting fullscreen:', error);
      this._internalFullscreen = false;
    }
  }

  // Keyboard navigation
  @HostListener('document:keydown', ['$event'])
  handleKeyDown(event: KeyboardEvent) {
    // Handle navigation keys regardless of fullscreen state
    switch (event.key) {
      case 'ArrowLeft':
      case 'ArrowUp':
        event.preventDefault();
        this.previousSlide();
        break;
      case 'ArrowRight':
      case 'ArrowDown':
      case 'PageDown':
      case ' ': // Space
        event.preventDefault();
  this.nextSlide();
        break;
      case 'Escape':
        // Only handle escape in fullscreen
        if (this.isFullscreen) {
          event.preventDefault();
          this.exitFullscreen();
        }
        break;
      case 'f':
      case 'F':
        event.preventDefault();
        this.toggleFullscreen();
        break;
    }
  }

  // Listen for fullscreen changes (only when using internal fullscreen)
  @HostListener('document:fullscreenchange', [])
  @HostListener('document:webkitfullscreenchange', [])
  @HostListener('document:msfullscreenchange', [])
  onFullscreenChange() {
    if (this.externalFullscreen === undefined) {
      // Only update internal state when not using external fullscreen
      this._internalFullscreen = !!(document.fullscreenElement || 
                            (document as any).webkitFullscreenElement || 
                            (document as any).msFullscreenElement);
    }
  }

  // Helper methods for template
  getCurrentSlideNumber(): number {
    return this.currentSlideIndex + 1;
  }

  getTotalSlides(): number {
    return this.totalSlides;
  }

  getSlideTitle(): string {
    if (!this.currentRound || !this.currentRoundDetails) return 'Prezentace';
    
    if (this.currentRound.round_type === 3) { // SLIDE
      // For single slides, extract slide number from filename
      if (this.currentRoundDetails && this.currentRoundDetails.slide) {
        const slideFilename = this.currentRoundDetails.slide;
        const match = slideFilename.match(/(\d+)/);
        if (match) {
          const slideNumber = parseInt(match[1]);
          return `Snímek ${slideNumber}`;
        }
        return 'Snímek';
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
            return `Snímek ${slideNumber}`;
          }
        }
        return `Snímek ${this.currentSlideIndex + 1}`;
      }
    }
    
    return 'Prezentace';
  }
}
