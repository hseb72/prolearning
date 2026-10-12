import { Component, computed, input } from '@angular/core';
import type { Reference } from '@shared/learning';
import { LABELS } from '../labels';

/** Références citées (`.refs`), avec le type d'accès à côté de chaque lien (CLAUDE.md, § 7). */
@Component({
  selector: 'app-references',
  template: `
    @if (items().length) {
      <ul class="refs">
        @for (ref of items(); track ref.id) {
          <li>
            @if (ref.url) {
              <a [href]="ref.url" target="_blank" rel="noopener noreferrer"
                >{{ ref.titre }}<span class="visually-hidden">{{ labels.newTab }}</span></a
              >
            } @else {
              <b>{{ ref.titre }}</b>
            }
            <span [class]="'acc ' + ref.acces">{{ labels.access[ref.acces] }}</span
            ><br />
            <span class="muted small"
              >{{ ref.source
              }}{{ ref.langue && ref.langue !== 'fr' ? ' · ' + labels.language(ref.langue) : ''
              }}{{ ref.note ? ' · ' + ref.note : '' }}</span
            >
          </li>
        }
      </ul>
    }
  `,
})
export class References {
  readonly ids = input.required<readonly string[]>();
  readonly all = input.required<readonly Reference[]>();
  protected readonly labels = LABELS.ui;
  protected readonly items = computed(() =>
    this.ids()
      .map((id) => this.all().find((r) => r.id === id))
      .filter((r): r is Reference => !!r),
  );
}
