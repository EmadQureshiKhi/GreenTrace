import 'server-only';
import { NextResponse } from 'next/server';
import { ZodError } from 'zod';
import { ConfigError } from './env';

export class HttpError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

export const badRequest = (message: string) => new HttpError(400, message);
export const unauthorized = (message = 'Sign in to continue.') => new HttpError(401, message);
export const forbidden = (message: string) => new HttpError(403, message);
export const notFound = (message: string) => new HttpError(404, message);
export const conflict = (message: string) => new HttpError(409, message);

type Handler<C> = (req: Request, ctx: C) => Promise<Response | unknown>;

/** Wraps a route handler: JSON responses, consistent error shape, no stack traces to the client. */
export function route<C = unknown>(handler: Handler<C>) {
  return async (req: Request, ctx: C): Promise<Response> => {
    try {
      const result = await handler(req, ctx);
      return result instanceof Response ? result : NextResponse.json(result ?? { ok: true });
    } catch (error) {
      if (error instanceof HttpError) {
        return NextResponse.json({ error: error.message }, { status: error.status });
      }
      if (error instanceof ZodError) {
        const issue = error.issues[0];
        const where = issue?.path.length ? `${issue.path.join('.')}: ` : '';
        return NextResponse.json({ error: `Invalid request. ${where}${issue?.message ?? ''}`.trim() }, { status: 400 });
      }
      if (error instanceof ConfigError) {
        console.error(error.message);
        return NextResponse.json({ error: error.message }, { status: 503 });
      }
      console.error(error);
      const message = error instanceof Error ? error.message : 'Unexpected error';
      return NextResponse.json({ error: message }, { status: 500 });
    }
  };
}

export async function readJson(req: Request): Promise<unknown> {
  try {
    return await req.json();
  } catch {
    throw badRequest('Request body must be JSON.');
  }
}
