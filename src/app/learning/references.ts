import { Component, computed, input } from '@angular/core';
import type { Reference } from '@shared/learning';
import { LABELS } from '../labels';

/** Références citées, avec le type d'accès à côté de chaque lien (CLAUDE.md, § 7). */
@Component({
  selector: 'app-references',
  template: `
    @if (items().length) {
      <ul class="references">
        @for (ref of items(); track ref.id) {
          <li>
            @if (ref.url) {
              <a [href]="ref.url" target="_blank" rel="noopener noreferrer"
                >{{ ref.titre }}<span class="visually-hidden"> (nouvel onglet)</span></a
              >
            } @else {
              <cite>{{ ref.titre }}</cite>
            }
            — {{ ref.source }}
            <span class="access" [attr.data-access]="ref.acces">{{
              labels.access[ref.acces]
            }}</span>
            @if (ref.note) {
              <br /><span class="note">{{ ref.note }}</span>
            }
          </li>
        }
      </ul>
    }
  `,
  styles: `
    .references {
      padding-left: var(--space-3);
    }
    li {
      margin-bottom: var(--space-1);
    }
    .access {
      display: inline-block;
      margin-left: 0.25rem;
      padding: 0 0.5em;
      border: 1px solid var(--color-border);
      border-radius: 999px;
      font-size: 0.8125rem;
    }
    .note {
      font-size: 0.875rem;
      color: var(--color-text-muted);
    }
  `,
})
export class References {
  readonly ids = input.required<readonly string[]>();
  readonly all = input.required<readonly Reference[]>();
  protected readonly labels = LABELS.learning;
  protected readonly items = computed(() =>
    this.ids()
      .map((id) => this.all().find((r) => r.id === id))
      .filter((r): r is Reference => !!r),
  );
}
