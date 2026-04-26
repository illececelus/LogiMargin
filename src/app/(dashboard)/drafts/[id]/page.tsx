import { DraftReviewView } from '@/components/drafts/DraftReviewView';

export default function DraftReviewPage({ params }: { params: { id: string } }) {
  return <DraftReviewView draftId={params.id} />;
}
