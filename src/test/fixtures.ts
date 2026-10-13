import type { FormSchema } from '@/forms/schema/types';

/** Small schema used by unit tests: one dependent dropdown, conditional fields and a repeatable group. */
export const testSchema: FormSchema = {
  schemaId: 'test.schema',
  version: 1,
  category: 'TEST',
  requestType: 'TEST',
  title: 'Test form',
  sections: [
    {
      id: 'main',
      title: 'Main',
      fields: [
        { id: 'name', type: 'text', label: 'Name', required: true, validation: { maxLength: 10 } },
        { id: 'country', type: 'dropdown', label: 'Country', options: { source: 'api', lookup: 'countries' } },
        {
          id: 'region',
          type: 'dropdown',
          label: 'Region',
          options: { source: 'api', lookup: 'regions', dependsOn: ['country'] },
          visibleWhen: { field: 'country', op: 'in', value: ['CA', 'GB', 'AU'] },
          requiredWhen: { field: 'country', op: 'in', value: ['CA', 'GB', 'AU'] },
          whenHidden: 'clear',
        },
        { id: 'type', type: 'dropdown', label: 'Type', options: { source: 'static', items: [{ value: 'TRUST', label: 'Trust' }, { value: 'CHARITY', label: 'Charity' }] } },
        { id: 'trustRef', type: 'text', label: 'Trust ref', visibleWhen: { field: 'type', op: 'equals', value: 'TRUST' }, whenHidden: 'clear', requiredWhen: { field: 'type', op: 'equals', value: 'TRUST' } },
        { id: 'charityNo', type: 'text', label: 'Charity no', visibleWhen: { field: 'type', op: 'equals', value: 'CHARITY' }, whenHidden: 'retain' },
        { id: 'amount', type: 'number', label: 'Amount', defaultValue: 0, validation: { min: 0 } },
        {
          id: 'owners',
          type: 'repeatable',
          label: 'Owners',
          itemLabel: 'Owner',
          fields: [
            { id: 'ownerName', type: 'text', label: 'Owner name', required: true },
            { id: 'ownershipPercent', type: 'number', label: 'Ownership', validation: { min: 0, max: 100 } },
            { id: 'isController', type: 'checkbox', label: 'Controller' },
            { id: 'controlNote', type: 'text', label: 'Control note', visibleWhen: { field: 'row.isController', op: 'isTrue' }, whenHidden: 'clear' },
          ],
        },
      ],
      validators: ['ownershipNotOver100'],
    },
  ],
};
