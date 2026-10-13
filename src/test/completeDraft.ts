import { getDb } from '@/mocks/db';

/** Fills the seeded fictional v2 draft so it passes submission validation. */
export function makeDraftSubmittable(requestId = 'REQ-2026-000091') {
  const record = getDb().requests[requestId]!;
  record.values = {
    ...record.values,
    legalName: 'Bluefin Orchards Ltd',
    registrationNumber: 'BF2026A1',
    incorporationDate: '2012-03-04',
    countryOfIncorporation: 'CA',
    regionOfIncorporation: 'CA-ON',
    relationshipManager: { id: 'staff-001', label: 'Morgan Hale' },
    entityType: 'PRIVATE_COMPANY',
    industrySector: 'AGR',
    industrySubSector: 'AGR-ORC',
    owners: [{ rowId: 'row-seed-1', fullName: 'Ama Okafor-Lind', dateOfBirth: '1980-04-12', ownershipPercent: 60, isController: true, controlDescription: 'Managing director' }],
    taxResidencyCountry: 'CA',
    taxIdentificationNumber: 'CA-55501',
    jurisdictionRisk: 'MEDIUM',
    pepExposure: false,
    expectedAnnualVolume: 250000,
    certificateOfIncorporation: [{ attachmentId: 'att-test', fileName: 'certificate.pdf', sizeBytes: 1000, contentType: 'application/pdf', scanStatus: 'CLEAN' }],
    declarationConfirmed: true,
  };
  return record;
}
