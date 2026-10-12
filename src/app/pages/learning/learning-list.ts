import { httpResource } from '@angular/common/http';
import { Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import type { FormationCard } from '@shared/learning';
import { AuthService } from '../../core/auth';
import { LABELS } from '../../labels';
import { Md } from '../../learning/md';
import { LearnerProfileCard } from './profile';

/** Parcours en ligne publiés dans l'espace, avec la progression de l'apprenant. */
@Component({
  selector: 'app-learning-list',
  imports: [RouterLink, Md, LearnerProfileCard],
  template: `
    <h1>{{ labels.title }}</h1>
    <p>{{ labels.intro }}</p>
    <app-learner-profile />
    @if (cards.isLoading() && !cards.hasValue()) {
      <p role="status">{{ labels.loading }}</p>
    } @else if (cards.error()) {
      <p class="message error" role="alert">{{ labels.loadFailed }}</p>
    } @else if (!cards.value()?.length) {
      <p>{{ labels.empty }}</p>
    } @else {
      <ul class="cards">
        @for (card of cards.value(); track card.id) {
          <li class="card">
            <h2>{{ card.titre }}</h2>
            @if (card.sousTitre) {
              <p class="subtitle">{{ card.sousTitre }}</p>
            }
            <p class="hint">
              {{ card.theme }} · {{ labels.duration(card.dureeEstimeeMinutes) }}
              @if (card.niveau) {
                · {{ labels.levels[card.niveau] }}
              }
            </p>
            <app-md [text]="card.resume" />
            <p>
              <progress
                [max]="card.modulesTotal"
                [value]="card.modulesTermines"
                aria-hidden="true"
              ></progress>
              {{ labels.modules(card.modulesTermines, card.modulesTotal) }} ·
              {{ labels.points(card.points) }}
            </p>
            <a
              class="button primary"
              [routerLink]="['/parcours', card.id]"
              [attr.aria-label]="labels.openLabel(card.titre)"
            >
              {{ labels.open }}
            </a>
          </li>
        }
      </ul>
    }
  `,
  styleUrl: './learning.scss',
})
export class LearningListPage {
  private readonly auth = inject(AuthService);
  protected readonly labels = LABELS.learning;
  protected readonly cards = httpResource<FormationCard[]>(() => {
    const me = this.auth.me();
    return me
      ? { url: '/api/parcours', params: { espace: me.space, compte: me.actor.id } }
      : undefined;
  });
}
