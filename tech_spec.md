# Apartment Helpdesk - Technical Specification (MVP)

## 1. Scope and Intent
This technical specification defines how the MVP should be built and validated at a system level.

It is intentionally implementation-oriented, but avoids code-level detail.

## 2. System Overview
Apartment Helpdesk is a server-rendered web application with role-based access control and a single relational database.

Primary design constraints:
- Mobile-first experience
- Low runtime/resource overhead
- No JavaScript dependency for core tasks
- Operational simplicity

## 3. Architecture

### 3.1 High-Level Components
- HTTP application layer (routing, rendering, handlers)
- Authentication/session layer
- Authorization policy layer
- Domain/service layer (ticket and workflow rules)
- Persistence layer (SQL with parameterized queries)

### 3.2 Rendering Model
- Server-rendered HTML pages for all core journeys
- Progressive enhancement optional, never required for primary actions

### 3.3 Deployment Model
- Single deployable service
- Single database
- No background worker requirements in MVP

## 4. Roles and Authorization Model

### 4.1 Roles
- Resident
- Admin
- Staff
- Platform operator (outside app UI)

### 4.2 Authorization Rules
- Authorization enforced on every protected route
- Apartment scoping enforced for all apartment-bound data access
- Staff operations limited to explicitly assigned tickets
- Assignment only allowed to staff with active apartment linkage

### 4.3 Security Boundary Behavior
- Unauthenticated request: redirect to login or return 401 as appropriate
- Unauthorized request: return 403
- Resource not accessible in scope: return 404 or 403 based on policy consistency

## 5. Domain Model

### 5.1 Core Entities
- `apartments`
- `users`
- `memberships` (user-apartment-role mapping)
- `tickets`
- `ticket_status_events`
- `ticket_comments`
- `ticket_reviews`
- `sessions`

### 5.2 Key Invariants
- Ticket belongs to one apartment and one resident owner
- Staff can be linked to multiple apartments
- Ticket review count per ticket <= 1
- Ticket timeline is append-only

### 5.3 Data Integrity Controls
- Foreign keys required
- Unique constraints for one-review-per-ticket and membership uniqueness
- Status/state validation must be transactional

## 6. Workflow and State Model

### 6.1 Status Set
- Open
- Assigned
- In Progress
- Completed

### 6.2 Transition Constraints
- `Open -> Assigned` by admin
- `Assigned -> In Progress` by assigned staff
- `In Progress -> Completed` by assigned staff
- Reopen policy is out of default MVP unless explicitly added

### 6.3 Write Model
- Mutations create append-only events for history
- Existing historical events are immutable
- Comment and review writes must be tied to actor identity and timestamp

## 7. Interfaces and Routes

### 7.1 Route Categories
- Auth routes: login/logout
- Resident routes: ticket create/list/detail, comment, review
- Admin routes: apartment queue, ticket assignment, metrics
- Staff routes: assigned queue, status updates, comments
- Internal routes: health/readiness checks

### 7.2 Request/Response Expectations
- Form-based submissions for core actions
- Server-side validation errors returned with preserved user input
- Predictable HTTP status codes for auth/validation failures

## 8. Security Specification

### 8.1 Authentication Security
- Password hashing via bcrypt (or equivalent secure KDF)
- Session cookies are HTTP-only and secure in production
- Session invalidation on logout/expiry

### 8.2 Request Security
- CSRF protection for mutating endpoints
- Input sanitization and output escaping
- Strict parameterized SQL usage

### 8.3 Defensive Checks
- Reject stale or conflicting state transitions
- Block assignment to non-linked staff
- Prevent duplicate review submissions at both app and DB levels

## 9. Non-Functional Constraints

### 9.1 Performance
- Low payload size and minimal dependencies
- Fast page loads on slow network conditions
- Minimal backend query complexity for common workflows

### 9.2 Reliability
- Graceful failure pages with actionable messages
- No stack trace leakage in user responses
- Safe handling for expired sessions and invalid form retries

### 9.3 Compatibility
- 320px mobile support baseline
- No horizontal overflow on core pages
- Full core workflow operation without JavaScript

### 9.4 Cost and Operations
- Single DB, no managed queue dependency
- No paid external APIs required for MVP
- Acceptable to prioritize low cost over high availability

## 10. Observability and Operations

### 10.1 Logging
- Structured logs for auth failures, authorization denials, and state mutations
- Correlation fields for request and actor context

### 10.2 Health and Readiness
- Lightweight health endpoint
- DB connectivity/readiness endpoint

### 10.3 Manual Operations
- Operator-run user and membership provisioning in DB
- Controlled manual deactivation/reactivation process

## 11. Testing Strategy

### 11.1 Functional Tests
- Role-based access tests for each route group
- Ticket lifecycle transition tests
- Comment and review eligibility tests
- Assignment eligibility tests

### 11.2 Security Tests
- CSRF protection checks
- Session boundary and expiry checks
- URL tampering and cross-apartment access attempts

### 11.3 Non-Functional Checks
- Core page load smoke checks
- Mobile viewport checks
- No-JS flow verification for primary journeys

## 12. Delivery and Change Control

### 12.1 Environment Strategy
- Local development environment with schema migration support
- Production deployment with environment-configured secrets

### 12.2 Migration Strategy
- Versioned, forward-only schema migrations
- Safe rollout and rollback guidance documented per release

### 12.3 Release Readiness Gate
- Core workflows pass in staging/local verification
- No critical auth/integrity defects open
- Migration + health checks successful post-deploy

## 13. Open Technical Questions
- Should completed tickets be reopenable, and under what role constraints?
- How should historical apartment membership changes affect old metric rollups?
- What is the minimal audit log retention policy for MVP vs post-MVP?
