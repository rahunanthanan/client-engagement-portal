import { createRef } from 'react';
import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AppProviders } from '@/app/AppProviders';
import { renderCountsToggled } from '@/app/uiSlice';
import { formInitialized } from '@/forms/engine/formsSlice';
import { buildInitialValues } from '@/forms/engine/formModel';
import type { FormApi } from '@/forms/engine/useFormStateManager';
import type { FormSchema } from '@/forms/schema/types';
import { corporateOnboardingV3 } from '@/mocks/schemas/corporateOnboarding';
import { createSignedInServices } from '@/test/renderApp';
import { DynamicForm } from '../DynamicForm';

async function renderForm(schema: FormSchema = corporateOnboardingV3, values = {}) {
  const services = await createSignedInServices('CLIENT_ADVISOR');
  services.store.dispatch(
    formInitialized({ formId: 'f1', schemaRef: { schemaId: schema.schemaId, version: schema.version }, values: buildInitialValues(schema, values), context: { clientName: 'Bluefin Orchards Ltd', clientId: 'CL-00001', requestId: 'REQ-2026-000091' } }),
  );
  const ref = createRef<FormApi>();
  const user = userEvent.setup();
  render(
    <AppProviders services={services}>
      <DynamicForm ref={ref} formId="f1" schema={schema} context={{ clientName: 'Bluefin Orchards Ltd', clientId: 'CL-00001', requestId: 'REQ-2026-000091' }} />
    </AppProviders>,
  );
  return { services, ref, user };
}

