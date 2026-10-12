import { Component, computed, input } from '@angular/core';
import type { GlossaryEntry } from '@shared/learning';
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
  readonly text = input.required<string>();
  readonly glossary = input<readonly GlossaryEntry[]>([]);
  readonly inline = input(false);

  private readonly renderer = computed(() => createMarkdown(this.glossary()));
  protected readonly html = computed(() =>
    this.inline() ? this.renderer().inline(this.text()) : this.renderer().block(this.text()),
  );
}
