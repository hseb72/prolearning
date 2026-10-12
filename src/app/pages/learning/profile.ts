import { httpResource } from '@angular/common/http';
import { Component, inject } from '@angular/core';
import { BADGES } from '@shared/gamification';
import type { LearnerProfile } from '@shared/learning';
import { AuthService } from '../../core/auth';
import { LABELS } from '../../labels';

/** Points, niveau et badges de l'apprenant (visibles de lui seul). */
@Component({
  selector: 'app-learner-profile',
  template: `
    @if (profile.value(); as p) {
      <section class="profile" aria-labelledby="profile-heading">
        <h2 id="profile-heading">{{ labels.profileHeading }}</h2>
        <p class="level">
          <strong>{{ labels.level(p.niveau.niveau.numero, p.niveau.niveau.nom) }}</strong> ·
          {{ labels.points(p.points) }}
        </p>
        <p class="hint">
          {{
            p.niveau.prochainSeuil === null
              ? labels.maxLevel
              : labels.nextLevel(p.niveau.prochainSeuil - p.points)
          }}
        </p>
        <h3>{{ labels.badges }}</h3>
        @if (p.badges.length) {
          <ul class="badges">
            @for (id of p.badges; track id) {
              <li class="badge-item">
                <strong>{{ badges[id].nom }}</strong>
                <span class="hint">{{ badges[id].description }}</span>
              </li>
            }
          </ul>
        } @else {
          <p class="hint">{{ labels.noBadge }}</p>
        }
      </section>
    }
  `,
  styleUrl: './learning.scss',
})
export class LearnerProfileCard {
  private readonly auth = inject(AuthService);
  protected readonly labels = LABELS.learning;
  protected readonly badges = BADGES;
  protected readonly profile = httpResource<LearnerProfile>(() => {
    const me = this.auth.me();
    return me
      ? { url: '/api/parcours/profil', params: { espace: me.space, compte: me.actor.id } }
      : undefined;
  });
}
