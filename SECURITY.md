# Security Policy

Last updated: 2025-10-23

We take the security of this project and our users seriously. This document defines how we handle secrets, credentials, and security-related changes in this repository.

## Secrets and Credentials

- Never commit secrets to the repository. This includes API keys, passwords, tokens, or private URLs.
- Use environment variables and your platform's secret manager (e.g., Vercel, GitHub Actions Secrets, Azure Key Vault) for runtime configuration.
- .env files should only contain placeholders or local development defaults and must not be committed with real values.
- If a secret is accidentally committed:
  1. Rotate the secret immediately at the provider.
  2. Remove or redact the value from the repository history if necessary.
  3. Create an incident note in the relevant deployment/runbook.

## Secret Scanning

- Run `npm run secrets:scan` before pushes to catch obvious secret patterns.
- Configure repository-level secret scanning where available (e.g., GitHub Advanced Security or Vercel/Git provider integrations).

## CI/CD Workflows

- Deployments should be manual or gated via approvals. Avoid workflows that deploy on any push without review.
- Store all credentials in CI secret stores. Never hardcode credentials in YAML.
- Prefer least-privilege service principals and scoped tokens.

## Reporting a Vulnerability

If you discover a security issue, please do not create a public issue. Instead, contact the maintainers directly or use your organization's responsible disclosure process.

## Hardening Checklist

- [ ] Secrets stored only in secret managers (not in files)
- [ ] Environment variables documented (names only, no values)
- [ ] CI deployments require manual trigger or approvals
- [ ] Dependencies monitored for vulnerabilities
- [ ] CORS and rate limiting configured server-side
- [ ] Logs avoid printing sensitive data

## Related Docs

- WORKSPACE_CLEANUP_REPORT.md
- VERCEL_DEPLOYMENT_STATUS.md
- PRODUCTION_READINESS.md
