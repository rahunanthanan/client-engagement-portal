import type { FieldSchema, FormSchema } from './types';

/**
 * SCHEMA BOUNDARY between the custom renderer and form-js.
 *
 * The two schema languages overlap only for simple fields. This one-way, explicitly lossy export
 * shows exactly where the boundary is: anything outside the overlap is reported, never guessed.
 * (A real migration would be a reviewed, versioned change to the definition, not a runtime step.)
 */
export interface FormJsExport {
  schema: { type: 'default'; id: string; schemaVersion: number; components: Record<string, unknown>[] };
  unsupported: { fieldId: string; reason: string }[];
}

export function toFormJsSchema(schema: FormSchema): FormJsExport {
  const components: Record<string, unknown>[] = [];
  const unsupported: FormJsExport['unsupported'] = [];

  const push = (field: FieldSchema) => {
    if (field.visibleWhen || ('requiredWhen' in field && field.requiredWhen)) {
      unsupported.push({ fieldId: field.id, reason: 'conditional rules use a different expression language (FEEL) in form-js' });
    }
    const required = 'required' in field && field.required ? { validate: { required: true } } : {};
    switch (field.type) {
      case 'text':
        components.push({ type: 'textfield', id: `Field_${field.id}`, key: field.id, label: field.label, ...required });
        return;
      case 'textarea':
        components.push({ type: 'textarea', id: `Field_${field.id}`, key: field.id, label: field.label, ...required });
        return;
      case 'number':
        components.push({ type: 'number', id: `Field_${field.id}`, key: field.id, label: field.label, ...required });
        return;
      case 'checkbox':
      case 'toggle':
        components.push({ type: 'checkbox', id: `Field_${field.id}`, key: field.id, label: field.label, ...required });
        return;
      case 'dropdown':
        if (field.options.source === 'static') {
          components.push({ type: 'select', id: `Field_${field.id}`, key: field.id, label: field.label, values: field.options.items, ...required });
        } else {
          unsupported.push({ fieldId: field.id, reason: 'API-driven dependent options need a custom form-js extension' });
        }
        return;
      case 'divider':
      case 'alert':
        components.push({ type: 'text', id: `Field_${field.id}`, text: `**${field.label}**${field.type === 'alert' ? ` ${field.message}` : ''}` });
        return;
      default:
        unsupported.push({ fieldId: field.id, reason: `type "${field.type}" has no form-js equivalent in this sample` });
    }
  };

  schema.sections.forEach((section) => {
    components.push({ type: 'text', id: `Section_${section.id}`, text: `### ${section.title}` });
    section.fields.forEach(push);
  });

  return { schema: { type: 'default', id: schema.schemaId, schemaVersion: 16, components }, unsupported };
}
