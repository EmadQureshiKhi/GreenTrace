'use client';

import { lazy, Suspense, useState } from 'react';
import {
  Activity,
  AlertCircle,
  BarChart3,
  Calculator,
  ChevronLeft,
  ChevronRight,
  FileText,
  FlaskConical,
  Grid3X3,
  LogIn,
  MessageSquare,
  Plus,
  Settings,
  Target,
  Users,
} from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { useAuth } from '@/hooks/use-auth';
import { cn } from '@/lib/utils';
import { SemaClientSelector } from './sema-client-selector';
import { SemaProvider, useSema } from './sema-context';
import type { SemaModule } from './sema-types';

const SemaDashboard = lazy(() => import('./sema-dashboard'));
const StakeholderManagement = lazy(() => import('./stakeholder-management'));
const SampleSizeCalculator = lazy(() => import('./sample-size-calculator'));
const QuestionnaireEngine = lazy(() => import('./questionnaire-engine'));
const InternalAssessment = lazy(() => import('./internal-assessment'));
const MaterialityMatrix = lazy(() => import('./materiality-matrix'));
const ReportingDashboard = lazy(() => import('./reporting-dashboard'));
const SemaAdminPanel = lazy(() => import('./sema-admin-panel'));

const modules: { id: SemaModule; name: string; short: string; icon: typeof BarChart3; description: string }[] = [
  { id: 'dashboard', name: 'Dashboard', short: 'Dashboard', icon: BarChart3, description: 'Overview of the SEMA process' },
  { id: 'stakeholders', name: 'Stakeholder Management', short: 'Stakeholders', icon: Users, description: 'Identify and prioritize stakeholders' },
  { id: 'sample-size', name: 'Sample Size Calculator', short: 'Sample size', icon: Calculator, description: 'Calculate engagement sample sizes' },
  { id: 'questionnaire', name: 'Questionnaire Engine', short: 'Questionnaire', icon: MessageSquare, description: 'External materiality from stakeholder responses' },
  { id: 'internal-assessment', name: 'Internal Assessment', short: 'Internal', icon: Target, description: 'Internal impact by severity and likelihood' },
  { id: 'materiality-matrix', name: 'Materiality Matrix', short: 'Matrix', icon: Grid3X3, description: 'Visualize material topics' },
  { id: 'reporting', name: 'Reporting Dashboard', short: 'Reporting', icon: FileText, description: 'Final topics, GRI drafting and exports' },
  { id: 'admin', name: 'Organizations', short: 'Organizations', icon: Settings, description: 'Manage the organizations you assess' },
];

function ModuleFallback() {
  return (
    <Card>
      <CardContent className="flex items-center justify-center py-16">
        <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-primary" />
      </CardContent>
    </Card>
  );
}

function StatusBanners() {
  const { activeClient, isDemo, loadError, setActiveSemaModule, setOpenAdminClientForm } = useSema();
  const { isAuthenticated, openAuthModal } = useAuth();

  return (
    <>
      {loadError && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Could not load SEMA data</AlertTitle>
          <AlertDescription>{loadError}</AlertDescription>
        </Alert>
      )}
      {isDemo && activeClient && (
        <div className="flex flex-col gap-3 rounded-lg border border-sky-200 bg-sky-50 p-4 text-sky-900 dark:border-sky-900 dark:bg-sky-950/50 dark:text-sky-100 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <FlaskConical className="mt-0.5 h-5 w-5 shrink-0" />
            <div>
              <p className="font-medium">You are viewing the demo organization</p>
              <p className="text-sm text-sky-800 dark:text-sky-200">
                Illustrative sample data, read-only and never saved or logged to Hedera.
                {isAuthenticated ? ' Create your own organization to run a real assessment.' : ' Sign in to run a real assessment.'}
              </p>
            </div>
          </div>
          {isAuthenticated ? (
            <Button
              size="sm"
              className="shrink-0 self-start sm:self-center"
              onClick={() => {
                setActiveSemaModule('admin');
                setOpenAdminClientForm(true);
              }}
            >
              <Plus className="mr-2 h-4 w-4" /> New organization
            </Button>
          ) : (
            <Button size="sm" className="shrink-0 self-start sm:self-center" onClick={openAuthModal}>
              <LogIn className="mr-2 h-4 w-4" /> Sign in
            </Button>
          )}
        </div>
      )}
    </>
  );
}

