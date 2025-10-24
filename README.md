# EMRsim-chat

[![CI - Type Check](https://github.com/danstonedev/EMRsim-chat/actions/workflows/ci-type-check.yml/badge.svg)](https://github.com/danstonedev/EMRsim-chat/actions/workflows/ci-type-check.yml)

EMRsim-chat is built with a modern web architecture:
- Frontend: React + TypeScript (Vite)
- Backend: Node.js + Express + Socket.IO
- Media/3D: three.js and react-three-fiber
- Deployment: Vercel (frontend and backend)
- Backend: Node.js with WebSocket support
- Database: PostgreSQL (migrated from SQLite)
- Caching: Redis
- Deployment: Azure Cloud Services

### Deployment

We deploy on Vercel. Start here:
- `VERCEL_DEPLOYMENT_STATUS.md`
- `DEPLOYMENT_QUICK_START.md`

CI runs tests and checks on PRs. Production deploys are manual via Vercel.

- Node.js 16+
- npm 8+
```
EMRsim-chat/
├── frontend/          # React + Vite app
├── backend/           # Node.js API + Socket.IO
├── docs/              # Architecture and ops docs
├── ops/               # Operational guides and archives
├── scripts/           # Utilities (SPS tools, scanning, etc.)
└── e2e/               # Playwright tests
```

2. Install dependencies
   ```bash
- Vercel Deployment: `VERCEL_DEPLOYMENT_STATUS.md`, `DEPLOYMENT_GUIDE.md`, `DEPLOYMENT_QUICK_START.md`

3. Set up environment variables
   ```bash
   cp .env.example .env
   # Edit .env with your local configuration
   ```

4. Initialize the database
   ```bash
   npm run db:setup
   ```

5. Start the development server
   ```bash
   npm run dev
   ```

### Running Tests

```bash
# Run all tests
npm test

# Run unit tests only
npm run test:unit

# Run integration tests
npm run test:integration

# Run E2E tests
npm run test:e2e
```

## Deployment

The application is deployed using GitHub Actions to Azure Cloud services.

### Deployment Prerequisites

1. Azure subscription
2. GitHub repository
3. Configured GitHub Secrets (see [GitHub Setup Guide](docs/GITHUB_SETUP_GUIDE.md))

### Deployment Process

1. For staging deployment:
   - Push to the `develop` branch
   - GitHub Actions will automatically deploy to staging

2. For production deployment:
   - Create a Pull Request from `develop` to `main`
   - Once approved and merged, GitHub Actions will deploy to production

See the [Deployment Procedure](docs/DEPLOYMENT_PROCEDURE.md) for detailed deployment steps.

## Project Structure

```
EMRsim-chat/
├── src/
│   ├── client/       # Frontend React application
│   └── server/       # Backend Node.js application
├── infrastructure/   # Azure infrastructure as code
├── scripts/          # Utility scripts
├── docs/             # Documentation
└── tests/            # Test files
```

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## Documentation

- [Production Readiness Plan](PRODUCTION_READINESS_PLAN.md)
- [Azure Deployment Architecture](docs/AZURE_DEPLOYMENT_ARCHITECTURE.md)
- [GitHub Setup Guide](docs/GITHUB_SETUP_GUIDE.md)
- [Deployment Procedure](docs/DEPLOYMENT_PROCEDURE.md)
- [Migration Procedure](docs/MIGRATION_PROCEDURE.md)
- [Azure Service Setup](docs/AZURE_SERVICE_SETUP.md)

## License

[MIT License](LICENSE)

## Acknowledgments

- All contributors and team members
- Healthcare professionals who provided domain expertise
