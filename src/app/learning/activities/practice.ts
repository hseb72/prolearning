import { Component, computed, effect, inject, input, output, signal } from '@angular/core';
import type { PracticeFile } from '@shared/learning';
import { LABELS } from '../../labels';
import { copyText, download } from '../clipboard';
import { LearningService } from '../learning.service';
import { Md } from '../md';
import { References } from '../references';
import { createZip } from '../zip';
import type { ActivityContext, ActivityOf, ActivityProgress } from './activity-context';

/**
 * Travaux pratiques guidés (§ 6.8, format 1.1) : l'apprenant travaille sur son poste ; le
 * lecteur fournit les fichiers (copie, téléchargement, archive), les étapes et la liste de
 * vérification. La plateforme n'exécute rien.
 */
@Component({
  selector: 'app-practice',
  imports: [Md, References],
  template: `
    <section aria-labelledby="tp-objectif">
      <h2 id="tp-objectif">{{ labels.objective }}</h2>
      <app-md [text]="activity().objectif" [glossary]="ctx().glossary" />
    </section>

    @if (activity().environnement; as env) {
      <section aria-labelledby="tp-env">
        <h2 id="tp-env">{{ labels.environment }}</h2>
        <app-md [text]="env" [glossary]="ctx().glossary" />
      </section>
    }

    @if (activity().fichiers.length) {
      <section aria-labelledby="tp-fichiers">
        <h2 id="tp-fichiers">{{ labels.files }}</h2>
        <button
          class="button"
          type="button"
          [attr.aria-label]="labels.downloadAllLabel(activity().fichiers.length)"
          (click)="downloadAll()"
        >
          {{ labels.downloadAll }}
        </button>
        <ul class="tp-files">
          @for (file of activity().fichiers; track file.nom) {
            <li class="tp-file">
              <h3>
                <code>{{ file.nom }}</code>
                @if (file.langage) {
                  <span class="hint"> · {{ file.langage }}</span>
                }
              </h3>
              @if (file.description) {
                <p class="hint">{{ file.description }}</p>
              }
              <div class="actions">
                <button
                  class="button"
                  type="button"
                  [attr.aria-label]="labels.copyFileLabel(file.nom)"
                  (click)="copy(file)"
                >
                  {{ labels.copyFile }}
                </button>
                <button
                  class="button"
                  type="button"
                  [attr.aria-label]="labels.downloadFileLabel(file.nom)"
                  (click)="downloadOne(file)"
                >
                  {{ labels.downloadFile }}
                </button>
              </div>
              <pre><code>{{ file.contenu }}</code></pre>
            </li>
          }
        </ul>
        <p class="visually-hidden" role="status">{{ announce() }}</p>
      </section>
    }

    <section aria-labelledby="tp-etapes">
      <h2 id="tp-etapes">{{ labels.steps }}</h2>
      <ol class="tp-steps">
        @for (step of activity().etapes; track $index) {
          <li>
            <h3>{{ labels.step($index + 1, step.titre) }}</h3>
            <app-md [text]="step.markdown" [glossary]="ctx().glossary" />
            @if (step.resultat) {
              <div class="encadre">
                <p class="encadre-titre">{{ labels.expected }}</p>
                <app-md [text]="step.resultat" [glossary]="ctx().glossary" />
              </div>
            }
          </li>
        }
      </ol>
    </section>

    @if (activity().solution; as solution) {
      <details class="approfondir">
        <summary>{{ solution.titre }}</summary>
        <app-md [text]="solution.markdown" [glossary]="ctx().glossary" />
        @if (solution.references?.length) {
          <app-references [ids]="solution.references!" [all]="ctx().references" />
        }
      </details>
    }

    <form class="tp-check" (submit)="submit($event)">
      <fieldset>
        <legend>{{ labels.check }}</legend>
        <p class="hint">{{ labels.checkHint }}</p>
        @for (v of activity().verification; track v.id) {
          <div class="option">
            <input
              type="checkbox"
              [id]="'verif-' + v.id"
              [checked]="checked().has(v.id)"
              (change)="toggle(v.id, $any($event.target).checked)"
            />
            <label [for]="'verif-' + v.id"
              ><app-md [text]="v.texte" [inline]="true" [glossary]="ctx().glossary"
            /></label>
          </div>
        }
      </fieldset>
      <button class="button primary" type="submit" [disabled]="busy()">{{ labels.submit }}</button>
    </form>
    <div aria-live="polite">
      @if (message(); as m) {
        <p class="message" [class.success]="m.ok" [class.error]="!m.ok">{{ m.text }}</p>
      }
    </div>

    @if (activity().nettoyage; as cleanup) {
      <section aria-labelledby="tp-nettoyage">
        <h2 id="tp-nettoyage">{{ labels.cleanup }}</h2>
        <app-md [text]="cleanup" [glossary]="ctx().glossary" />
      </section>
    }

    @if (activity().references.length) {
      <app-references [ids]="activity().references" [all]="ctx().references" />
    }
  `,
  styleUrl: './activities.scss',
})
export class Practice {
  private readonly service = inject(LearningService);
  readonly ctx = input.required<ActivityContext>();
  readonly progressed = output<ActivityProgress>();
  protected readonly labels = LABELS.learning.practice;
  protected readonly common = LABELS.learning;
  protected readonly activity = computed(() => this.ctx().activity as ActivityOf<'pratique'>);
  protected readonly checked = signal(new Set<string>());
  protected readonly busy = signal(false);
  protected readonly announce = signal('');
  protected readonly message = signal<{ ok: boolean; text: string } | null>(null);

  constructor() {
    // Déjà terminé : la liste revient cochée.
    effect(() => {
      const c = this.ctx();
      if (c.state.statut === 'faite') {
        this.checked.set(new Set(this.activity().verification.map((v) => v.id)));
        this.message.set({ ok: true, text: this.labels.alreadyDone });
      }
    });
  }

  protected toggle(id: string, on: boolean): void {
    const next = new Set(this.checked());
    if (on) next.add(id);
    else next.delete(id);
    this.checked.set(next);
  }

  protected async copy(file: PracticeFile): Promise<void> {
    const ok = await copyText(file.contenu);
    this.announce.set(ok ? this.labels.fileCopied(file.nom) : this.common.copyFailed);
  }

  protected downloadOne(file: PracticeFile): void {
    download(file.nom.split('/').at(-1)!, file.contenu, 'text/plain;charset=utf-8');
  }

  protected downloadAll(): void {
    const zip = createZip(
      this.activity().fichiers.map((f) => ({ name: f.nom, content: f.contenu })),
    );
    download(`${this.activity().id}.zip`, zip, 'application/zip');
  }

  protected async submit(event: SubmitEvent): Promise<void> {
    event.preventDefault();
    const missing = this.activity().verification.filter((v) => !this.checked().has(v.id)).length;
    if (missing) {
      this.message.set({ ok: false, text: this.labels.incomplete(missing) });
      return;
    }
    const c = this.ctx();
    this.busy.set(true);
    try {
      const result = await this.service.checkPractice(c.formationId, c.moduleId, c.activity.id, [
        ...this.checked(),
      ]);
      const points = result.etat.points ? ` ${this.common.earned(result.etat.points)}` : '';
      this.message.set({ ok: true, text: `${this.labels.done}${points}` });
      this.progressed.emit(result);
    } catch {
      this.message.set({ ok: false, text: this.common.failed });
    } finally {
      this.busy.set(false);
    }
  }
}
