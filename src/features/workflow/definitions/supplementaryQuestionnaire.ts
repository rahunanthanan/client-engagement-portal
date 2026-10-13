/**
 * FICTIONAL form-js schema. form-js is used as a SEPARATE, alternative form technology for
 * low-risk questionnaires that administrators can design visually. It is not mixed with the custom
 * schema renderer: see docs/ARCHITECTURE.md "Form technology boundary".
 */
export const SUPPLEMENTARY_FORM_ID = 'supplementary-questionnaire';

export const supplementaryQuestionnaireSchema = {
  type: 'default',
  id: 'supplementary-questionnaire',
  schemaVersion: 16,
  components: [
    { type: 'text', id: 'Intro', text: '#### Supplementary questionnaire (fictional)\nA short follow-up that operations may send after review.' },
    { type: 'textfield', id: 'Field_contact', key: 'preferredContactName', label: 'Preferred contact name', validate: { required: true } },
    {
      type: 'select',
      id: 'Field_channel',
      key: 'preferredChannel',
      label: 'Preferred channel',
      values: [
        { label: 'Email', value: 'EMAIL' },
        { label: 'Phone', value: 'PHONE' },
        { label: 'Secure message', value: 'SECURE_MESSAGE' },
      ],
      validate: { required: true },
    },
    { type: 'checkbox', id: 'Field_paper', key: 'paperStatements', label: 'Paper statements requested' },
    {
      type: 'textarea',
      id: 'Field_paper_reason',
      key: 'paperReason',
      label: 'Reason for paper statements',
      conditional: { hide: '=paperStatements != true' },
    },
  ],
};
