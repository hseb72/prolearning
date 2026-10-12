import { LABELS } from '../labels';

/** Copie un texte dans le presse-papiers (avec repli pour les navigateurs anciens). */
export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const area = document.createElement('textarea');
    area.value = text;
    area.setAttribute('readonly', '');
    area.style.position = 'fixed';
    area.style.opacity = '0';
    document.body.append(area);
    area.select();
    const ok = document.execCommand('copy');
    area.remove();
    return ok;
  }
}

/** Fait télécharger un texte ou des octets sous le nom donné. */
export function download(name: string, content: string | Uint8Array, type: string): void {
  const blob = new Blob([content as BlobPart], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = name;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/**
 * Ajoute un bouton « Copier » à chaque bloc de code rendu dans `root` (§ 9 du format).
 * Le bouton et son annonce sont créés en DOM : le HTML rendu par le markdown, nettoyé par
 * Angular, ne peut pas porter de bouton ni d'écouteur.
 */
export function addCopyButtons(root: HTMLElement): void {
  const labels = LABELS.learning;
  for (const pre of Array.from(root.querySelectorAll('pre'))) {
    if (pre.parentElement?.classList.contains('code-block')) continue;
    const block = document.createElement('div');
    block.className = 'code-block';
    pre.replaceWith(block);
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'cpy';
    button.textContent = labels.copy;
    button.setAttribute('aria-label', labels.copyCode);
    const status = document.createElement('span');
    status.className = 'visually-hidden';
    status.setAttribute('role', 'status');
    button.addEventListener('click', async () => {
      const ok = await copyText(pre.textContent ?? '');
      button.textContent = ok ? labels.copied : labels.copy;
      status.textContent = ok ? labels.copiedAnnounce : labels.copyFailed;
      setTimeout(() => (button.textContent = labels.copy), 1800);
    });
    block.append(button, pre, status);
  }
}
