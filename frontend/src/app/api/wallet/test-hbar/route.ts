import { requireUser } from '@/server/auth';
import { route } from '@/server/http';
import { grantTestHbar } from '@/server/services/wallet';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export const POST = route(async (req) => grantTestHbar(await requireUser(req)));
