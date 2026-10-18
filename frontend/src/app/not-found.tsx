import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import type { Metadata } from 'next';
import { Home, Leaf } from 'lucide-react';
import { BackButton } from '@/components/layout/back-button';

export const metadata: Metadata = { title: 'Page not found | GreenTrace' };

export default function NotFound() {
  return (
    <div className="flex items-center justify-center p-4">
      <Card className="w-full max-w-md text-center">
        <CardHeader className="space-y-4">
          <div className="mx-auto w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center">
            <Leaf className="h-8 w-8 text-primary" />
          </div>
          <div>
            <CardTitle className="text-2xl font-bold">Page Not Found</CardTitle>
            <CardDescription className="mt-2">
              The page you're looking for doesn't exist or has been moved.
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="text-6xl font-bold text-muted-foreground/20">404</div>
          <div className="space-y-3">
            <Button asChild className="w-full">
              <Link href="/">
                <Home className="h-4 w-4 mr-2" />
                Go Home
              </Link>
            </Button>
            <BackButton />
          </div>
          <div className="pt-4 border-t">
            <p className="text-sm text-muted-foreground">
              Need help? Visit our{' '}
              <Link href="/upload" className="text-primary hover:underline">
                upload page
              </Link>{' '}
              to get started with carbon tracking.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