describe('DynamicForm', () => {
  it('renders sections, read-only context values and accessible labels', async () => {
    await renderForm();
    expect(screen.getByRole('button', { name: /client information/i })).toBeInTheDocument();
    expect(screen.getByText('Bluefin Orchards Ltd')).toBeInTheDocument();
    expect(screen.getByLabelText(/registered legal name/i)).toBeRequired();
  });

  it('shows and hides conditional fields and clears hidden values by policy', async () => {
    const { user, ref } = await renderForm();
    const entityType = screen.getByLabelText(/entity type/i);
    expect(screen.queryByLabelText(/trust deed reference/i)).not.toBeInTheDocument();

    await user.selectOptions(entityType, 'TRUST');
    await user.type(screen.getByLabelText(/trust deed reference/i), 'TD-42');
    expect(ref.current!.getValue('trustDeedReference')).toBe('TD-42');

    await user.selectOptions(entityType, 'PRIVATE_COMPANY');
    expect(screen.queryByLabelText(/trust deed reference/i)).not.toBeInTheDocument();
    expect(ref.current!.getValue('trustDeedReference')).toBeUndefined(); // whenHidden: clear

    await user.selectOptions(entityType, 'CHARITY');
    await user.type(screen.getByLabelText(/charity registration number/i), 'CH-1');
    await user.selectOptions(entityType, 'TRUST');
    expect(ref.current!.getValue('charityNumber')).toBe('CH-1'); // whenHidden: retain
  });

  it('loads dependent dropdown options from the API and clears the child when the parent changes', async () => {
    const { user, ref } = await renderForm();
    const country = screen.getByLabelText(/country of incorporation/i);
    await waitFor(() => expect(within(country).getByRole('option', { name: 'Canada' })).toBeInTheDocument());
    await user.selectOptions(country, 'CA');
    const region = await screen.findByLabelText(/region \/ state of incorporation/i);
    await waitFor(() => expect(within(region).getByRole('option', { name: 'Ontario' })).toBeInTheDocument());
    await user.selectOptions(region, 'CA-ON');

    await user.selectOptions(country, 'GB');
    expect(ref.current!.getValue('regionOfIncorporation')).toBeUndefined();
    await waitFor(() => expect(within(screen.getByLabelText(/region \/ state of incorporation/i)).getByRole('option', { name: 'Scotland' })).toBeInTheDocument());

    await user.selectOptions(country, 'SG'); // no regions: field hidden
    expect(screen.queryByLabelText(/region \/ state of incorporation/i)).not.toBeInTheDocument();
  });

  it('supports repeatable rows with row-scoped conditional fields', async () => {
    const { user, ref } = await renderForm();
    expect(screen.getAllByText(/^Owner \d$/)).toHaveLength(1); // minItems: 1
    await user.click(screen.getByRole('button', { name: /add owner/i }));
    expect(screen.getAllByText(/^Owner \d$/)).toHaveLength(2);

    const row2 = screen.getByTestId('row-owners-1');
    await user.click(within(row2).getByLabelText(/exercises control/i));
    expect(within(row2).getByLabelText(/nature of control/i)).toBeInTheDocument();
    expect(within(screen.getByTestId('row-owners-0')).queryByLabelText(/nature of control/i)).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /remove owner 1/i }));
    expect(screen.getAllByText(/^Owner \d$/)).toHaveLength(1);
    expect((ref.current!.getValue('owners') as unknown[]).length).toBe(1);
  });

  it('exposes a typed form API and an accessible error summary after submit validation', async () => {
    const { ref, user } = await renderForm();
    let result!: ReturnType<FormApi['validate']>;
    act(() => {
      result = ref.current!.validate('draft');
    });
    expect(result.valid).toBe(true);
    act(() => {
      result = ref.current!.validate('submit');
    });
    expect(result.valid).toBe(false);
    const summary = await screen.findByRole('alert', { name: /there is a problem/i });
    expect(within(summary).getByRole('button', { name: /registered legal name: registered legal name is required/i })).toBeInTheDocument();

    // Fixing a field clears its error while typing.
    await user.type(screen.getByLabelText(/registered legal name/i), 'Bluefin Orchards Ltd');
    expect(within(summary).queryByRole('button', { name: /registered legal name/i })).not.toBeInTheDocument();

    act(() => ref.current!.setValue('legalName', 'Changed'));
    expect(ref.current!.getValues().legalName).toBe('Changed');
    act(() => ref.current!.reset({ legalName: 'Reset' }));
    expect(ref.current!.getValue('legalName')).toBe('Reset');
  });

  it('re-renders only the field being edited (isolated subscriptions)', async () => {
    const { services, user } = await renderForm();
    act(() => {
      services.store.dispatch(renderCountsToggled());
    });
    const countOf = (fieldId: string) => document.querySelector(`[data-field-id="${fieldId}"] [data-testid="render-count"]`)?.textContent;
    await waitFor(() => expect(countOf('registrationNumber')).toMatch(/renders: \d+/));
    const before = countOf('registrationNumber');
    await user.type(screen.getByLabelText(/registered legal name/i), 'Typing ten');
    expect(countOf('registrationNumber')).toBe(before);
    expect(Number(countOf('legalName')?.replace(/\D/g, ''))).toBeGreaterThan(10);
  });

  it('shows a placeholder for unsupported field types instead of crashing', async () => {
    const schema = { ...corporateOnboardingV3, sections: [{ id: 's', title: 'S', fields: [{ id: 'sig', type: 'signature', label: 'Signature' }] }] } as unknown as FormSchema;
    await renderForm(schema);
    expect(screen.getByTestId('unsupported-sig')).toHaveTextContent(/cannot display/);
  });

  it('refuses to render a schema with circular dependencies', async () => {
    const schema = {
      ...corporateOnboardingV3,
      sections: [
        {
          id: 's',
          title: 'S',
          fields: [
            { id: 'a', type: 'text', label: 'A', visibleWhen: { field: 'b', op: 'isNotEmpty' }, whenHidden: 'clear' },
            { id: 'b', type: 'text', label: 'B', visibleWhen: { field: 'a', op: 'isNotEmpty' }, whenHidden: 'clear' },
          ],
        },
      ],
    } as unknown as FormSchema;
    await renderForm(schema);
    expect(screen.getByRole('alert')).toHaveTextContent(/circular dependency: a → b → a/i);
  });
});
