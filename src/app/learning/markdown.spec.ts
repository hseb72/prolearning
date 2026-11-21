import { createMarkdown } from './markdown';

describe('markdown des formations', () => {
  const md = createMarkdown([
    { terme: 'ADM', definition: 'Méthode de développement <d’architecture>.' },
  ]);

  it('rend le markdown courant et les tableaux', () => {
    expect(md.block('**gras** et *italique*')).toContain('<strong>gras</strong>');
    expect(md.block('| a | b |\n|---|---|\n| 1 | 2 |')).toContain('<table>');
  });

  it('ignore le HTML brut : balises retirées, texte gardé', () => {
    const html = md.block('Avant <script>alert(1)</script> <b>après</b>');
    expect(html).not.toContain('<script');
    expect(html).not.toContain('<b>');
    expect(md.block('Texte <b>gras</b>')).toBe('<p>Texte gras</p>\n');
    expect(md.block('<div onclick="x()">Bloc <i>brut</i></div>')).toBe('Bloc brut');
  });

  it('affiche le code tel quel, balises comprises (CommonMark)', () => {
    // Code en ligne : le texte <avis> est visible, échappé, jamais interprété.
    const inline = md.block('Utilisez `<avis>`');
    expect(inline).toBe('<p>Utilisez <code>&lt;avis&gt;</code></p>\n');
    const rendered = document.createElement('div');
    rendered.innerHTML = inline;
    expect(rendered.textContent?.trim()).toBe('Utilisez <avis>');
    expect(rendered.querySelector('avis')).toBeNull();

    // Bloc délimité : restitué à l'identique.
    const source = '<document numero="1">\n  <avis>oui</avis>\n</document>';
    const block = document.createElement('div');
    block.innerHTML = md.block('```xml\n' + source + '\n```');
    expect(block.querySelector('pre code')?.textContent).toBe(source + '\n');
    expect(block.querySelector('document')).toBeNull();
  });

  it('n’accepte que les liens http(s), ouverts dans un nouvel onglet', () => {
    const ok = md.inline('[site](https://example.org)');
    expect(ok).toContain('href="https://example.org"');
    expect(ok).toContain('target="_blank"');
    expect(ok).toContain('rel="noopener noreferrer"');
    expect(ok).toContain('(nouvel onglet)');
    expect(md.inline('[piège](javascript:alert(1))')).toBe('piège');
  });

  it('affiche la définition des termes du glossaire', () => {
    const rendered = document.createElement('div');
    rendered.innerHTML = md.inline('La [[adm]] décrit');
    const abbr = rendered.querySelector('abbr.glossaire');
    expect(abbr?.textContent).toBe('adm');
    // Le texte de la définition reste du texte, même avec des chevrons.
    expect(abbr?.getAttribute('title')).toBe('Méthode de développement <d’architecture>.');
    expect(abbr?.children).toHaveLength(0);
    expect(md.inline('[[inconnu]]')).toBe('inconnu');
  });

  it('remplace les images par leur texte', () => {
    expect(md.inline('![schéma](https://example.org/a.png)')).toBe(
      '<span class="image-absente">[Image : schéma]</span>',
    );
  });
});
