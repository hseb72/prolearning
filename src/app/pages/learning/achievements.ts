import { httpResource } from '@angular/common/http';
import { Component, inject } from '@angular/core';
import type { SharedAchievement } from '@shared/learning';
import { AuthService } from '../../core/auth';
import { LABELS } from '../../labels';
import { AchievementCard } from '../../learning/achievement-card';
import { EmptyState } from '../../ui/empty';

/** « Réussites » : ce que des collègues ont choisi de publier pour tous (décision 5). */
@Component({
  selector: 'app-achievements',
  imports: [AchievementCard, EmptyState],
  template: `
    <p class="eyebrow">{{ labels.pageEyebrow }}</p>
    <h1>{{ labels.pageTitle }}</h1>
    <p class="lead">{{ labels.pageIntro }}</p>
    @if (data.isLoading() && !data.hasValue()) {
      <p role="status">{{ labels.loading }}</p>
    } @else if (data.error()) {
      <p class="fb bad" role="alert">{{ labels.loadFailed }}</p>
    } @else if (!data.value()?.length) {
      <app-empty class="card">{{ labels.pageEmpty }}</app-empty>
    } @else {
      <div class="grid">
        @for (a of data.value(); track a.personne + a.formationId) {
          <app-achievement-card [item]="a" />
        }
      </div>
    }
  `,
})
export class AchievementsPage {
  private readonly auth = inject(AuthService);
  protected readonly labels = LABELS.shares;
  protected readonly data = httpResource<SharedAchievement[]>(() => {
    const me = this.auth.me();
    return me
      ? { url: '/api/reussites', params: { espace: me.space, compte: me.actor.id } }
      : undefined;
  });
}
