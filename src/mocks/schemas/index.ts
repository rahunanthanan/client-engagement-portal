import type { RequestCategory } from '@/api/contracts';
import type { FormSchema } from '@/forms/schema/types';
import { corporateOnboardingV2, corporateOnboardingV3 } from './corporateOnboarding';
import { addressChangeV1, individualOnboardingV2 } from './otherSchemas';

export const SCHEMAS: FormSchema[] = [corporateOnboardingV2, corporateOnboardingV3, individualOnboardingV2, addressChangeV1];

export function findSchema(schemaId: string, version: number): FormSchema | undefined {
  return SCHEMAS.find((s) => s.schemaId === schemaId && s.version === version);
}

export function latestVersion(schemaId: string): number {
  return Math.max(...SCHEMAS.filter((s) => s.schemaId === schemaId).map((s) => s.version));
}

/** Request catalogue: category -> request types, each bound to a versioned schema. */
export const CATALOG: RequestCategory[] = [
  {
    category: 'ONBOARDING',
    label: 'Client onboarding',
    types: [
      { requestType: 'CORPORATE_ENTITY', label: 'Corporate entity onboarding', clientTypes: ['CORPORATE'], schemaId: 'onboarding.corporate-entity', latestVersion: 3 },
      { requestType: 'INDIVIDUAL', label: 'Individual onboarding', clientTypes: ['INDIVIDUAL'], schemaId: 'onboarding.individual', latestVersion: 2 },
    ],
  },
  {
    category: 'SERVICE',
    label: 'Service request',
    types: [
      { requestType: 'ADDRESS_CHANGE', label: 'Registered address change', clientTypes: ['CORPORATE', 'INDIVIDUAL'], schemaId: 'service.address-change', latestVersion: 1 },
    ],
  },
];
