import type { FormSchema } from '@/forms/schema/types';
import { corporateOnboardingV3 } from './corporateOnboarding';

/** FICTIONAL sample schemas. */

const riskSection = corporateOnboardingV3.sections.find((s) => s.id === 'riskProfile')!;

export const individualOnboardingV2: FormSchema = {
  schemaId: 'onboarding.individual',
  version: 2,
  category: 'ONBOARDING',
  requestType: 'INDIVIDUAL',
  title: 'Individual client onboarding',
  sections: [
    {
      id: 'clientInformation',
      title: 'Client information',
      fields: [
        { id: 'clientName', type: 'readonly', label: 'Client', source: { context: 'clientName' } },
        { id: 'clientRef', type: 'readonly', label: 'Client ID', source: { context: 'clientId' } },
        { id: 'fullLegalName', type: 'text', label: 'Full legal name', required: true, validation: { maxLength: 100 } },
        { id: 'dateOfBirth', type: 'date', label: 'Date of birth', required: true, validation: { notInFuture: true } },
        { id: 'residenceCountry', type: 'dropdown', label: 'Country of residence', required: true, options: { source: 'api', lookup: 'countries' } },
        {
          id: 'residenceRegion',
          type: 'dropdown',
          label: 'Region / state',
          options: { source: 'api', lookup: 'regions', dependsOn: ['residenceCountry'] },
          visibleWhen: { field: 'residenceCountry', op: 'in', value: ['CA', 'GB', 'AU'] },
          requiredWhen: { field: 'residenceCountry', op: 'in', value: ['CA', 'GB', 'AU'] },
          whenHidden: 'clear',
        },
        { id: 'occupation', type: 'text', label: 'Occupation', required: true },
      ],
    },
    {
      id: 'taxResidency',
      title: 'Tax residency',
      validators: ['atLeastOneTaxResidency'],
      fields: [
        { id: 'taxResidencyCountry', type: 'dropdown', label: 'Tax residency', required: true, options: { source: 'api', lookup: 'countries' } },
        {
          id: 'taxIdentificationNumber',
          type: 'text',
          label: 'Tax identification number',
          required: true,
          validation: { pattern: '^[A-Z0-9-]{5,20}$', patternMessage: 'Use 5–20 capital letters, digits or hyphens.' },
        },
      ],
    },
    riskSection,
    {
      id: 'documents',
      title: 'Documents',
      fields: [
        {
          id: 'proofOfIdentity',
          type: 'attachment',
          label: 'Proof of identity',
          documentType: 'PROOF_OF_IDENTITY',
          accept: ['application/pdf', 'image/png', 'image/jpeg'],
          maxSizeMb: 5,
          maxFiles: 2,
          required: true,
        },
        { id: 'declarationConfirmed', type: 'checkbox', label: 'I confirm the information provided is accurate (fictional declaration)', required: true, width: 12 },
      ],
    },
  ],
  submitValidators: ['highRiskNeedsSourceOfFunds'],
};

export const addressChangeV1: FormSchema = {
  schemaId: 'service.address-change',
  version: 1,
  category: 'SERVICE',
  requestType: 'ADDRESS_CHANGE',
  title: 'Registered address change',
  sections: [
    {
      id: 'newAddress',
      title: 'New address',
      fields: [
        { id: 'clientName', type: 'readonly', label: 'Client', source: { context: 'clientName' } },
        { id: 'addressLine1', type: 'text', label: 'Address line 1', required: true, validation: { maxLength: 100 } },
        { id: 'addressLine2', type: 'text', label: 'Address line 2', validation: { maxLength: 100 } },
        { id: 'city', type: 'text', label: 'Town / city', required: true },
        { id: 'country', type: 'dropdown', label: 'Country', required: true, options: { source: 'api', lookup: 'countries' } },
        {
          id: 'region',
          type: 'dropdown',
          label: 'Region / state',
          options: { source: 'api', lookup: 'regions', dependsOn: ['country'] },
          visibleWhen: { field: 'country', op: 'in', value: ['CA', 'GB', 'AU'] },
          requiredWhen: { field: 'country', op: 'in', value: ['CA', 'GB', 'AU'] },
          whenHidden: 'clear',
        },
        { id: 'effectiveDate', type: 'date', label: 'Effective from', required: true, validation: { notInPast: true } },
      ],
    },
    {
      id: 'evidence',
      title: 'Evidence',
      fields: [
        {
          id: 'proofOfAddress',
          type: 'attachment',
          label: 'Proof of address',
          documentType: 'PROOF_OF_ADDRESS',
          accept: ['application/pdf', 'image/png', 'image/jpeg'],
          maxSizeMb: 5,
          maxFiles: 1,
          required: true,
        },
      ],
    },
    {
      id: 'riskProfile',
      title: 'Risk check',
      fields: [
        {
          id: 'jurisdictionRisk',
          type: 'dropdown',
          label: 'Jurisdiction risk rating',
          required: true,
          options: { source: 'static', items: [{ value: 'LOW', label: 'Low' }, { value: 'MEDIUM', label: 'Medium' }, { value: 'HIGH', label: 'High' }] },
        },
      ],
    },
  ],
};

