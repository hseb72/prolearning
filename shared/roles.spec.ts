import { hasRole, isRole, ROLES } from './roles.js';

describe('rôles', () => {
  it('sont cumulatifs, du collaborateur à l’administrateur', () => {
    expect(ROLES).toEqual(['employee', 'manager', 'training', 'admin']);
    expect(hasRole('admin', 'employee')).toBe(true);
    expect(hasRole('training', 'manager')).toBe(true);
    expect(hasRole('manager', 'training')).toBe(false);
    expect(hasRole('employee', 'manager')).toBe(false);
    expect(hasRole('manager', 'manager')).toBe(true);
  });

  it('refusent une valeur inconnue', () => {
    expect(isRole('admin')).toBe(true);
    expect(isRole('superadmin')).toBe(false);
    expect(isRole(null)).toBe(false);
  });
});
