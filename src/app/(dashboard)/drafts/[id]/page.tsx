import { DraftReviewView } from '@/components/drafts/DraftReviewView';

export default async function DraftReviewPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <DraftReviewView draftId={id} />;
}
