---
name: Deployment request
about: Request a deployment to staging or production
title: '[DEPLOY] '
labels: deployment
assignees: ''
---

## Deployment Type
- [ ] Staging
- [ ] Production

## Changes to Deploy
<!-- List the PRs or commits being deployed -->
- PR #123: Feature X
- PR #124: Bug fix Y
- Commit abc123: Hotfix Z

## Deployment Checklist
- [ ] All tests are passing in CI
- [ ] Database migrations are tested and backward compatible
- [ ] Performance testing completed (if applicable)
- [ ] Security scans completed (if applicable)
- [ ] Documentation updated
- [ ] Release notes prepared

## Deployment Window
<!-- When should this deployment occur? -->
Proposed date/time: YYYY-MM-DD HH:MM (UTC)
Expected downtime: None / X minutes

## Post-Deployment Verification Plan
<!-- How will we verify the deployment was successful? -->
1. Smoke tests to run: X, Y, Z
2. Manual verification steps: ...
3. Monitoring metrics to watch: ...

## Rollback Plan
<!-- In case of issues, what's the rollback plan? -->
1. Swap deployment slots (for zero-downtime deployments)
2. Revert database migrations if needed
3. ...

## Approvals
<!-- Required approvals before deployment -->
- [ ] Product owner
- [ ] Technical lead
- [ ] QA/Testing
