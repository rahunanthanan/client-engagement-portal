import type { FormSchema, SectionSchema } from '@/forms/schema/types';

/**
 * FICTIONAL sample schema: corporate client onboarding, version 3 (current).
 * Field names and rules are invented for demonstration and do not reflect any real institution.
 */

const REGION_COUNTRIES = ['CA', 'GB', 'AU'];

const clientInformation: SectionSchema = {
  id: 'clientInformation',
  title: 'Client information',
  description: 'Who the request is for. Values marked * are needed to submit, but a draft can be saved at any time.',
  fields: [
    { id: 'clientName', type: 'readonly', label: 'Client', source: { context: 'clientName' }, width: 6 },
    { id: 'clientRef', type: 'readonly', label: 'Client ID', source: { context: 'clientId' }, width: 6 },
    {
      id: 'legalName',
      type: 'text',
      label: 'Registered legal name',
      required: true,
      validation: { minLength: 2, maxLength: 120 },
    },
    {
      id: 'registrationNumber',
      type: 'text',
      label: 'Company registration number',
      required: true,
      helpText: '6–12 capital letters or digits (fictional format).',
      validation: { pattern: '^[A-Z0-9]{6,12}$', patternMessage: 'Use 6–12 capital letters or digits.' },
    },
    { id: 'incorporationDate', type: 'date', label: 'Date of incorporation', required: true, validation: { notInFuture: true } },
    {
      id: 'countryOfIncorporation',
      type: 'dropdown',
      label: 'Country of incorporation',
      required: true,
      options: { source: 'api', lookup: 'countries' },
    },
    {
      id: 'regionOfIncorporation',
      type: 'dropdown',
      label: 'Region / state of incorporation',
      options: { source: 'api', lookup: 'regions', dependsOn: ['countryOfIncorporation'] },
      visibleWhen: { field: 'countryOfIncorporation', op: 'in', value: REGION_COUNTRIES },
      requiredWhen: { field: 'countryOfIncorporation', op: 'in', value: REGION_COUNTRIES },
      whenHidden: 'clear',
    },
    {
      id: 'relationshipManager',
      type: 'search',
      label: 'Relationship manager',
      lookup: 'staff',
      minChars: 2,
      required: true,
      helpText: 'Search fictional staff directory by name.',
    },
  ],
};

const entityDetails: SectionSchema = {
  id: 'entityDetails',
  title: 'Entity details',
  validators: ['ownershipNotOver100', 'ownershipAtLeast25ForController'],
  fields: [
    {
      id: 'entityType',
      type: 'dropdown',
      label: 'Entity type',
      required: true,
      options: {
        source: 'static',
        items: [
          { value: 'PRIVATE_COMPANY', label: 'Private company' },
          { value: 'PARTNERSHIP', label: 'Partnership' },
          { value: 'TRUST', label: 'Trust' },
          { value: 'CHARITY', label: 'Charity' },
        ],
      },
    },
    {
      id: 'trustDeedReference',
      type: 'text',
      label: 'Trust deed reference',
      visibleWhen: { field: 'entityType', op: 'equals', value: 'TRUST' },
      requiredWhen: { field: 'entityType', op: 'equals', value: 'TRUST' },
      whenHidden: 'clear',
    },
    {
      id: 'charityNumber',
      type: 'text',
      label: 'Charity registration number',
      helpText: 'Retained if entity type changes, so it is not lost while the user is exploring options.',
      visibleWhen: { field: 'entityType', op: 'equals', value: 'CHARITY' },
      requiredWhen: { field: 'entityType', op: 'equals', value: 'CHARITY' },
      whenHidden: 'retain',
    },
    { id: 'industrySector', type: 'dropdown', label: 'Industry sector', required: true, options: { source: 'api', lookup: 'sectors' } },
    {
      id: 'industrySubSector',
      type: 'dropdown',
      label: 'Industry sub-sector',
      required: true,
      options: { source: 'api', lookup: 'subSectors', dependsOn: ['industrySector'] },
    },
    { id: 'employeeCount', type: 'number', label: 'Number of employees', validation: { min: 0, integer: true }, width: 6 },
    { id: 'annualTurnover', type: 'number', label: 'Annual turnover', unit: 'USD', validation: { min: 0 }, width: 6 },
    { id: 'ownersDivider', type: 'divider', label: 'Beneficial owners' },
    {
      id: 'owners',
      type: 'repeatable',
      label: 'Beneficial owners',
      itemLabel: 'Owner',
      helpText: 'Add each person who owns or controls the entity (fictional people only).',
      minItems: 1,
      maxItems: 6,
      fields: [
        { id: 'fullName', type: 'text', label: 'Full name', required: true, validation: { maxLength: 80 } },
        { id: 'dateOfBirth', type: 'date', label: 'Date of birth', required: true, validation: { notInFuture: true } },
        { id: 'ownershipPercent', type: 'number', label: 'Ownership', unit: '%', required: true, validation: { min: 0, max: 100 } },
        { id: 'isController', type: 'checkbox', label: 'Exercises control' },
        {
          id: 'controlDescription',
          type: 'text',
          label: 'Nature of control',
          visibleWhen: { field: 'row.isController', op: 'isTrue' },
          requiredWhen: { field: 'row.isController', op: 'isTrue' },
          whenHidden: 'clear',
          width: 12,
        },
      ],
    },
  ],
};

