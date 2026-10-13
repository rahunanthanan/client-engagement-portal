import { memo } from 'react';
import { Accordion, AccordionDetails, AccordionSummary, Alert, Chip, Grid, Stack, Typography } from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import { useSectionErrorCount, useSectionErrors, useSectionVisible } from '../engine/formSelectors';
import type { SectionSchema } from '../schema/types';
import { FieldRenderer } from './FieldRenderer';
import { useFormEngine } from './FormEngineContext';

interface FormSectionProps {
  section: SectionSchema;
  expanded: boolean;
  onToggle: (sectionId: string, expanded: boolean) => void;
}

export const FormSection = memo(function FormSection({ section, expanded, onToggle }: FormSectionProps) {
  const { api } = useFormEngine();
  const visible = useSectionVisible(api.formId, section);
  const errorCount = useSectionErrorCount(api.formId, section);
  const sectionErrors = useSectionErrors(api.formId, section.id);
  if (!visible) return null;

  const headingId = `section-${section.id}-heading`;
  return (
    <Accordion
      expanded={expanded}
      onChange={(_e, isExpanded) => onToggle(section.id, isExpanded)}
      disableGutters
      data-section-id={section.id}
      slotProps={{ heading: { component: 'h3' } }}
    >
      <AccordionSummary expandIcon={<ExpandMoreIcon />} aria-controls={`section-${section.id}-content`} id={headingId}>
        <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
          <Typography variant="subtitle1" component="span">
            {section.title}
          </Typography>
          {errorCount > 0 && <Chip size="small" color="error" label={`${errorCount} to fix`} />}
        </Stack>
      </AccordionSummary>
      <AccordionDetails id={`section-${section.id}-content`}>
        {section.description && (
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            {section.description}
          </Typography>
        )}
        {sectionErrors?.map((message) => (
          <Alert key={message} severity="error" sx={{ mb: 2 }}>
            {message}
          </Alert>
        ))}
        <Grid container spacing={2}>
          {section.fields.map((field) => (
            <FieldRenderer key={field.id} field={field} section={section} />
          ))}
        </Grid>
      </AccordionDetails>
    </Accordion>
  );
});
