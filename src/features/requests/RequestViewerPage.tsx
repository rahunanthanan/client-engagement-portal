import { useParams } from 'react-router';
import { PageHeader } from '@/shared/components/PageHeader';
import { RequestViewer } from './RequestViewer';

export default function RequestViewerPage() {
  const { requestId = '' } = useParams();
  return (
    <>
      <PageHeader title={`Request ${requestId}`} />
      <RequestViewer requestId={requestId} />
    </>
  );
}
