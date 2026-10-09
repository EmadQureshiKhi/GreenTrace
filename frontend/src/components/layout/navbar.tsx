'use client';

import { Award, BarChart3, Calculator, Menu, ShoppingCart, Target, TrendingDown, Upload } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import { AuthModal } from '@/components/auth/auth-modal';
import { UserMenu } from '@/components/auth/user-menu';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { ThemeToggle } from '@/components/ui/theme-toggle';
import { useAuth } from '@/hooks/use-auth';
import { cn } from '@/lib/utils';
import { Logo } from './logo';

const navigation = [
  { name: 'Dashboard', href: '/', icon: BarChart3 },
  { name: 'Upload', href: '/upload', icon: Upload },
  { name: 'Calculator', href: '/ghg-calculator', icon: Calculator },
  { name: 'Certificates', href: '/certificates', icon: Award },
  { name: 'Marketplace', href: '/marketplace', icon: ShoppingCart },
  { name: 'Reduce', href: '/reduce', icon: TrendingDown },
  { name: 'SEMA', href: '/sema', icon: Target },
];

function isActive(pathname: string, href: string) {
  return href === '/' ? pathname === '/' : pathname === href || pathname.startsWith(`${href}/`);
}

export function Navbar() {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const { isAuthenticated, isLoading, openAuthModal } = useAuth();

  return (
    <>
      <nav className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container mx-auto px-4">
          <div className="flex h-16 items-center justify-between gap-4">
            <Link href="/" aria-label="GreenTrace home">
              <Logo />
            </Link>

            <div className="hidden items-center gap-5 lg:flex">
              {navigation.map(({ name, href, icon: Icon }) => (
                <Link
                  key={href}
                  href={href}
                  className={cn(
                    'flex items-center gap-1.5 text-sm font-medium transition-colors hover:text-primary',
                    isActive(pathname, href) ? 'text-primary' : 'text-muted-foreground',
                  )}
                >
                  <Icon className="h-4 w-4" />
                  {name}
                </Link>
              ))}
            </div>

            <div className="flex items-center gap-2">
              <ThemeToggle />
              {isLoading ? (
                <div className="h-9 w-20 animate-pulse rounded-md bg-muted" />
              ) : isAuthenticated ? (
                <UserMenu />
              ) : (
                <Button onClick={openAuthModal}>Sign in</Button>
              )}

              <Sheet open={open} onOpenChange={setOpen}>
                <SheetTrigger asChild className="lg:hidden">
                  <Button variant="ghost" size="icon" aria-label="Open menu">
                    <Menu className="h-5 w-5" />
                  </Button>
                </SheetTrigger>
                <SheetContent side="right" className="w-[280px]">
                  <SheetTitle className="sr-only">Navigation</SheetTitle>
                  <div className="mt-8 flex flex-col gap-1">
                    {navigation.map(({ name, href, icon: Icon }) => (
                      <Link
                        key={href}
                        href={href}
                        onClick={() => setOpen(false)}
                        className={cn(
                          'flex items-center gap-3 rounded-md p-2 text-sm font-medium transition-colors hover:text-primary',
                          isActive(pathname, href) ? 'bg-primary/10 text-primary' : 'text-muted-foreground',
                        )}
                      >
                        <Icon className="h-5 w-5" />
                        {name}
                      </Link>
                    ))}
                  </div>
                </SheetContent>
              </Sheet>
            </div>
          </div>
        </div>
      </nav>
      <AuthModal />
    </>
  );
}
