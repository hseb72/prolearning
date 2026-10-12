import { crc32, createZip } from './zip';

describe('archive .zip des fichiers de TP', () => {
  it('calcule le CRC-32 standard', () => {
    expect(crc32(new TextEncoder().encode('123456789'))).toBe(0xcbf43926);
  });

  it('écrit une archive lisible, arborescence et accents compris', () => {
    const zip = createZip([
      { name: 'deployment.yaml', content: 'apiVersion: apps/v1\n' },
      { name: 'base/kustomization.yaml', content: 'resources: []\n# déploiement\n' },
    ]);
    const view = new DataView(zip.buffer);
    // En-tête local, puis fin du répertoire central avec ses deux entrées.
    expect(view.getUint32(0, true)).toBe(0x04034b50);
    const end = zip.length - 22;
    expect(view.getUint32(end, true)).toBe(0x06054b50);
    expect(view.getUint16(end + 10, true)).toBe(2);
    const central = view.getUint32(end + 16, true);
    expect(view.getUint32(central, true)).toBe(0x02014b50);
    const text = new TextDecoder().decode(zip);
    expect(text).toContain('base/kustomization.yaml');
    expect(text).toContain('# déploiement');
  });
});
