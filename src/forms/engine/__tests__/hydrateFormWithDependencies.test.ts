import { api } from '@/api/endpoints';
import { getDb } from '@/mocks/db';
import { corporateOnboardingV2, corporateOnboardingV3 } from '@/mocks/schemas/corporateOnboarding';
import { createSignedInServices } from '@/test/renderApp';
import { hydrateFormWithDependencies } from '../hydrateFormWithDependencies';

describe('hydrateFormWithDependencies', () => {
  beforeEach(async () => {
    await createSignedInServices('CLIENT_ADVISOR'); // wires demo auth headers for the simulated API
  });

  const recordingLoader = () => {
    const calls: string[] = [];
    const load = async (lookup: string, parent: string | undefined) => {
      calls.push(`${lookup}:${parent ?? ''}`);
      return api.getLookup(lookup, parent);
    };
    return { calls, load };
  };

  it('rehydrates an existing draft, loading parent options before dependent ones', async () => {
    const stored = getDb().requests['REQ-2026-000091']!.values; // fictional v2 draft: CA / CA-ON, AGR / AGR-ORC
    const { calls, load } = recordingLoader();
    const result = await hydrateFormWithDependencies(corporateOnboardingV2, stored, load);

    expect(result.values).toMatchObject({ countryOfIncorporation: 'CA', regionOfIncorporation: 'CA-ON', industrySubSector: 'AGR-ORC' });
    expect(result.options.regionOfIncorporation?.map((o) => o.value)).toContain('CA-ON');
    expect(calls.indexOf('countries:')).toBeLessThan(calls.indexOf('regions:CA'));
    expect(calls.indexOf('sectors:')).toBeLessThan(calls.indexOf('subSectors:AGR'));
    expect(result.warnings).toEqual([]);
  });

  it('drops values that are no longer valid options and explains why', async () => {
    const { load } = recordingLoader();
    const result = await hydrateFormWithDependencies(corporateOnboardingV3, { countryOfIncorporation: 'CA', regionOfIncorporation: 'CA-RETIRED' }, load);
    expect(result.values.regionOfIncorporation).toBeUndefined();
    expect(result.warnings[0]).toMatch(/no longer available/);
  });

  it('does not load dependent options while the parent is empty, and applies schema defaults', async () => {
    const { calls, load } = recordingLoader();
    const result = await hydrateFormWithDependencies(corporateOnboardingV3, {}, load);
    expect(calls.some((c) => c.startsWith('subSectors'))).toBe(false);
    expect((result.values.owners as unknown[]).length).toBe(1); // minItems
  });
});
