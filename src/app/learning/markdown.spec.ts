import { createMarkdown } from './markdown';

describe('markdown des formations', () => {
  const md = createMarkdown([
    { terme: 'ADM', definition: 'Méthode de développement <d’architecture>.' },
  ]);

  it('rend le markdown courant et les tableaux', () => {
    expect(md.block('**gras** et *italique*')).toContain('<strong>gras</strong>');
    expect(md.block('| a | b |\n|---|---|\n| 1 | 2 |')).toContain('<table>');
  });

  it('ignore le HTML brut', () => {
    const html = md.block('Avant <script>alert(1)</script> <b>après</b>');
    expect(html).not.toContain('<script');
    expect(html).not.toContain('<b>');
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
    expect(md.inline('La [[adm]] décrit')).toContain(
      '<abbr class="glossaire" title="Méthode de développement &lt;d’architecture&gt;.">adm</abbr>',
    );
    expect(md.inline('[[inconnu]]')).toBe('inconnu');
  });

  it('remplace les images par leur texte', () => {
    expect(md.inline('![schéma](https://example.org/a.png)')).toBe(
      '<span class="image-absente">[Image : schéma]</span>',
    );
  });
});
