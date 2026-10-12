import { afterRenderEffect, Component, computed, ElementRef, inject, input } from '@angular/core';
import type { GlossaryEntry } from '@shared/learning';
import { addCopyButtons } from './clipboard';
import { createMarkdown } from './markdown';

/** Markdown d'une formation, rendu sans HTML brut et nettoyé (cf. markdown.ts). */
@Component({
  selector: 'app-md',
  template: `<div class="md" [class.inline]="inline()" [innerHTML]="html()"></div>`,
  styles: `
    :host {
      display: block;
    }
    .inline {
      display: inline;
    }
  `,
})
export class Md {
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  readonly text = input.required<string>();
  readonly glossary = input<readonly GlossaryEntry[]>([]);
  readonly inline = input(false);

  private readonly renderer = computed(() => createMarkdown(this.glossary()));
  protected readonly html = computed(() =>
    this.inline() ? this.renderer().inline(this.text()) : this.renderer().block(this.text()),
  );

  constructor() {
    // Après chaque rendu du markdown : un bouton « Copier » sur chaque bloc de code.
    afterRenderEffect(() => {
      this.html();
      addCopyButtons(this.host.nativeElement);
    });
  }
}
