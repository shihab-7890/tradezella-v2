import Link from 'next/link';
import { Button } from '@/components/ui/button';

export default function NotFound() {
  return (
    <div className="flex h-screen w-full flex-col items-center justify-center gap-4 bg-background p-4 text-foreground">
      <h2 className="text-2xl font-bold">Page Not Found</h2>
      <p className="text-muted-foreground">Could not find requested resource.</p>
      <Button asChild variant="outline">
        <Link href="/">Return to Canvas</Link>
      </Button>
    </div>
  );
}
