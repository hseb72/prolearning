import { csvCell, parseCsv } from '../../shared/csv.js';

describe('lecture CSV', () => {
  it('devine le séparateur, lit les guillemets et garde les numéros de ligne', () => {
    const text = '﻿a;b\r\n\r\n"x;1";"dit ""oui"""\n"sur\ndeux lignes";z\n';
    expect(parseCsv(text)).toEqual([
      { line: 1, cells: ['a', 'b'] },
      { line: 3, cells: ['x;1', 'dit "oui"'] },
      { line: 4, cells: ['sur\ndeux lignes', 'z'] },
    ]);
    expect(parseCsv('a,b\n1,2')).toEqual([
      { line: 1, cells: ['a', 'b'] },
      { line: 2, cells: ['1', '2'] },
    ]);
    expect(parseCsv('a\tb\n1\t2')[1]!.cells).toEqual(['1', '2']);
  });

  it('écrit un champ qui contient le séparateur', () => {
    expect(csvCell('Dupont; Léa')).toBe('"Dupont; Léa"');
    expect(csvCell('simple')).toBe('simple');
  });
});
