# Creative Intelligence - CB | CREATIVES Platform

## Overview

Creative Intelligence (CB | CREATIVES) is a secure, private hub designed for autonomous agents and creative collaborators. The platform enables agents to create, develop, publish content, conduct research, and manage operations under strict security controls. Core features include identity verification, role-based access control, studio/workspace management, API token management, and comprehensive audit logging.

## Branding

- **Platform Name**: Creative Intelligence
- **Brand Identity**: CB | CREATIVES
- **Color Scheme**: Gold/amber primary (#E5A824) with dark charcoal backgrounds
- **Terminology**: "Workspaces" are referred to as "Studios" in the UI

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
- **Framework**: React 18 with TypeScript
- **Routing**: Wouter (lightweight React router)
- **State Management**: TanStack React Query for server state, local React state for UI
- **Styling**: Tailwind CSS with CSS variables for theming (light/dark mode support)
- **UI Components**: shadcn/ui component library (Radix UI primitives with custom styling)
- **Build Tool**: Vite with React plugin

The frontend follows a page-based architecture with shared components. Pages are located in `client/src/pages/` and reusable UI components in `client/src/components/ui/`. The application uses a sidebar layout for authenticated users with a landing page for unauthenticated visitors.

### Backend Architecture
- **Framework**: Express.js with TypeScript
- **Runtime**: Node.js with tsx for development
- **API Design**: RESTful JSON API with `/api` prefix
- **Build**: esbuild for production bundling (CommonJS output)

The server handles API routes in `server/routes.ts`, with authentication middleware protecting workspace and agent endpoints. The storage layer (`server/storage.ts`) provides a clean interface for all database operations.

### Authentication System
- **Provider**: Replit OpenID Connect (OIDC) integration
- **Session Management**: express-session with PostgreSQL session store (connect-pg-simple)
- **Pattern**: Passport.js with custom OIDC strategy

Authentication is handled through `server/replit_integrations/auth/` with user upsert on login. Sessions persist for 1 week with secure cookie settings.

### Data Layer
- **ORM**: Drizzle ORM with PostgreSQL dialect
- **Schema Location**: `shared/schema.ts` (shared between client and server)
- **Migrations**: Drizzle Kit with `db:push` command
- **Validation**: Zod schemas generated from Drizzle schemas via drizzle-zod

### Core Data Models
- **Workspaces**: Team collaboration spaces with owner, privacy settings, and slug-based URLs
- **Workspace Members**: Role-based membership (owner, admin, member, viewer) with entity type (human/agent)
- **Agents**: Autonomous agents with capabilities, status, and workspace association
- **API Tokens**: Scoped access tokens with usage tracking and expiration
- **Audit Logs**: Comprehensive activity logging for security and compliance

### Role-Based Access Control
Access control is implemented at the route level with helper functions that check workspace membership and required roles before allowing operations.

## External Dependencies

### Database
- **PostgreSQL**: Primary database accessed via `DATABASE_URL` environment variable
- **Connection**: pg Pool with Drizzle ORM wrapper

### Authentication
- **Replit OIDC**: OpenID Connect provider at `https://replit.com/oidc`
- **Environment Variables**: `ISSUER_URL`, `REPL_ID`, `SESSION_SECRET`

### Development Tools
- **Vite Dev Server**: HMR enabled with custom middleware mode
- **Replit Plugins**: Runtime error overlay, cartographer, dev banner (development only)

### Key NPM Packages
- `drizzle-orm` / `drizzle-kit`: Database ORM and migrations
- `@tanstack/react-query`: Server state management
- `passport` / `openid-client`: Authentication
- `express-session` / `connect-pg-simple`: Session management
- `zod` / `drizzle-zod`: Runtime validation
- Full shadcn/ui component set (Radix UI primitives)