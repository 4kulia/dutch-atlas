function required(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing required env: ${name}`);
  return v;
}
function optional(name: string, fallback: string): string {
  return process.env[name] || fallback;
}

export const config = {
  port: Number(optional('PORT', '8091')),
  nodeEnv: optional('NODE_ENV', 'development'),

  databaseUrl: required('DATABASE_URL'),

  // Auth — Google OAuth + our own session JWT.
  jwtSecret: required('JWT_SECRET'),
  googleClientId: required('GOOGLE_OAUTH_CLIENT_ID'),
  googleClientSecret: required('GOOGLE_OAUTH_CLIENT_SECRET'),
  publicBaseUrl: required('PUBLIC_BASE_URL').replace(/\/+$/, ''),

  // Embeddings + LLM keys.
  voyageApiKey: required('VOYAGE_API_KEY'),
  voyageModel: optional('VOYAGE_EMBED_MODEL', 'voyage-3.5'),
  anthropicApiKey: required('ANTHROPIC_API_KEY'),
  exaApiKey: optional('EXA_API_KEY', ''),

  // Models — Sonnet for tool-use turns, Haiku could be used for short
  // helper messages later. Override per-deployment.
  modelToolUse: optional('AGENT_MODEL_TOOLS', 'claude-sonnet-4-6'),
  modelFinal: optional('AGENT_MODEL_FINAL', 'claude-haiku-4-5-20251001'),
  agentMaxTurns: Number(optional('AGENT_MAX_TURNS', '8')),
  agentMaxBudgetUsd: Number(optional('AGENT_MAX_BUDGET_USD', '0.20')),

  // Where uploaded photos live on disk. Resolved relative to process.cwd()
  // when relative — works for both `npm run dev` from api/ and the Docker
  // image (WORKDIR=/app, mount `./uploads:/app/uploads`).
  uploadsDir: optional('UPLOADS_DIR', './uploads'),
  uploadsMaxBytes: Number(optional('UPLOADS_MAX_BYTES', String(16 * 1024 * 1024))),
};
