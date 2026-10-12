import { Component, computed, inject } from '@angular/core';
import { AuthService } from '../../core/auth';
import { HealthService } from '../../core/health';
import { LABELS } from '../../labels';

@Component({
  selector: 'app-home',
  templateUrl: './home.html',
  styleUrl: './home.scss',
})
export class HomePage {
  private readonly health = inject(HealthService);
  private readonly auth = inject(AuthService);

  protected readonly labels = LABELS.home;
  protected readonly greeting = computed(() => {
    const actor = this.auth.actor();
    return actor ? this.labels.greeting(actor.displayName) : null;
  });
  protected readonly state = this.health.state;
  protected readonly stateText = computed(() => {
    switch (this.state()) {
      case 'checking':
        return this.labels.healthChecking;
      case 'ok':
        return this.labels.healthOk;
      case 'degraded':
        return this.labels.healthDegraded;
      case 'down':
        return this.labels.healthDown;
    }
  });
}
