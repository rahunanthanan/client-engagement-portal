import type { DecisionOutcome } from '@/api/contracts';
import type { FormValues } from '@/forms/schema/types';

/**
 * SIMULATED server-side evaluation of the fictional "risk-tier" DMN table (hit policy FIRST).
 * A real backend would execute the approved DMN with a decision engine; the UI never decides.
 */
interface Rule {
  id: string;
  matches: (i: { pep: boolean; jurisdiction: unknown; volume: number }) => boolean;
  outputs: DecisionOutcome['outputs'];
}

const RULES: Rule[] = [
  { id: 'Rule_Pep', matches: (i) => i.pep, outputs: { riskTier: 'HIGH', reviewLevel: 'SENIOR' } },
  { id: 'Rule_HighJurisdiction', matches: (i) => i.jurisdiction === 'HIGH', outputs: { riskTier: 'HIGH', reviewLevel: 'SENIOR' } },
  { id: 'Rule_HighVolume', matches: (i) => i.volume > 5_000_000, outputs: { riskTier: 'MEDIUM', reviewLevel: 'STANDARD' } },
  { id: 'Rule_MediumJurisdiction', matches: (i) => i.jurisdiction === 'MEDIUM', outputs: { riskTier: 'MEDIUM', reviewLevel: 'STANDARD' } },
  { id: 'Rule_Default', matches: () => true, outputs: { riskTier: 'LOW', reviewLevel: 'STANDARD' } },
];

export function evaluateRiskTier(values: FormValues, now = new Date()): DecisionOutcome {
  const inputs = {
    pep: values.pepExposure === true,
    jurisdiction: values.jurisdictionRisk,
    volume: typeof values.expectedAnnualVolume === 'number' ? values.expectedAnnualVolume : 0,
  };
  const rule = RULES.find((r) => r.matches(inputs))!;
  return {
    decisionKey: 'risk-tier',
    decisionVersion: 1,
    matchedRuleIds: [rule.id],
    outputs: rule.outputs,
    inputs: { pepExposure: inputs.pep, jurisdictionRisk: inputs.jurisdiction ?? null, expectedAnnualVolume: inputs.volume },
    evaluatedAt: now.toISOString(),
  };
}
