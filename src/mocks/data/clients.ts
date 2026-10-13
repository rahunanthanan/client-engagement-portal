import type { ClientSummary } from '@/api/contracts';
import { STAFF } from './lookups';

/** Deterministically generated FICTIONAL clients. Any resemblance to real organisations is coincidental. */
const CORP_A = ['Bluefin', 'Copperleaf', 'Harbourline', 'Juniper', 'Lanternfield', 'Moorgate', 'Quillstone', 'Silverbirch', 'Tidewater', 'Wrenfield'];
const CORP_B = ['Orchards', 'Logistics', 'Studios', 'Textiles', 'Software', 'Freight'];
const CORP_SUFFIX = ['Ltd', 'Pty Ltd', 'LLP', 'Inc'];
const FIRST = ['Ama', 'Bruno', 'Chen', 'Dalia', 'Elias', 'Freya', 'Gideon', 'Hana', 'Imani', 'Jonah'];
const LAST = ['Okafor-Lind', 'Varga', 'Moreau', 'Achterberg', 'Sato', 'Delacroix-Ng', 'Fairweather'];
const COUNTRIES = ['GB', 'CA', 'AU', 'IE', 'SG', 'NZ', 'DE'];

export function generateClients(): ClientSummary[] {
  const clients: ClientSummary[] = [];
  let n = 1;
  for (let i = 0; i < 30; i += 1) {
    const name = `${CORP_A[i % CORP_A.length]} ${CORP_B[i % CORP_B.length]} ${CORP_SUFFIX[i % CORP_SUFFIX.length]}`;
    clients.push({
      clientId: `CL-${String(n++).padStart(5, '0')}`,
      displayName: name,
      clientType: 'CORPORATE',
      segment: i % 3 === 0 ? 'Institutional' : 'Business',
      countryCode: COUNTRIES[i % COUNTRIES.length]!,
      relationshipManager: STAFF[i % STAFF.length]!.label,
    });
  }
  for (let i = 0; i < 20; i += 1) {
    clients.push({
      clientId: `CL-${String(n++).padStart(5, '0')}`,
      displayName: `${FIRST[i % FIRST.length]} ${LAST[i % LAST.length]}`,
      clientType: 'INDIVIDUAL',
      segment: 'Private',
      countryCode: COUNTRIES[(i + 2) % COUNTRIES.length]!,
      relationshipManager: STAFF[(i + 5) % STAFF.length]!.label,
    });
  }
  return clients;
}
