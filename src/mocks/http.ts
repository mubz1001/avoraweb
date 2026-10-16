import { HttpResponse } from 'msw';

/** docs/06 §1 error envelope. */
export function fail(
  status: number,
  code: string,
  message: string,
  extra: {
    fieldErrors?: Record<string, string>;
    retryable?: boolean;
    headers?: Record<string, string>;
    body?: object;
  } = {},
) {
  return HttpResponse.json(
    {
      error: {
        code,
        message,
        ...(extra.fieldErrors ? { fieldErrors: extra.fieldErrors } : {}),
        retryable: extra.retryable ?? false,
        requestId: 'req_' + Math.random().toString(16).slice(2, 10),
      },
      ...extra.body,
    },
    { status, headers: extra.headers },
  );
}

/** Simulated latency so busy states are visible in the browser; skipped under test. */
export const wait = (ms: number) =>
  import.meta.env.MODE === 'test' ? Promise.resolve() : new Promise<void>((r) => setTimeout(r, ms));

/** Reads a JSON body without throwing; handlers validate the shape themselves. */
export async function readJson(request: Request): Promise<Record<string, unknown>> {
  try {
    const v: unknown = await request.json();
    return v && typeof v === 'object' ? (v as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

export const str = (v: unknown) => (typeof v === 'string' ? v : '');
