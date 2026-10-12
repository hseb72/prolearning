import { Component, computed, input, output } from '@angular/core';
import { LABELS } from '../../labels';
import { Md } from '../md';
import { References } from '../references';
import type { ActivityContext, ActivityOf, ActivityProgress } from './activity-context';
import { CompleteButton } from './complete-button';

/** Leçon : blocs dans l'ordre ; « Approfondir » replié par défaut (§ 6.1). */
@Component({
  selector: 'app-lesson',
  imports: [Md, References, CompleteButton],
  template: `
    @for (bloc of activity().blocs; track $index) {
      @switch (bloc.type) {
        @case ('texte') {
          <app-md [text]="bloc.markdown" [glossary]="ctx().glossary" />
        }
        @case ('encadre') {
          <aside class="encadre" [attr.data-variante]="bloc.variante">
            <p class="encadre-titre">{{ bloc.titre || labels.variants[bloc.variante] }}</p>
            <app-md [text]="bloc.markdown" [glossary]="ctx().glossary" />
          </aside>
        }
        @case ('approfondir') {
          <details class="approfondir">
            <summary>{{ labels.goFurther }} : {{ bloc.titre }}</summary>
            <app-md [text]="bloc.markdown" [glossary]="ctx().glossary" />
            @if (bloc.references?.length) {
              <app-references [ids]="bloc.references!" [all]="ctx().references" />
            }
          </details>
        }
        @case ('image') {
          <figure class="image">
            <p class="image-absente">{{ labels.imageMissing(bloc.alt) }}</p>
            @if (bloc.legende) {
              <figcaption>{{ bloc.legende }}</figcaption>
            }
          </figure>
        }
        @case ('video') {
          <div class="video">
            <a [href]="bloc.url" target="_blank" rel="noopener noreferrer"
              >{{ labels.video(bloc.titre)
              }}<span class="visually-hidden"> (nouvel onglet)</span></a
            >
            @if (bloc.transcription) {
              <details>
                <summary>{{ labels.transcript }}</summary>
                <app-md [text]="bloc.transcription" [glossary]="ctx().glossary" />
              </details>
            }
          </div>
        }
        @case ('references') {
          <section class="refs">
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
}
