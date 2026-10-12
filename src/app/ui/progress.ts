import { Component, computed, input } from '@angular/core';
import { LABELS } from '../labels';

const RADIUS = 34;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

/** Anneau de progression (`.ring`, 84 px) : « n/total » au centre. */
@Component({
  selector: 'app-progress-ring',
  host: { role: 'img', '[attr.aria-label]': 'label()' },
  template: `
    <svg class="ring" viewBox="0 0 84 84" aria-hidden="true">
      <circle cx="42" cy="42" [attr.r]="radius" fill="none" stroke="var(--chip)" stroke-width="8" />
      @if (value() > 0) {
        <circle
          cx="42"
          cy="42"
          [attr.r]="radius"
          fill="none"
          stroke="var(--accent-fill)"
          stroke-width="8"
          stroke-linecap="round"
          [attr.stroke-dasharray]="dash()"
          transform="rotate(-90 42 42)"
        />
      }
      <text
        x="42"
        y="47"
        text-anchor="middle"
        font-size="18"
        font-weight="700"
        fill="var(--ink)"
        font-family="IBM Plex Sans, Arial"
      >
        {{ value() }}/{{ max() }}
      </text>
    </svg>
  `,
})
export class ProgressRing {
  readonly value = input.required<number>();
  readonly max = input.required<number>();
  protected readonly radius = RADIUS;
  protected readonly dash = computed(() => {
    const ratio = this.max() > 0 ? Math.min(1, this.value() / this.max()) : 0;
    return `${CIRCUMFERENCE * ratio} ${CIRCUMFERENCE}`;
  });
  protected readonly label = computed(() => LABELS.ui.ring(this.value(), this.max()));
}

/** Barre de progression (`.bar`, 8 px). */
@Component({
  selector: 'app-progress-bar',
  host: {
    class: 'bar',
    role: 'progressbar',
    'aria-valuemin': '0',
    'aria-valuemax': '100',
    '[attr.aria-valuenow]': 'percent()',
    '[attr.aria-valuetext]': 'text()',
    '[attr.aria-label]': 'label()',
  },
  template: `<i [style.width.%]="percent()"></i>`,
})
export class ProgressBar {
  /** Avancement, de 0 à 100. */
  readonly value = input.required<number>();
  readonly label = input.required<string>();
  protected readonly percent = computed(() => Math.max(0, Math.min(100, Math.round(this.value()))));
  protected readonly text = computed(() => LABELS.ui.progress(this.percent()));
}
