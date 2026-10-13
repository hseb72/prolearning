import { httpResource } from '@angular/common/http';
import { Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import type { FormationCard } from '@shared/learning';
import { AuthService } from '../../core/auth';
import { LABELS } from '../../labels';
import { CourseCard } from '../../ui/course-card';
import { EmptyState } from '../../ui/empty';
import { Tag } from '../../ui/tag';
import { LearnerProfileCard } from './profile';

/**
 * « Mon parcours en ligne » (SPEC-UI, capture 10) : carte de niveau et badges, puis les
 * parcours publiés dans l'espace, avec la progression de l'apprenant.
 */
@Component({
  selector: 'app-learning-list',
  imports: [RouterLink, CourseCard, EmptyState, Tag, LearnerProfileCard],
  template: `
    <p class="eyebrow">{{ labels.eyebrow }}</p>
    <h1>{{ labels.listTitle }}</h1>
    <p class="lead">{{ labels.intro }}</p>
    <p>
      <a class="link" routerLink="/reussites">{{ shares.pageLink }}</a>
    </p>
    @if (cards.isLoading() && !cards.hasValue()) {
      <p role="status">{{ labels.loading }}</p>
    } @else if (cards.error()) {
      <p class="fb bad" role="alert">{{ labels.loadFailed }}</p>
    } @else {
      <app-learner-profile [done]="done()" [total]="total()">
        @if (next(); as n) {
          <a class="btn" [routerLink]="['/parcours', n.id]">
            {{ n.modulesTermines ? labels.resume : labels.start }} : {{ n.titre }}
          </a>
        }
      </app-learner-profile>
      @if (!cards.value()?.length) {
        <app-empty class="card">{{ labels.empty }}</app-empty>
      } @else {
        <div class="grid">
          @for (card of cards.value(); track card.id) {
            <app-course-card
              [theme]="card.theme"
              [heading]="card.titre"
              [modes]="['online']"
              [duration]="labels.duration(card.dureeEstimeeMinutes)"
              [info]="labels.cardInfo(card.modulesTermines, card.modulesTotal, card.points)"
            >
              @if (card.niveau) {
                <app-tag>{{ labels.levels[card.niveau] }}</app-tag>
              }
              <a
                class="btn small"
                [routerLink]="['/parcours', card.id]"
                [attr.aria-label]="labels.openLabel(card.titre)"
                >{{ labels.open }}</a
              >
            </app-course-card>
          }
        </div>
      }
    }
  `,
})
export class LearningListPage {
  private readonly auth = inject(AuthService);
  protected readonly labels = LABELS.learning;
  protected readonly shares = LABELS.shares;
  protected readonly cards = httpResource<FormationCard[]>(() => {
    const me = this.auth.me();
    return me
      ? { url: '/api/parcours', params: { espace: me.space, compte: me.actor.id } }
      : undefined;
  });
  protected readonly done = computed(() =>
    (this.cards.value() ?? []).reduce((n, c) => n + c.modulesTermines, 0),
  );
  protected readonly total = computed(() =>
    (this.cards.value() ?? []).reduce((n, c) => n + c.modulesTotal, 0),
  );
  /** Parcours à poursuivre : le premier commencé et non fini, sinon le premier non fini. */
  protected readonly next = computed(() => {
    const cards = this.cards.value() ?? [];
    const open = cards.filter((c) => c.modulesTermines < c.modulesTotal);
    return open.find((c) => c.modulesTermines > 0 || c.points > 0) ?? open[0] ?? null;
  });
}
