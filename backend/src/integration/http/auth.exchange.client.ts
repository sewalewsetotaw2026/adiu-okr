// ─── Custom errors ────────────────────────────────────────────────────────────

export class InvalidCodeError extends Error {
  constructor(message = "Authorization code invalid or expired") {
    super(message);
    this.name = "InvalidCodeError";
  }
}

export class AuthServiceUnavailableError extends Error {
  constructor(message = "Auth service unreachable") {
    super(message);
    this.name = "AuthServiceUnavailableError";
  }
}

// ─── Shape ────────────────────────────────────────────────────────────────────

export interface ExchangeCodeResult {
  access_token:             string;
  refresh_token:            string;
  user_id:                  string;
  company_id:               number;
  auth_session_id:          string;
  access_token_expires_at:  string;
  refresh_token_expires_at: string;
}

// ─── Client ───────────────────────────────────────────────────────────────────

export async function exchangeCodeWithAuth(
  code: string
): Promise<ExchangeCodeResult> {
  let response: Response;

  try {
    response = await fetch(
      `${process.env.AUTH_SERVICE_URL}/api/v1/auth/token/exchange`,
      {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code,
          client_id:     process.env.EDM_CLIENT_ID,
          client_secret: process.env.EDM_CLIENT_SECRET,
        }),
        signal: AbortSignal.timeout(10_000),
      }
    );
    
  } catch {
    throw new AuthServiceUnavailableError("Auth service unreachable");
  }

  if (response.status === 401) {
    throw new InvalidCodeError();
  }

  if (!response.ok) {
    throw new AuthServiceUnavailableError(`Auth returned ${response.status}`);
  }

  const envelope = await response.json() as { success: boolean; data: ExchangeCodeResult };
  return envelope.data;
}