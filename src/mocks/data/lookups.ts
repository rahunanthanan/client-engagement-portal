import type { LookupOption, SearchResult } from '@/api/contracts';

/** Lookup data. Countries are real ISO codes; everything else (staff, sectors) is fictional. */
export const COUNTRIES: LookupOption[] = [
  { value: 'AU', label: 'Australia' },
  { value: 'CA', label: 'Canada' },
  { value: 'DE', label: 'Germany' },
  { value: 'IE', label: 'Ireland' },
  { value: 'NZ', label: 'New Zealand' },
  { value: 'SG', label: 'Singapore' },
  { value: 'GB', label: 'United Kingdom' },
];

export const REGIONS: Record<string, LookupOption[]> = {
  AU: [
    { value: 'AU-NSW', label: 'New South Wales' },
    { value: 'AU-QLD', label: 'Queensland' },
    { value: 'AU-VIC', label: 'Victoria' },
  ],
  CA: [
    { value: 'CA-AB', label: 'Alberta' },
    { value: 'CA-BC', label: 'British Columbia' },
    { value: 'CA-ON', label: 'Ontario' },
    { value: 'CA-QC', label: 'Quebec' },
  ],
  GB: [
    { value: 'GB-ENG', label: 'England' },
    { value: 'GB-NIR', label: 'Northern Ireland' },
    { value: 'GB-SCT', label: 'Scotland' },
    { value: 'GB-WLS', label: 'Wales' },
  ],
};

export const SECTORS: LookupOption[] = [
  { value: 'AGR', label: 'Agriculture' },
  { value: 'MAN', label: 'Manufacturing' },
  { value: 'RET', label: 'Retail' },
  { value: 'TEC', label: 'Technology' },
  { value: 'TRN', label: 'Transport & logistics' },
];

export const SUB_SECTORS: Record<string, LookupOption[]> = {
  AGR: [
    { value: 'AGR-ORC', label: 'Orchards' },
    { value: 'AGR-DAI', label: 'Dairy' },
  ],
  MAN: [
    { value: 'MAN-FUR', label: 'Furniture' },
    { value: 'MAN-TEX', label: 'Textiles' },
  ],
  RET: [
    { value: 'RET-GRO', label: 'Grocery' },
    { value: 'RET-ONL', label: 'Online retail' },
  ],
  TEC: [
    { value: 'TEC-SAA', label: 'Software services' },
    { value: 'TEC-HW', label: 'Hardware' },
  ],
  TRN: [
    { value: 'TRN-FRE', label: 'Freight' },
    { value: 'TRN-COU', label: 'Courier' },
  ],
};

export const STAFF: SearchResult[] = [
  'Morgan Hale',
  'Priya Natarajan',
  'Tomasz Wilk',
  'Grace Okonkwo',
  'Hiroshi Tanaka',
  'Lena Fischer',
  'Diego Marín',
  'Aisha Rahman',
  'Callum Reid',
  'Sofia Lindqvist',
  'Marcus Bell',
  'Nora Quinn',
].map((name, i) => ({ id: `staff-${String(i + 1).padStart(3, '0')}`, label: name, detail: i % 2 ? 'Business banking team (fictional)' : 'Private clients team (fictional)' }));
