import type { GlossaryEntry } from '@shared/learning';
import { Marked, type Tokens } from 'marked';

/**
 * Rendu du markdown des formations importées (§ 9 du format) : CommonMark + tableaux GFM,
 * sans HTML brut (ignoré), liens http(s) seulement (ouverts dans un nouvel onglet),
 * termes du glossaire `[[terme]]` avec leur définition. Le résultat passe en plus par le
 * nettoyage HTML d'Angular ([innerHTML]) : deux barrières plutôt qu'une.
 */
const ESCAPES: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
};
export const escapeHtml = (text: string) => text.replace(/[&<>"']/g, (c) => ESCAPES[c]!);

const NEW_TAB = ' (nouvel onglet)';

export function createMarkdown(glossary: readonly GlossaryEntry[] = []) {
  const definitions = new Map(glossary.map((g) => [g.terme.toLocaleLowerCase('fr'), g.definition]));
  const marked = new Marked({ gfm: true, breaks: false, async: false });

  marked.use({
    extensions: [
      {
        name: 'glossaire',
        level: 'inline',
        start: (src: string) => src.indexOf('[['),
        tokenizer(src: string) {
          const match = /^\[\[([^\]\n]{1,100})\]\]/.exec(src);
          return match ? { type: 'glossaire', raw: match[0], terme: match[1]!.trim() } : undefined;
        },
        renderer(token) {
          const terme = (token as unknown as { terme: string }).terme;
          const definition = definitions.get(terme.toLocaleLowerCase('fr'));
          return definition
            ? `<abbr class="glossaire" title="${escapeHtml(definition)}">${escapeHtml(terme)}</abbr>`
            : escapeHtml(terme);
        },
      },
    ],
    renderer: {
      // HTML brut : ignoré (§ 9).
      html: () => '',
      link(
        this: { parser: { parseInline(tokens: Tokens.Generic[]): string } },
        token: Tokens.Link,
      ) {
        const text = this.parser.parseInline(token.tokens);
        if (!/^https?:\/\//i.test(token.href)) return text;
        const title = token.title ? ` title="${escapeHtml(token.title)}"` : '';
        return `<a href="${escapeHtml(token.href)}"${title} target="_blank" rel="noopener noreferrer">${text}<span class="visually-hidden">${NEW_TAB}</span></a>`;
      },
      // Les images externes sont bloquées par la politique de sécurité du site ; les
      // images jointes arriveront avec les archives .formation.zip. On garde le texte.
      image(token: Tokens.Image) {
        return `<span class="image-absente">[Image : ${escapeHtml(token.text || token.title || '')}]</span>`;
      },
    },
  });

  return {
    block: (markdown: string) => marked.parse(markdown ?? '') as string,
    inline: (markdown: string) => marked.parseInline(markdown ?? '') as string,
  };
}
