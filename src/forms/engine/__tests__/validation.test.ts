import { testSchema } from '@/test/fixtures';
import { validateForm } from '../validation';

describe('validateForm', () => {
  it('draft mode skips required rules so incomplete drafts can be saved', () => {
    const result = validateForm(testSchema, {}, 'draft');
    expect(result.valid).toBe(true);
  });

  it('draft mode still reports malformed values that are present', () => {
    const result = validateForm(testSchema, { name: 'far too long name' }, 'draft');
    expect(result.fieldErrors.name).toMatch(/10 characters or fewer/);
  });

  it('submit mode enforces required and conditional-required rules on visible fields only', () => {
    const result = validateForm(testSchema, { country: 'CA', type: 'CHARITY' }, 'submit');
    expect(result.fieldErrors.name).toBe('Name is required.');
    expect(result.fieldErrors.region).toBe('Region is required.');
    expect(result.fieldErrors.trustRef).toBeUndefined();
  });

  it('validates repeatable rows by stable row id and runs section validators', () => {
    const result = validateForm(
      testSchema,
      { name: 'Ok', owners: [{ rowId: 'r1', ownershipPercent: 70 }, { rowId: 'r2', ownerName: 'B', ownershipPercent: 50 }] },
      'submit',
    );
    expect(result.fieldErrors['owners.r1.ownerName']).toBe('Owner name is required.');
    expect(result.sectionErrors.main?.[0]).toMatch(/cannot exceed 100%/);
  });
});
