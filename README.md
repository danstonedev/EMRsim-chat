# EMRsim-chat

A real-time electronic medical record simulation chat application for healthcare education.

## Architecture

EMRsim-chat is built with a modern cloud-native architecture:
- Frontend: React with TypeScript
- Backend: Node.js with WebSocket support
- Database: PostgreSQL (migrated from SQLite)
- Caching: Redis
- Deployment: Azure Cloud Services

## Development Setup

### Prerequisites

- Node.js 16+
- npm 8+
- PostgreSQL 13+ (or SQLite for local development)
- Git

### Installation

1. Clone the repository
   ```bash
   git clone https://github.com/yourusername/EMRsim-chat.git
   cd EMRsim-chat
   ```

2. Install dependencies
   ```bash
   npm install
   ```

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
