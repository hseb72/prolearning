import { badgesFor, levelFor } from './gamification.js';

describe('ludification', () => {
  it('donne le niveau et le seuil suivant', () => {
    expect(levelFor(0)).toEqual({
      niveau: { numero: 1, nom: 'Découverte', seuil: 0 },
      prochainSeuil: 100,
    });
    expect(levelFor(299).niveau.nom).toBe('Initié');
    expect(levelFor(300).niveau.nom).toBe('Praticien');
    expect(levelFor(5000)).toEqual({
      niveau: { numero: 5, nom: 'Expert', seuil: 1000 },
      prochainSeuil: null,
    });
  });

  it('attribue les badges communs à partir des résultats', () => {
    const none = {
      activitesTerminees: 0,
      modulesTermines: 0,
      quizParfaits: 0,
      scenariosTroisEtoiles: 0,
      formationsTerminees: 0,
    };
    expect(badgesFor(none)).toEqual([]);
    expect(badgesFor({ ...none, activitesTerminees: 3, quizParfaits: 1 })).toEqual([
      'premier-pas',
      'sans-faute',
    ]);
  });
});