export function SemaApp() {
  const [activeModule, setActiveModule] = useState<SemaModule>('dashboard');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [openAdminClientForm, setOpenAdminClientForm] = useState(false);

  const renderActiveModule = () => {
    switch (activeModule) {
      case 'stakeholders':
        return <StakeholderManagement />;
      case 'sample-size':
        return <SampleSizeCalculator />;
      case 'questionnaire':
        return <QuestionnaireEngine />;
      case 'internal-assessment':
        return <InternalAssessment />;
      case 'materiality-matrix':
        return <MaterialityMatrix />;
      case 'reporting':
        return <ReportingDashboard />;
      case 'admin':
        return <SemaAdminPanel isOpenClientForm={openAdminClientForm} setIsOpenClientForm={setOpenAdminClientForm} />;
      default:
        return <SemaDashboard />;
    }
  };

  const activeModuleData = modules.find((m) => m.id === activeModule) ?? modules[0];
  const ActiveIcon = activeModuleData.icon;

  return (
    <SemaProvider setActiveSemaModule={setActiveModule} setOpenAdminClientForm={setOpenAdminClientForm}>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-green-600 to-emerald-600">
              <Activity className="h-6 w-6 text-white" />
            </div>
            <div className="min-w-0">
              <h1 className="text-xl font-bold sm:text-2xl">SEMA</h1>
              <p className="text-sm text-muted-foreground">Stakeholder engagement and materiality assessment</p>
            </div>
          </div>
          <SemaClientSelector />
        </div>

        {/* Module navigation on small screens */}
        <nav aria-label="SEMA modules" className="-mx-4 overflow-x-auto px-4 pb-1 lg:hidden">
          <div className="flex w-max gap-2">
            {modules.map((module) => {
              const Icon = module.icon;
              const isActive = activeModule === module.id;
              return (
                <Button
                  key={module.id}
                  size="sm"
                  variant={isActive ? 'default' : 'outline'}
                  className={cn('h-9', !isActive && 'bg-background')}
                  aria-current={isActive ? 'page' : undefined}
                  onClick={() => setActiveModule(module.id)}
                >
                  <Icon className="mr-1.5 h-4 w-4" />
                  {module.short}
                </Button>
              );
            })}
          </div>
        </nav>

        <div
          className={cn(
            'grid gap-6',
            sidebarCollapsed ? 'lg:grid-cols-[64px_minmax(0,1fr)]' : 'lg:grid-cols-[256px_minmax(0,1fr)]',
          )}
        >
          {/* Sidebar on large screens */}
          <aside className="hidden lg:block">
            <div className="sticky top-20 space-y-1 rounded-lg border bg-card p-2 shadow-sm">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
                className={cn('mb-1 w-full text-muted-foreground', sidebarCollapsed ? 'justify-center px-0' : 'justify-start')}
                aria-label={sidebarCollapsed ? 'Expand navigation' : 'Collapse navigation'}
              >
                {sidebarCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
                {!sidebarCollapsed && <span className="ml-2">Collapse</span>}
              </Button>
              {modules.map((module) => {
                const Icon = module.icon;
                const isActive = activeModule === module.id;
                return (
                  <Button
                    key={module.id}
                    variant={isActive ? 'default' : 'ghost'}
                    title={sidebarCollapsed ? module.name : undefined}
                    aria-current={isActive ? 'page' : undefined}
                    className={cn('h-auto w-full whitespace-normal py-2.5', sidebarCollapsed ? 'justify-center px-0' : 'justify-start px-3')}
                    onClick={() => setActiveModule(module.id)}
                  >
                    <Icon className={cn('h-5 w-5 shrink-0', !sidebarCollapsed && 'mr-3')} />
                    {!sidebarCollapsed && (
                      <span className="min-w-0 text-left">
                        <span className="block font-medium">{module.name}</span>
                        <span className={cn('block text-xs font-normal', isActive ? 'text-primary-foreground/80' : 'text-muted-foreground')}>
                          {module.description}
                        </span>
                      </span>
                    )}
                  </Button>
                );
              })}
            </div>
          </aside>

          {/* Main content */}
          <div className="min-w-0 space-y-6">
            <StatusBanners />
            <div>
              <div className="flex items-center gap-3">
                <ActiveIcon className="h-6 w-6 shrink-0 text-primary" />
                <h2 className="text-2xl font-bold">{activeModuleData.name}</h2>
              </div>
              <p className="mt-1 text-muted-foreground">{activeModuleData.description}</p>
            </div>
            <Suspense fallback={<ModuleFallback />}>{renderActiveModule()}</Suspense>
          </div>
        </div>
      </div>
    </SemaProvider>
  );
}
