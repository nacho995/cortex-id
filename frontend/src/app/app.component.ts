import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { SplashComponent } from './splash/splash.component';
import { WelcomeModalComponent } from './welcome/welcome-modal.component';
import { ToastContainerComponent } from './shared/ui/toast/toast-container.component';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, SplashComponent, WelcomeModalComponent, ToastContainerComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (showSplash()) {
      <app-splash (loaded)="onSplashDone()" />
    }
    <router-outlet />
    @if (showWelcome()) {
      <app-welcome-modal (completed)="onWelcomeComplete()" />
    }
    <app-toast-container />
  `,
  styles: [`
    :host {
      display: block;
      height: 100%;
      width: 100%;
    }
  `],
})
export class AppComponent {
  readonly showSplash = signal(true);
  readonly showWelcome = signal(false);

  onSplashDone(): void {
    // Wait for the fade-out CSS transition (600ms) before removing from DOM
    setTimeout(() => {
      this.showSplash.set(false);

      // Show welcome modal if no keys are configured and user hasn't dismissed it
      const completed = localStorage.getItem('cortex-welcome-completed');
      const hasAnyKey =
        !!localStorage.getItem('cortex-api-key-anthropic') ||
        !!localStorage.getItem('cortex-api-key-openai') ||
        !!localStorage.getItem('cortex-api-key-google');

      if (!completed && !hasAnyKey) {
        this.showWelcome.set(true);
      }
    }, 600);
  }

  onWelcomeComplete(): void {
    this.showWelcome.set(false);
  }
}
