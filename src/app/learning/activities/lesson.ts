import { Component, computed, input, output } from '@angular/core';
import { LABELS } from '../../labels';
import { Md } from '../md';
import { References } from '../references';
import { Callout, type CalloutVariant } from '../../ui/callout';
import { Deepen } from '../../ui/deepen';
import type { ActivityContext, ActivityOf, ActivityProgress } from './activity-context';
import { CompleteButton } from './complete-button';

/** Leçon : blocs dans l'ordre ; « Approfondir » replié par défaut (§ 6.1). */
@Component({
  selector: 'app-lesson',
  imports: [Md, References, CompleteButton, Callout, Deepen],
  template: `
    @for (bloc of activity().blocs; track $index) {
      @switch (bloc.type) {
        @case ('texte') {
          <app-md [text]="bloc.markdown" [glossary]="ctx().glossary" />
        }
        @case ('encadre') {
          <app-callout [variant]="variant(bloc.variante)" [heading]="bloc.titre ?? ''">
            <app-md [text]="bloc.markdown" [glossary]="ctx().glossary" />
          </app-callout>
        }
        @case ('approfondir') {
          <app-deepen class="approfondir" [heading]="bloc.titre">
            <app-md [text]="bloc.markdown" [glossary]="ctx().glossary" />
            @if (bloc.references?.length) {
              <p class="eyebrow refs-title">{{ labels.goFurtherRefs }}</p>
              <app-references [ids]="bloc.references!" [all]="ctx().references" />
            }
          </app-deepen>
        }
        @case ('image') {
          <figure class="image">
            <p class="image-absente">{{ labels.imageMissing(bloc.alt) }}</p>
            @if (bloc.legende) {
              <figcaption class="small muted">{{ bloc.legende }}</figcaption>
            }
          </figure>
        }
        @case ('video') {
          <div class="video">
            <p>
              <a class="link" [href]="bloc.url" target="_blank" rel="noopener noreferrer"
                >▶ {{ labels.video(bloc.titre)
                }}<span class="visually-hidden"> (nouvel onglet)</span></a
              >
            </p>
            @if (bloc.transcription) {
              <app-deepen [heading]="labels.transcript" [tag]="labels.text">
                <app-md [text]="bloc.transcription" [glossary]="ctx().glossary" />
              </app-deepen>
            }
          </div>
        }
        @case ('references') {
          <section class="refs-block">
            <h3>{{ labels.references }}</h3>
            <app-references [ids]="bloc.ids" [all]="ctx().references" />
          </section>
        }
      }
    }
    <app-complete-button [ctx]="ctx()" (progressed)="progressed.emit($event)" />
  `,
  styleUrl: './activities.scss',
})
export class Lesson {
  readonly ctx = input.required<ActivityContext>();
  readonly progressed = output<ActivityProgress>();
  protected readonly labels = LABELS.learning;
  protected readonly activity = computed(() => this.ctx().activity as ActivityOf<'lecon'>);

  /** Variante d'encadré du format (§ 6.1), « exemple » si inconnue. */
  protected variant(v: string): CalloutVariant {
    return (v in LABELS.ui.callouts ? v : 'exemple') as CalloutVariant;
  }
}
