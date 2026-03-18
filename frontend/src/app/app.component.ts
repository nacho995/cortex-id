import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { SplashComponent } from './splash/splash.component';
import { WelcomeModalComponent } from './welcome/welcome-modal.component';
import { OnboardingComponent } from './welcome/onboarding/onboarding.component';
import { ToastContainerComponent } from './shared/ui/toast/toast-container.component';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, SplashComponent, WelcomeModalComponent, OnboardingComponent, ToastContainerComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (showSplash()) {
      <app-splash (loaded)="onSplashDone()" />
    }
    <router-outlet />
    @if (showWelcome()) {
      <app-welcome-modal (completed)="onWelcomeComplete()" />
    }
    @if (showOnboarding()) {
      <app-onboarding (completed)="onOnboardingComplete()" />
    }
    <app-toast-container />
  `,
  styles: [`
    :host {
      display: block;
      height: 100vh;
      width: 100vw;
      overflow: hidden;
    }
  `],
})
export class AppComponent {
  readonly showSplash = signal(true);
  readonly showWelcome = signal(false);
  readonly showOnboarding = signal(false);

  onSplashDone(): void {
    // Wait for the fade-out CSS transition (600ms) before removing from DOM
    setTimeout(() => {
      this.showSplash.set(false);

      // Show welcome modal if no keys are configured and user hasn't dismissed it
      const welcomeCompleted = localStorage.getItem('cortex-welcome-completed');
      const hasAnyKey =
        !!localStorage.getItem('cortex-api-key-anthropic') ||
        !!localStorage.getItem('cortex-api-key-openai') ||
        !!localStorage.getItem('cortex-api-key-google');

      if (!welcomeCompleted && !hasAnyKey) {
        this.showWelcome.set(true);
        return;
      }

      // Show onboarding (layout mode selection) on first launch
      const onboardingCompleted = localStorage.getItem('cortex-onboarding-completed');
      if (!onboardingCompleted) {
        this.showOnboarding.set(true);
      }
    }, 600);
  }

  onWelcomeComplete(): void {
    this.showWelcome.set(false);
    // After welcome, check if onboarding is needed
    const onboardingCompleted = localStorage.getItem('cortex-onboarding-completed');
    if (!onboardingCompleted) {
      this.showOnboarding.set(true);
    }
  }

  onOnboardingComplete(): void {
    this.showOnboarding.set(false);
  }
}
