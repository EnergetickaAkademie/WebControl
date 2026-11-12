import { Component, inject } from '@angular/core';
import { NavigationEnd, Router, RouterOutlet } from '@angular/router';
import { filter } from 'rxjs';

/** Routes that keep the purple game background; all others use the grey one. */
const GAME_ROUTES = ['/dashboard', '/statistics'];

@Component({
  selector: 'app-root',
  imports: [RouterOutlet],
  templateUrl: './app.html',
  styleUrl: './app.css'
})
export class App {
  protected title = 'lecturer-app';
  protected gameBackground = false;

  constructor() {
    const router = inject(Router);
    router.events.pipe(filter(e => e instanceof NavigationEnd)).subscribe(e => {
      const path = (e as NavigationEnd).urlAfterRedirects.split(/[?#]/)[0];
      this.gameBackground = GAME_ROUTES.some(route => path === route || path.startsWith(route + '/'));
    });
  }
}
