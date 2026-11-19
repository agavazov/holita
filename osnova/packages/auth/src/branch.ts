function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export async function verifyBranch(
  url: string,
  branchId: string,
  options: {
    authorization: string | undefined;
    query: string;
    requestId?: string;
    rejectRedirect?: boolean;
  },
): Promise<{ found: boolean; missing: boolean; validResponse: boolean }> {
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      ...(options.authorization ? { authorization: options.authorization } : {}),
      ...(options.requestId !== undefined ? { 'x-request-id': options.requestId } : {}),
    },
    body: JSON.stringify({ query: options.query, variables: { id: branchId } }),
    signal: AbortSignal.timeout(3000),
    ...(options.rejectRedirect ? { redirect: 'error' as const } : {}),
  });
  if (!response.ok) {
    throw new Error('Core returned an HTTP error');
  }
  const body: unknown = await response.json();
  const data = isRecord(body) && isRecord(body.data) ? body.data : undefined;
  const branch = data?.branch;
  return {
    found: isRecord(branch) && branch.id === branchId,
    missing: branch === null,
    validResponse:
      isRecord(body) &&
      (body.errors === undefined || (Array.isArray(body.errors) && body.errors.length === 0)) &&
      data !== undefined,
  };
}
