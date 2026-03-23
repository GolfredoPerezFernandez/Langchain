# Legalchain to Qwik Migration

## Source project summary

`legalchain` is split into two independent apps:

- `front/`: React 18 + Vite + MUI + Zustand + Formik + React Router.
- `back/`: Express + Parse Server + Parse Dashboard + Moralis auth/proxy + Cloud Functions.

The current app is not a simple UI port. Its business logic is distributed across:

- React contexts in `front/src/context/*`
- Global Zustand state in `front/src/stores/*`
- Parse Cloud Functions in `back/cloud/legalChain/*`
- Parse schema and auth adapters in `back/src/*`

## Main frontend areas to migrate

Current route map from `legalchain/front/src/routes/routes.tsx`:

- `/`
- `/signIn`
- `/signUp`
- `/controlPanel`
- `/payments`
- `/ProcessStripe`
- `/templates`
- `/templates/:name`
- `/buy-token`
- `/record`
- `/preview`
- `/history`
- `/profile-nft/:hash/`

Main feature groups:

- Authentication and PIN verification
- User registration
- Template CRUD
- Video recording / preview / history
- NFT or asset profile view
- Token purchase and Stripe payment flows
- Admin-like control panel

## Main backend areas to migrate

Current `legalchain/back` responsibilities:

- Parse Server bootstrap
- Parse Dashboard
- Moralis auth endpoints under `/api/auth`
- Moralis API proxy endpoints
- Parse Cloud Functions for:
  - user creation and lookup
  - template CRUD
  - video collection CRUD
  - payment and Stripe helpers

## Migration target inside `langchain-qwik`

Target stack already present in `langchain-qwik`:

- Qwik City for pages and SSR
- `routeLoader$` for page data loading
- `server$` for server-side mutations
- `src/routes/api/*` for HTTP endpoints and webhooks
- `src/lib/*` for domain services and data access

## Recommended architecture rewrite

### Frontend

Replace this:

- React Router
- MUI component tree
- Context-heavy state orchestration
- Client-only service calls

With this:

- file-based routes in `src/routes/legalchain/*`
- Qwik components and islands
- route-level data loading via `routeLoader$`
- server mutations via `server$`
- local domain services in `src/lib/legalchain/*`

### Backend

Replace this:

- Parse Cloud Functions as primary application layer
- Parse auth/session assumptions in the UI
- ad hoc Moralis calls from the browser

With this:

- domain services in `src/lib/legalchain/*`
- authenticated route handlers in `src/routes/api/legalchain/*`
- session/cookie flow managed in Qwik City
- server-side integrations for Moralis, Stripe, and any Web3 provider

## Suggested migration order

1. Auth
2. User session model
3. Templates
4. Record / preview / history flows
5. Payments
6. Web3 and token purchase flows
7. Admin/control panel

## Why this order

- Auth and session state are blocking dependencies for most private routes.
- Templates and recordings are the core product flows.
- Payments and Web3 are higher-risk integrations and should be ported after the basic application shell is stable.

## Immediate implementation plan

Phase 1:

- Create `src/routes/legalchain/*` shell routes
- Define domain types in `src/lib/legalchain/types.ts`
- Create service contracts in `src/lib/legalchain/server.ts`
- Replace old React route map with Qwik route map

Phase 2:

- Port sign-in and sign-up to Qwik forms
- Port template list/create/update/delete
- Port private dashboard shell

Phase 3:

- Port recording and history
- Port payments and Stripe callbacks
- Port Web3 integrations

Phase 4:

- Remove remaining Parse/Moralis frontend coupling
- Decide whether Parse remains as a persistence layer or is replaced entirely

## Key migration risks

- The current app mixes auth, wallet state, payments, and UI state in the browser.
- Parse Cloud Functions are acting as business services, so moving to Qwik requires explicit server modules.
- Stripe and Web3 flows should not be copied 1:1 from the browser; they need server-first boundaries.

## Practical conclusion

The correct move is a controlled rewrite inside `langchain-qwik`, not a direct JSX conversion.
