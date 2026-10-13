import type { FormValues, RowValue, SectionValidatorName, SubmitValidatorName, ValidationMode } from '../schema/types';

/**
 * Named cross-field validators. Schemas reference them by name so the schema stays pure JSON;
 * the server runs equivalent checks (it is the authority — these exist for fast feedback).
 */
/** `mode` lets presence-style rules apply only on submission, so incomplete drafts stay savable. */
export type CrossFieldValidator = (values: FormValues, mode: ValidationMode) => string | undefined;

const ownershipRows = (values: FormValues): RowValue[] => (Array.isArray(values.owners) ? (values.owners as RowValue[]) : []);

export const sectionValidators: Record<SectionValidatorName, CrossFieldValidator> = {
  ownershipNotOver100: (values) => {
    const total = ownershipRows(values).reduce((sum, row) => sum + (typeof row.ownershipPercent === 'number' ? row.ownershipPercent : 0), 0);
    return total > 100 ? `Total ownership is ${total}%. It cannot exceed 100%.` : undefined;
  },
  ownershipAtLeast25ForController: (values) => {
    const invalid = ownershipRows(values).some(
      (row) => row.isController === true && typeof row.ownershipPercent === 'number' && row.ownershipPercent < 25,
    );
    return invalid ? 'Owners marked as controlling must hold at least 25%.' : undefined;
  },
  atLeastOneTaxResidency: (values, mode) =>
    mode === 'submit' && !values.taxResidencyCountry ? 'Provide at least one country of tax residency.' : undefined,
};

export const submitValidators: Record<SubmitValidatorName, CrossFieldValidator> = {
  highRiskNeedsSourceOfFunds: (values) =>
    values.jurisdictionRisk === 'HIGH' && !values.sourceOfFundsDetail
      ? 'High jurisdiction risk requires a source of funds explanation.'
      : undefined,
  corporateNeedsOwner: (values) =>
    ownershipRows(values).length === 0 ? 'Add at least one beneficial owner before submitting.' : undefined,
};
