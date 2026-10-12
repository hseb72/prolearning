import { httpResource } from '@angular/common/http';
import { Component, computed, inject, input } from '@angular/core';
import { BADGES, type BadgeId } from '@shared/gamification';
import type { LearnerProfile } from '@shared/learning';
import { AuthService } from '../../core/auth';
import { LABELS } from '../../labels';
import { Badge } from '../../ui/badge';
import { ProgressBar, ProgressRing } from '../../ui/progress';

/**
 * Carte de niveau et badges de l'apprenant (SPEC-UI, capture 10), visibles de lui seul :
 * anneau des modules terminés, niveau, points et barre vers le niveau suivant, badges.
 * L'action principale (« Commencer : … ») est passée en contenu.
 */
@Component({
  selector: 'app-learner-profile',
  imports: [Badge, ProgressBar, ProgressRing],
  template: `
    @if (profile.value(); as p) {
      <section class="hero" aria-labelledby="profile-heading">
        <h2 id="profile-heading" class="visually-hidden">{{ labels.profileHeading }}</h2>
        <div class="card">
          <div class="xp">
            <app-progress-ring [value]="done()" [max]="total()" />
            <div class="grow">
              <p class="eyebrow muted">{{ labels.levelEyebrow }}</p>
              <div class="lvl">{{ p.niveau.niveau.nom }}</div>
              <p class="small muted">
                {{
                  labels.levelLine(
                    p.points,
                    p.niveau.prochainSeuil === null ? null : p.niveau.prochainSeuil - p.points
                  )
                }}
              </p>
              <app-progress-bar [value]="percent()" [label]="labels.levelProgress" />
            </div>
          </div>
          <div class="cta"><ng-content /></div>
        </div>
        <div class="card">
          <p class="eyebrow muted">{{ labels.badgesCount(p.badges.length, badgeIds.length) }}</p>
          <div class="badges">
            @for (id of badgeIds; track id) {
              <app-badge [id]="id" [earned]="p.badges.includes(id)" />
            }
          </div>
          @if (!p.badges.length) {
            <p class="small muted">{{ labels.noBadge }}</p>
          }
        </div>
      </section>
    }
  `,
  styles: `
    .grow {
      flex: 1;
      min-width: 0;
    }
    .lvl {
      margin: 2px 0;
    }
    .eyebrow.muted {
      color: var(--muted);
      margin-bottom: 4px;
    }
    .cta:not(:empty) {
      margin-top: 18px;
    }
    .badges + p {
      margin: 10px 0 0;
    }
  `,
})
export class LearnerProfileCard {
  private readonly auth = inject(AuthService);
  /** Modules terminés et modules au total, pour l'anneau. */
  readonly done = input(0);
  readonly total = input(0);
  protected readonly labels = LABELS.learning;
  protected readonly badgeIds = Object.keys(BADGES) as BadgeId[];
  protected readonly profile = httpResource<LearnerProfile>(() => {
    const me = this.auth.me();
    return me
      ? { url: '/api/parcours/profil', params: { espace: me.space, compte: me.actor.id } }
      : undefined;
  });

  protected readonly percent = computed(() => {
    const p = this.profile.value();
    if (!p) return 0;
    const next = p.niveau.prochainSeuil;
    if (next === null) return 100;
    const from = p.niveau.niveau.seuil;
    return ((p.points - from) / (next - from)) * 100;
  });
}
