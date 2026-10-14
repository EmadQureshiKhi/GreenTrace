'use client';

import { useState, type ComponentType, type FormEvent } from 'react';
import {
  AlertCircle,
  BookOpen,
  Building,
  ChevronDown,
  Edit,
  Heart,
  Loader2,
  MapPin,
  Plus,
  Shield,
  ShoppingCart,
  Target,
  Trash2,
  TrendingUp,
  Truck,
  Users,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { HcsTransactionDisplay } from '@/components/ui/hcs-transaction-display';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { useSema } from './sema-context';
import { ConfirmDialog, EmptyState, ModuleSkeleton, ScoreSelect, StatCard } from './sema-shared';
import { runWithToast } from './sema-utils';
import { PRIORITY_THRESHOLD, stakeholderScores, type SemaStakeholder, type StakeholderInput } from './sema-types';

const STAKEHOLDER_TYPES = [
  'Employees',
  'Customers',
  'Investors',
  'Suppliers',
  'Local Community',
  'Government',
  'NGOs',
  'Media',
  'Industry Associations',
  'Trade Unions',
  'Competitors',
  'Other',
];

const REFERENCE_GROUPS: {
  name: string;
  category: 'Internal' | 'External';
  description: string;
  icon: ComponentType<{ className?: string }>;
  tone: string;
}[] = [
  {
    name: 'Shareholders and investors',
    category: 'Internal',
    description:
      'As partial owners they guide key decisions, including on ESG. They influence strategy, funding and investment, and hold the organization to account.',
    icon: TrendingUp,
    tone: 'bg-sky-600',
  },
  {
    name: 'Business partners',
    category: 'External',
    description:
      'Entities with direct, formal engagement such as lenders, insurers, industry associations, B2B customers and joint venture partners.',
    icon: Building,
    tone: 'bg-emerald-600',
  },
  {
    name: 'Civil society organizations',
    category: 'External',
    description:
      'Partners in community initiatives that shape brand image through media, publications and advocacy. Includes intergovernmental and multilateral organizations.',
    icon: Heart,
    tone: 'bg-violet-600',
  },
  {
    name: 'Consumers',
    category: 'External',
    description:
      'The ultimate users of a product or service, even when not buying directly. Increasingly important to business decisions and reputation.',
    icon: ShoppingCart,
    tone: 'bg-orange-600',
  },
  {
    name: 'Customers',
    category: 'External',
    description: 'Direct buyers, with a strong influence on strategy, branding and how investment is allocated.',
    icon: Users,
    tone: 'bg-teal-600',
  },
  {
    name: 'Employees and other workers',
    category: 'Internal',
    description: 'Essential human and social capital whose rights and preferences shape policy to a significant degree.',
    icon: Users,
    tone: 'bg-sky-600',
  },
  {
    name: 'Government and regulators',
    category: 'External',
    description: 'Maintain the legal framework and policies for a fair, competitive market, and set compliance obligations.',
    icon: Building,
    tone: 'bg-red-600',
  },
  {
    name: 'Local communities',
    category: 'External',
    description:
      'Contribute to the workforce and are affected by operations through proximity. Their wellbeing and input need to be taken into account.',
    icon: MapPin,
    tone: 'bg-amber-600',
  },
  {
    name: 'NGOs',
    category: 'External',
    description: 'Often the implementing arm of community engagement and social programmes.',
    icon: Heart,
    tone: 'bg-pink-600',
  },
  {
    name: 'Suppliers',
    category: 'External',
    description: 'Critical parts of the value chain; disruptions in their operations can directly affect business outputs.',
    icon: Truck,
    tone: 'bg-cyan-600',
  },
  {
    name: 'Trade unions',
    category: 'External',
    description: 'Represent worker interests and negotiate collective agreements, shaping worker protection and hiring.',
    icon: Users,
    tone: 'bg-amber-600',
  },
  {
    name: 'Vulnerable groups',
    category: 'External',
    description:
      'People who may experience negative impacts more severely than the general population. Understanding these impacts is key to mitigating them.',
    icon: Shield,
    tone: 'bg-red-600',
  },
];

const EMPTY_FORM: StakeholderInput = {
  name: '',
  category: 'External',
  stakeholder_type: '',
  dependency_economic: 3,
  dependency_social: 3,
  dependency_environmental: 3,
  influence_economic: 3,
  influence_social: 3,
  influence_environmental: 3,
  population_size: 0,
};

const INFLUENCE_BADGE: Record<SemaStakeholder['influence_category'], string> = {
  High: 'border-transparent bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200',
  Medium: 'border-transparent bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-200',
  Low: '',
};

export default function StakeholderManagement() {
  const { activeClient, isDemo, isLoading, stakeholders, latestStakeholderHcsTx, addStakeholder, updateStakeholder, deleteStakeholder } = useSema();
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editing, setEditing] = useState<SemaStakeholder | null>(null);
  const [deleting, setDeleting] = useState<SemaStakeholder | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [showReference, setShowReference] = useState(false);
  const [formData, setFormData] = useState<StakeholderInput>(EMPTY_FORM);

  const set = <K extends keyof StakeholderInput>(key: K, value: StakeholderInput[K]) => setFormData((prev) => ({ ...prev, [key]: value }));

  const resetForm = () => {
    setFormData(EMPTY_FORM);
    setEditing(null);
    setIsFormOpen(false);
  };

  const handleEdit = (s: SemaStakeholder) => {
    setFormData({
      name: s.name,
      category: s.category,
      stakeholder_type: s.stakeholder_type ?? '',
      dependency_economic: s.dependency_economic,
      dependency_social: s.dependency_social,
      dependency_environmental: s.dependency_environmental,
      influence_economic: s.influence_economic,
      influence_social: s.influence_social,
      influence_environmental: s.influence_environmental,
      population_size: s.population_size,
    });
    setEditing(s);
    setIsFormOpen(true);
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    const ok = editing
      ? await runWithToast(() => updateStakeholder(editing.id, formData), { title: 'Stakeholder updated', description: formData.name })
      : await runWithToast(() => addStakeholder(formData), { title: 'Stakeholder added', description: formData.name });
    setIsSaving(false);
    if (ok) resetForm();
  };

  if (isLoading) return <ModuleSkeleton />;
  if (!activeClient) {
    return (
      <Card>
        <EmptyState icon={Users} title="No organization selected">
          Select an organization to manage its stakeholders.
        </EmptyState>
      </Card>
    );
  }

  const preview = stakeholderScores(formData);
  const priority = stakeholders.filter((s) => s.is_priority).length;
  const highInfluence = stakeholders.filter((s) => s.influence_category === 'High').length;

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Total stakeholders" value={stakeholders.length} icon={Users} iconClassName="text-sky-600" />
        <StatCard label="Priority" value={priority} hint={`Score ${PRIORITY_THRESHOLD}+ of 30`} icon={Target} iconClassName="text-emerald-600" />
        <StatCard label="High influence" value={highInfluence} icon={TrendingUp} iconClassName="text-violet-600" />
        <StatCard label="Standard" value={stakeholders.length - priority} icon={AlertCircle} iconClassName="text-muted-foreground" />
      </div>

      {isFormOpen && (
        <Card>
          <CardHeader>
            <CardTitle>{editing ? 'Edit stakeholder' : 'Add stakeholder'}</CardTitle>
            <CardDescription>Rate dependency and influence from 1 to 5 across three dimensions</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="stakeholder-name">Name</Label>
                  <Input
                    id="stakeholder-name"
                    value={formData.name}
                    onChange={(e) => set('name', e.target.value)}
                    placeholder="e.g. Plant workforce"
                    required
                    maxLength={200}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="stakeholder-type">Type</Label>
                  <Select value={formData.stakeholder_type} onValueChange={(value) => set('stakeholder_type', value)}>
                    <SelectTrigger id="stakeholder-type">
                      <SelectValue placeholder="Select a stakeholder type" />
                    </SelectTrigger>
                    <SelectContent>
                      {STAKEHOLDER_TYPES.map((type) => (
                        <SelectItem key={type} value={type}>
                          {type}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="stakeholder-category">Category</Label>
                  <Select value={formData.category} onValueChange={(value: 'Internal' | 'External') => set('category', value)}>
                    <SelectTrigger id="stakeholder-category">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Internal">Internal</SelectItem>
                      <SelectItem value="External">External</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="stakeholder-population">Population size</Label>
                  <Input
                    id="stakeholder-population"
                    type="number"
                    inputMode="numeric"
                    min={0}
                    value={formData.population_size}
                    onChange={(e) => set('population_size', Math.max(0, parseInt(e.target.value, 10) || 0))}
                  />
                  <p className="text-xs text-muted-foreground">How many people are in this group. Use 0 if unknown.</p>
                </div>
              </div>

              <fieldset className="space-y-3">
                <legend className="font-medium">Dependency</legend>
                <p className="text-sm text-muted-foreground">How much does this stakeholder depend on the organization?</p>
                <div className="grid gap-4 md:grid-cols-3">
                  <ScoreSelect id="dep-econ" label="Economic" value={formData.dependency_economic} onChange={(v) => set('dependency_economic', v)} />
                  <ScoreSelect id="dep-soc" label="Social" value={formData.dependency_social} onChange={(v) => set('dependency_social', v)} />
                  <ScoreSelect id="dep-env" label="Environmental" value={formData.dependency_environmental} onChange={(v) => set('dependency_environmental', v)} />
                </div>
              </fieldset>

              <fieldset className="space-y-3">
                <legend className="font-medium">Influence</legend>
                <p className="text-sm text-muted-foreground">How much influence does this stakeholder have over the organization?</p>
                <div className="grid gap-4 md:grid-cols-3">
                  <ScoreSelect id="inf-econ" label="Economic" value={formData.influence_economic} onChange={(v) => set('influence_economic', v)} />
                  <ScoreSelect id="inf-soc" label="Social" value={formData.influence_social} onChange={(v) => set('influence_social', v)} />
                  <ScoreSelect id="inf-env" label="Environmental" value={formData.influence_environmental} onChange={(v) => set('influence_environmental', v)} />
                </div>
              </fieldset>

              <div className="grid gap-3 rounded-lg bg-muted/50 p-4 text-sm sm:grid-cols-3">
                <div>
                  <p className="text-muted-foreground">Total score</p>
                  <p className="text-lg font-semibold tabular-nums">{preview.total_score} / 30</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Influence</p>
                  <p className="text-lg font-semibold">{preview.influence_category}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Engagement</p>
                  <p className="text-lg font-semibold">{preview.is_priority ? 'Priority' : 'Standard'}</p>
                </div>
                <p className="text-xs text-muted-foreground sm:col-span-3">
                  Priority at {PRIORITY_THRESHOLD}+ total. Influence is High at 11+ of 15, Medium at 7+.
                </p>
              </div>

              <div className="flex flex-wrap gap-2">
                <Button type="submit" disabled={isSaving || !formData.name.trim()}>
                  {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {editing ? 'Save changes' : 'Add stakeholder'}
                </Button>
                <Button type="button" variant="outline" onClick={resetForm} disabled={isSaving}>
                  Cancel
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle>Stakeholders</CardTitle>
              <CardDescription>Prioritized by combined dependency and influence</CardDescription>
            </div>
            {!isFormOpen && !isDemo && (
              <Button onClick={() => setIsFormOpen(true)} className="self-start sm:self-auto">
                <Plus className="mr-2 h-4 w-4" />
                Add stakeholder
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {stakeholders.length === 0 ? (
            <EmptyState
              icon={Users}
              title="No stakeholders yet"
              action={
                !isFormOpen && (
                  <Button onClick={() => setIsFormOpen(true)}>
                    <Plus className="mr-2 h-4 w-4" />
                    Add the first stakeholder
                  </Button>
                )
              }
            >
              Add the groups that affect or are affected by the organization to start the assessment.
            </EmptyState>
          ) : (
            <div className="-mx-6 overflow-x-auto px-6">
              <table className="w-full min-w-[640px] text-sm">
                <thead>
                  <tr className="border-b text-left text-muted-foreground">
                    <th className="p-2 font-medium">Name</th>
                    <th className="p-2 font-medium">Category</th>
                    <th className="p-2 text-center font-medium">Score</th>
                    <th className="p-2 text-center font-medium">Influence</th>
                    <th className="p-2 text-center font-medium">Priority</th>
                    <th className="p-2 text-right font-medium">Population</th>
                    {!isDemo && <th className="p-2 text-right font-medium">Actions</th>}
                  </tr>
                </thead>
                <tbody>
                  {[...stakeholders]
                    .sort((a, b) => b.total_score - a.total_score)
                    .map((s) => (
                      <tr key={s.id} className="border-b last:border-0 hover:bg-muted/50">
                        <td className="p-2">
                          <p className="font-medium">{s.name}</p>
                          {s.stakeholder_type && <p className="text-xs text-muted-foreground">{s.stakeholder_type}</p>}
                        </td>
                        <td className="p-2">
                          <Badge variant={s.category === 'Internal' ? 'default' : 'secondary'}>{s.category}</Badge>
                        </td>
                        <td className="p-2 text-center tabular-nums">
                          <span className="font-semibold">{s.total_score}</span>
                          <span className="text-muted-foreground">/30</span>
                        </td>
                        <td className="p-2 text-center">
                          <Badge variant="outline" className={INFLUENCE_BADGE[s.influence_category]}>
                            {s.influence_category}
                          </Badge>
                        </td>
                        <td className="p-2 text-center">
                          {s.is_priority ? (
                            <Badge className="border-transparent bg-emerald-100 text-emerald-800 hover:bg-emerald-100 dark:bg-emerald-950 dark:text-emerald-200">
                              Priority
                            </Badge>
                          ) : (
                            <Badge variant="outline">Standard</Badge>
                          )}
                        </td>
                        <td className="p-2 text-right tabular-nums">{s.population_size > 0 ? s.population_size.toLocaleString() : 'Unknown'}</td>
                        {!isDemo && (
                          <td className="p-2">
                            <div className="flex justify-end gap-1">
                              <Button variant="ghost" size="icon" className="h-8 w-8" aria-label={`Edit ${s.name}`} onClick={() => handleEdit(s)}>
                                <Edit className="h-4 w-4" />
                              </Button>
                              <Button variant="ghost" size="icon" className="h-8 w-8" aria-label={`Delete ${s.name}`} onClick={() => setDeleting(s)}>
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </td>
                        )}
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {!isDemo && (
        <HcsTransactionDisplay
          transaction={latestStakeholderHcsTx}
          title="Stakeholder audit log"
          description="Latest stakeholder change logged to Hedera Consensus Service"
        />
      )}

      <Card>
        <button
          type="button"
          onClick={() => setShowReference((v) => !v)}
          className="flex w-full items-center justify-between gap-3 p-6 text-left"
          aria-expanded={showReference}
        >
          <span className="flex items-center gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-sky-100 text-sky-700 dark:bg-sky-950 dark:text-sky-300">
              <BookOpen className="h-5 w-5" />
            </span>
            <span>
              <span className="block font-semibold">Stakeholder group reference</span>
              <span className="block text-sm text-muted-foreground">Twelve common groups and why they matter to a materiality assessment</span>
            </span>
          </span>
          <ChevronDown className={cn('h-5 w-5 shrink-0 text-muted-foreground transition-transform', showReference && 'rotate-180')} />
        </button>
        {showReference && (
          <CardContent className="pt-0">
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {REFERENCE_GROUPS.map((group) => (
                <div key={group.name} className="rounded-lg border p-4">
                  <div className="mb-3 flex items-center gap-3">
                    <div className={cn('flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-white', group.tone)}>
                      <group.icon className="h-5 w-5" />
                    </div>
                    <div className="min-w-0">
                      <h4 className="font-semibold leading-tight">{group.name}</h4>
                      <span className="text-xs text-muted-foreground">{group.category}</span>
                    </div>
                  </div>
                  <p className="text-sm leading-relaxed text-muted-foreground">{group.description}</p>
                </div>
              ))}
            </div>
          </CardContent>
        )}
      </Card>

      <ConfirmDialog
        open={deleting !== null}
        onOpenChange={(open) => !open && setDeleting(null)}
        title={`Delete ${deleting?.name ?? 'stakeholder'}?`}
        description="The stakeholder and its scores are removed from this assessment."
        onConfirm={async () => {
          if (deleting) await deleteStakeholder(deleting.id);
        }}
      />
    </div>
  );
}