const taxResidency: SectionSchema = {
  id: 'taxResidency',
  title: 'Tax residency',
  validators: ['atLeastOneTaxResidency'],
  fields: [
    { id: 'taxResidencyCountry', type: 'dropdown', label: 'Primary tax residency', required: true, options: { source: 'api', lookup: 'countries' } },
    {
      id: 'taxIdentificationNumber',
      type: 'text',
      label: 'Tax identification number',
      required: true,
      helpText: 'Fictional format: 5–20 capital letters, digits or hyphens.',
      validation: { pattern: '^[A-Z0-9-]{5,20}$', patternMessage: 'Use 5–20 capital letters, digits or hyphens.' },
    },
    { id: 'hasAdditionalTaxResidency', type: 'toggle', label: 'Tax resident in another country' },
    {
      id: 'secondTaxResidencyCountry',
      type: 'dropdown',
      label: 'Second tax residency',
      options: { source: 'api', lookup: 'countries' },
      visibleWhen: { field: 'hasAdditionalTaxResidency', op: 'isTrue' },
      requiredWhen: { field: 'hasAdditionalTaxResidency', op: 'isTrue' },
      whenHidden: 'clear',
    },
    {
      id: 'secondTaxIdentificationNumber',
      type: 'text',
      label: 'Second tax identification number',
      visibleWhen: { field: 'hasAdditionalTaxResidency', op: 'isTrue' },
      requiredWhen: { field: 'hasAdditionalTaxResidency', op: 'isTrue' },
      whenHidden: 'clear',
      validation: { pattern: '^[A-Z0-9-]{5,20}$', patternMessage: 'Use 5–20 capital letters, digits or hyphens.' },
    },
  ],
};

const riskProfile: SectionSchema = {
  id: 'riskProfile',
  title: 'Risk profile',
  description: 'Inputs to the fictional risk-tier decision table. The server evaluates the decision on submission.',
  fields: [
    {
      id: 'jurisdictionRisk',
      type: 'dropdown',
      label: 'Jurisdiction risk rating',
      required: true,
      options: {
        source: 'static',
        items: [
          { value: 'LOW', label: 'Low' },
          { value: 'MEDIUM', label: 'Medium' },
          { value: 'HIGH', label: 'High' },
        ],
      },
    },
    {
      id: 'highRiskNotice',
      type: 'alert',
      label: 'Senior review',
      severity: 'warning',
      message: 'High jurisdiction risk routes this request to a senior operations reviewer.',
      visibleWhen: { field: 'jurisdictionRisk', op: 'equals', value: 'HIGH' },
    },
    { id: 'pepExposure', type: 'toggle', label: 'Politically exposed person connected to the entity' },
    {
      id: 'pepDetails',
      type: 'textarea',
      label: 'Politically exposed person details',
      visibleWhen: { field: 'pepExposure', op: 'isTrue' },
      requiredWhen: { field: 'pepExposure', op: 'isTrue' },
      whenHidden: 'clear',
      validation: { maxLength: 1000 },
    },
    {
      id: 'expectedAnnualVolume',
      type: 'number',
      label: 'Expected annual transaction volume',
      unit: 'USD',
      required: true,
      validation: { min: 0 },
    },
    {
      id: 'sourceOfFundsDetail',
      type: 'textarea',
      label: 'Source of funds explanation',
      visibleWhen: {
        any: [
          { field: 'jurisdictionRisk', op: 'equals', value: 'HIGH' },
          { field: 'expectedAnnualVolume', op: 'gt', value: 5_000_000 },
        ],
      },
      requiredWhen: { field: 'expectedAnnualVolume', op: 'gt', value: 5_000_000 },
      whenHidden: 'retain',
      validation: { maxLength: 2000 },
    },
  ],
};

const documents: SectionSchema = {
  id: 'documents',
  title: 'Documents',
  fields: [
    {
      id: 'certificateOfIncorporation',
      type: 'attachment',
      label: 'Certificate of incorporation',
      documentType: 'CERT_INCORPORATION',
      accept: ['application/pdf', 'image/png', 'image/jpeg'],
      maxSizeMb: 5,
      maxFiles: 2,
      required: true,
    },
    {
      id: 'ownershipStructureChart',
      type: 'attachment',
      label: 'Ownership structure chart',
      documentType: 'OWNERSHIP_CHART',
      accept: ['application/pdf'],
      maxSizeMb: 5,
      maxFiles: 1,
    },
    {
      id: 'declarationConfirmed',
      type: 'checkbox',
      label: 'I confirm the information provided is accurate (fictional declaration)',
      required: true,
      width: 12,
    },
  ],
};

export const corporateOnboardingV3: FormSchema = {
  schemaId: 'onboarding.corporate-entity',
  version: 3,
  category: 'ONBOARDING',
  requestType: 'CORPORATE_ENTITY',
  title: 'Corporate entity onboarding',
  description: 'Fictional onboarding questionnaire for a corporate client.',
  sections: [clientInformation, entityDetails, taxResidency, riskProfile, documents],
  submitValidators: ['highRiskNeedsSourceOfFunds', 'corporateNeedsOwner'],
};

/** Version 2 (superseded): no second tax residency. Drafts created on v2 keep rendering with v2. */
export const corporateOnboardingV2: FormSchema = {
  ...corporateOnboardingV3,
  version: 2,
  sections: corporateOnboardingV3.sections.map((section) =>
    section.id === 'taxResidency'
      ? { ...section, fields: section.fields.filter((f) => !['hasAdditionalTaxResidency', 'secondTaxResidencyCountry', 'secondTaxIdentificationNumber'].includes(f.id)) }
      : section,
  ),
};
