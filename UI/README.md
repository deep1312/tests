# PostgreSQL Health Monitoring Platform - Frontend UI

A modern React 18 + TypeScript frontend for the PostgreSQL Health Monitoring Platform. Built with Vite, Tailwind CSS, and shadcn/ui components.

## Table of Contents

- [Prerequisites](#prerequisites)
- [Project Structure](#project-structure)
- [Local Setup](#local-setup)
- [Running the Application](#running-the-application)
- [Testing](#testing)
- [Development](#development)
- [Building for Production](#building-for-production)
- [Environment Configuration](#environment-configuration)
- [Features](#features)
- [Troubleshooting](#troubleshooting)

## Prerequisites

- **Node.js**: 18 or higher
- **npm**: 9 or higher (comes with Node.js)
- **Git**: For version control
- **Backend API**: Running on http://localhost:8000 (for development)

### Verify Prerequisites

```bash
node --version   # Should be 18+
npm --version    # Should be 9+
git --version    # Should be 2.0+
```

## Project Structure

```
ui/
├── src/
│   ├── api/                     # TanStack Query hooks for API calls
│   │   ├── servers.ts          # Server management hooks
│   │   ├── checks.ts           # Check management hooks
│   │   ├── thresholds.ts       # Threshold management hooks
│   │   ├── monitoring.ts       # Monitoring data hooks
│   │   ├── alerts.ts           # Alert management hooks
│   │   ├── incidents.ts        # Incident management hooks
│   │   ├── dashboard.ts        # Dashboard data hooks
│   │   ├── audit.ts            # Audit log hooks
│   │   └── client.ts           # Axios client configuration
│   ├── components/
│   │   ├── layout/             # Layout components
│   │   │   ├── Sidebar.tsx
│   │   │   ├── TopBar.tsx
│   │   │   ├── SessionBanner.tsx
│   │   │   └── ProtectedRoute.tsx
│   │   ├── dashboard/          # Dashboard components
│   │   │   ├── ServerCard.tsx
│   │   │   ├── TopFailingChecks.tsx
│   │   │   └── MetricsChart.tsx
│   │   ├── servers/            # Server management components
│   │   │   └── ServerForm.tsx
│   │   ├── checks/             # Check management components
│   │   │   └── MappingSection.tsx
│   │   ├── thresholds/         # Threshold components
│   │   │   └── ThresholdForm.tsx
│   │   ├── alerts/             # Alert components
│   │   │   └── AcknowledgeButton.tsx
│   │   ├── incidents/          # Incident components
│   │   │   └── RootCauseEditor.tsx
│   │   ├── audit/              # Audit log components
│   │   └── shared/             # Shared components
│   │       ├── EmptyState.tsx
│   │       ├── LoadingSpinner.tsx
│   │       ├── ErrorBanner.tsx
│   │       └── TimestampCell.tsx
│   ├── pages/                  # Page components
│   │   ├── Dashboard.tsx
│   │   ├── Servers.tsx
│   │   ├── Checks.tsx
│   │   ├── Thresholds.tsx
│   │   ├── Alerts.tsx
│   │   ├── Incidents.tsx
│   │   ├── IncidentDetail.tsx
│   │   ├── AuditLog.tsx
│   │   ├── Settings.tsx
│   │   └── Login.tsx
│   ├── store/                  # Zustand state management
│   │   └── authStore.ts        # Authentication state
│   ├── utils/                  # Utility functions
│   │   ├── timezone.ts         # Timezone conversion
│   │   └── duration.ts         # Duration formatting
│   ├── hooks/                  # Custom React hooks
│   │   └── useAuth.ts          # Authentication hook
│   ├── test/                   # Test utilities
│   │   └── setup.ts            # Test configuration
│   ├── App.tsx                 # Main app component with routing
│   ├── main.tsx                # Entry point
│   └── index.css               # Global styles
├── tests/
│   ├── unit/                   # Unit tests
│   │   ├── TimestampCell.test.tsx
│   │   ├── duration.test.ts
│   │   ├── timezone.test.ts
│   │   ├── ServerCard.test.tsx
│   │   ├── EmptyState.test.tsx
│   │   ├── ServerForm.test.tsx
│   │   └── Login.test.tsx
│   └── unit/a11y/              # Accessibility tests
│       ├── Dashboard.a11y.test.tsx
│       ├── Servers.a11y.test.tsx
│       ├── Alerts.a11y.test.tsx
│       ├── Incidents.a11y.test.tsx
│       └── Login.a11y.test.tsx
├── public/                     # Static assets
├── package.json                # npm dependencies and scripts
├── vite.config.ts              # Vite configuration
├── vitest.config.ts            # Vitest configuration
├── tsconfig.json               # TypeScript configuration
├── tailwind.config.ts          # Tailwind CSS configuration
├── postcss.config.js           # PostCSS configuration
├── components.json             # shadcn/ui configuration
└── README.md                   # This file
```

## Local Setup

### 1. Clone the Repository

```bash
git clone <repository-url>
cd pg-health-platform/ui
```

### 2. Install Dependencies

```bash
npm install
```

This will install all dependencies including:
- React 18 and React DOM
- TypeScript
- Vite (build tool)
- Tailwind CSS
- shadcn/ui components
- TanStack Query (data fetching)
- React Router (routing)
- Zustand (state management)
- Vitest (testing)
- And more...

### 3. Set Up Environment Variables

Create a `.env.local` file in the `ui/` directory:

```bash
# API Configuration
VITE_API_URL=http://localhost:8000

# Optional: Enable debug logging
VITE_DEBUG=false
```

### 4. Verify Backend is Running

Ensure the backend API is running on http://localhost:8000:

```bash
# In another terminal, from the api/ directory
cd ../api
uvicorn app.main:app --reload
```

## Running the Application

### Development Server

```bash
# Start the development server
npm run dev

# The application will be available at http://localhost:5173
```

The development server includes:
- Hot module replacement (HMR) for instant updates
- TypeScript type checking
- Tailwind CSS compilation
- Automatic browser refresh

### Access the Application

1. Open http://localhost:5173 in your browser
2. Login with default credentials:
   - **Username**: `admin`
   - **Password**: `admin`
3. Change the password immediately in production

## Testing

### Run All Tests

```bash
# Run all tests once
npm test -- --run

# Run tests in watch mode (for development)
npm test
```

### Run Specific Test Categories

```bash
# Unit tests only
npm test -- --run ui/tests/unit/

# Accessibility tests only
npm test -- --run ui/tests/unit/a11y/

# Specific test file
npm test -- --run ui/tests/unit/TimestampCell.test.tsx
```

### Run Tests with Coverage

```bash
npm test -- --run --coverage
```

Coverage report will be generated in `coverage/` directory.

### Run Accessibility Tests

```bash
# Run all accessibility tests
npm test -- --run ui/tests/unit/a11y/

# Run specific accessibility test
npm test -- --run ui/tests/unit/a11y/Dashboard.a11y.test.tsx
```

These tests validate WCAG 2.1 AA compliance using jest-axe.

## Development

### Code Structure

#### Pages
Located in `src/pages/`, each page corresponds to a route:
- `Dashboard.tsx` - Overview of all servers
- `Servers.tsx` - Server management
- `Checks.tsx` - Health check management
- `Thresholds.tsx` - Alert threshold configuration
- `Alerts.tsx` - Alert viewing and acknowledgment
- `Incidents.tsx` - Incident tracking
- `IncidentDetail.tsx` - Detailed incident view
- `AuditLog.tsx` - Audit log viewing
- `Settings.tsx` - User settings
- `Login.tsx` - Authentication

#### Components
Located in `src/components/`, organized by feature:
- `layout/` - Navigation and layout components
- `dashboard/` - Dashboard-specific components
- `servers/` - Server management components
- `checks/` - Check management components
- `thresholds/` - Threshold components
- `alerts/` - Alert components
- `incidents/` - Incident components
- `audit/` - Audit log components
- `shared/` - Reusable components

#### API Hooks
Located in `src/api/`, using TanStack Query:
- `servers.ts` - Server CRUD operations
- `checks.ts` - Check and mapping operations
- `thresholds.ts` - Threshold operations
- `monitoring.ts` - Monitoring data queries
- `alerts.ts` - Alert operations
- `incidents.ts` - Incident operations
- `dashboard.ts` - Dashboard data queries
- `audit.ts` - Audit log queries

#### State Management
Located in `src/store/`:
- `authStore.ts` - Authentication state (Zustand)

#### Utilities
Located in `src/utils/`:
- `timezone.ts` - UTC to local timezone conversion
- `duration.ts` - Duration formatting (e.g., "2h 14m")

### Adding a New Page

1. Create component in `src/pages/NewPage.tsx`
2. Add route in `src/App.tsx`
3. Add navigation link in `src/components/layout/Sidebar.tsx`
4. Create API hooks in `src/api/newFeature.ts` if needed
5. Add tests in `tests/unit/NewPage.test.tsx`

### Adding a New Component

1. Create component in `src/components/<category>/NewComponent.tsx`
2. Export from component's index file if needed
3. Add tests in `tests/unit/NewComponent.test.tsx`
4. Use in pages or other components

### Adding API Hooks

1. Create hooks in `src/api/newFeature.ts`
2. Use `useQuery` for GET requests
3. Use `useMutation` for POST/PUT/DELETE requests
4. Handle loading and error states
5. Add tests for hook behavior

## Building for Production

### Build the Application

```bash
# Create optimized production build
npm run build

# Output will be in dist/ directory
```

### Preview Production Build

```bash
# Preview the production build locally
npm run preview

# Application will be available at http://localhost:4173
```

### Build Output

The `dist/` directory contains:
- Minified JavaScript bundles
- Optimized CSS
- Compressed assets
- Source maps (for debugging)

## Environment Configuration

### Development Environment

```bash
# .env.local
VITE_API_URL=http://localhost:8000
VITE_DEBUG=true
```

### Production Environment

```bash
# .env.production
VITE_API_URL=https://api.example.com
VITE_DEBUG=false
```

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `VITE_API_URL` | `http://localhost:8000` | Backend API URL |
| `VITE_DEBUG` | `false` | Enable debug logging |

## Features

### Authentication
- JWT-based authentication
- Automatic token refresh
- Session expiry warning
- Role-based access control (admin/viewer)

### Server Management
- Add, edit, and delete PostgreSQL servers
- Connection validation
- Credential encryption
- Retention policy configuration

### Health Monitoring
- Define custom health checks
- Map checks to servers
- Real-time health status
- Health trend indicators

### Alerting
- Threshold-based alerts
- Alert acknowledgment
- Alert filtering and search
- Unacknowledged alert count

### Incident Tracking
- Automatic incident grouping
- Root cause documentation
- Incident duration tracking
- Incident filtering

### Dashboard
- Server health overview
- Top failing checks
- Metrics visualization
- Collector state tracking

### Audit Logging
- Complete audit trail
- User action tracking
- Timestamp and details
- Filterable by resource

## Styling

### Tailwind CSS

The project uses Tailwind CSS for styling. Configuration is in `tailwind.config.ts`.

### shadcn/ui Components

Pre-built components from shadcn/ui are used throughout the application:
- Buttons, inputs, forms
- Dialogs, modals, popovers
- Tables, cards, badges
- And more...

### Custom Styles

Global styles are in `src/index.css`. Component-specific styles use Tailwind classes.

## Performance Optimization

### Code Splitting
- Automatic route-based code splitting with React Router
- Lazy loading of components

### Data Fetching
- TanStack Query for efficient caching
- Automatic request deduplication
- Background refetching

### Image Optimization
- Optimized asset loading
- Lazy loading of images

### Bundle Size
- Tree-shaking of unused code
- Minification and compression
- Source maps for debugging

## Accessibility

### WCAG 2.1 AA Compliance
- Semantic HTML
- ARIA labels and roles
- Keyboard navigation
- Color contrast ratios
- Focus management

### Testing
- Automated accessibility tests with jest-axe
- Manual testing with screen readers
- Keyboard navigation testing

## Troubleshooting

### Issue: API connection error

**Error**: `Failed to fetch from http://localhost:8000`

**Solution**:
1. Verify backend is running: `http://localhost:8000/docs`
2. Check `VITE_API_URL` in `.env.local`
3. Ensure CORS is configured correctly in backend

### Issue: Port already in use

**Error**: `Port 5173 is already in use`

**Solution**: Use a different port:
```bash
npm run dev -- --port 5174
```

### Issue: Module not found

**Error**: `Cannot find module '@/components/...'`

**Solution**: 
1. Check file path is correct
2. Verify file exists
3. Check TypeScript configuration in `tsconfig.json`

### Issue: Tailwind CSS not working

**Error**: Styles not applied

**Solution**:
1. Verify `tailwind.config.ts` includes correct paths
2. Check `postcss.config.js` is configured
3. Restart development server

### Issue: Tests failing

**Error**: Test failures or timeouts

**Solution**:
1. Ensure backend is running for integration tests
2. Check test setup in `vitest.config.ts`
3. Review test file for mocking issues

### Issue: TypeScript errors

**Error**: Type errors in IDE

**Solution**:
1. Run `npm run type-check` to verify types
2. Check `tsconfig.json` configuration
3. Ensure all dependencies are installed

### Issue: Login not working

**Error**: `401 Unauthorized`

**Solution**:
1. Verify backend is running
2. Check default credentials (admin/admin)
3. Verify `VITE_API_URL` is correct
4. Check browser console for error details

## Code Quality

### Type Checking

```bash
# Run TypeScript type checker
npm run type-check
```

### Linting

```bash
# Lint code with ESLint
npm run lint

# Fix linting issues
npm run lint -- --fix
```

### Formatting

```bash
# Format code with Prettier
npm run format

# Check formatting
npm run format -- --check
```

## Deployment

### Docker

```dockerfile
# Build stage
FROM node:18-alpine AS builder
WORKDIR /app
COPY package*.json .
RUN npm install
COPY . .
RUN npm run build

# Production stage
FROM node:18-alpine
WORKDIR /app
RUN npm install -g serve
COPY --from=builder /app/dist ./dist
EXPOSE 3000
CMD ["serve", "-s", "dist", "-l", "3000"]
```

### Docker Compose

```yaml
version: '3.8'

services:
  frontend:
    build: .
    environment:
      VITE_API_URL: http://api:8000
    ports:
      - "3000:3000"
    depends_on:
      - api
```

### Vercel Deployment

```bash
# Install Vercel CLI
npm install -g vercel

# Deploy
vercel
```

### Netlify Deployment

```bash
# Install Netlify CLI
npm install -g netlify-cli

# Deploy
netlify deploy --prod --dir=dist
```

## Additional Resources

- [React Documentation](https://react.dev/)
- [TypeScript Documentation](https://www.typescriptlang.org/)
- [Vite Documentation](https://vitejs.dev/)
- [Tailwind CSS Documentation](https://tailwindcss.com/)
- [shadcn/ui Documentation](https://ui.shadcn.com/)
- [TanStack Query Documentation](https://tanstack.com/query/latest)
- [React Router Documentation](https://reactrouter.com/)
- [Zustand Documentation](https://github.com/pmndrs/zustand)
- [Vitest Documentation](https://vitest.dev/)

## Support

For issues or questions:
1. Check the [Troubleshooting](#troubleshooting) section
2. Review component examples in `src/components/`
3. Check test files for usage patterns
4. Review the main spec at `.kiro/specs/pg-health-platform/requirements.md`

## License

[Your License Here]
