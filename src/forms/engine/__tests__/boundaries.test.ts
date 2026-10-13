import { evaluateRiskTier } from '@/mocks/riskDecision';
import { corporateOnboardingV3 } from '@/mocks/schemas/corporateOnboarding';
import { toFormJsSchema } from '@/forms/schema/toFormJsSchema';

describe('custom schema → form-js boundary', () => {
  it('exports the overlapping simple fields and reports everything else', () => {
    const { schema, unsupported } = toFormJsSchema(corporateOnboardingV3);
    expect(schema.components.some((c) => c.key === 'legalName' && c.type === 'textfield')).toBe(true);
    const unsupportedIds = unsupported.map((u) => u.fieldId);
    expect(unsupportedIds).toEqual(expect.arrayContaining(['owners', 'regionOfIncorporation', 'certificateOfIncorporation', 'relationshipManager']));
  });
});

describe('simulated risk decision (mirrors the DMN table, hit policy FIRST)', () => {
  it.each([
    [{ pepExposure: true, jurisdictionRisk: 'LOW' }, 'Rule_Pep', 'HIGH', 'SENIOR'],
    [{ jurisdictionRisk: 'HIGH' }, 'Rule_HighJurisdiction', 'HIGH', 'SENIOR'],
    [{ jurisdictionRisk: 'LOW', expectedAnnualVolume: 6_000_000 }, 'Rule_HighVolume', 'MEDIUM', 'STANDARD'],
    [{ jurisdictionRisk: 'MEDIUM' }, 'Rule_MediumJurisdiction', 'MEDIUM', 'STANDARD'],
    [{ jurisdictionRisk: 'LOW' }, 'Rule_Default', 'LOW', 'STANDARD'],
  ])('%j matches %s', (values, rule, tier, review) => {
    const outcome = evaluateRiskTier(values);
    expect(outcome.matchedRuleIds).toEqual([rule]);
    expect(outcome.outputs).toEqual({ riskTier: tier, reviewLevel: review });
  });
});
