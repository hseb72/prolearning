/**
 * Chemins des constats au style du § 11 du format : `modules[0].activites[3]`,
 * à partir d'un pointeur JSON (`/modules/0/activites/3`).
 */
export function pointerToPath(pointer: string): string {
  if (!pointer) return '';
  return pointer
    .split('/')
    .slice(1)
    .map((part) => part.replace(/~1/g, '/').replace(/~0/g, '~'))
    .reduce(
      (path, part) => (/^\d+$/.test(part) ? `${path}[${part}]` : path ? `${path}.${part}` : part),
      '',
    );
}
