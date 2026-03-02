# Apartment Helpdesk - Product Requirements Document (PRD)

## 1. Purpose
This PRD defines the MVP product requirements for Apartment Helpdesk: a lightweight ticketing system for apartment maintenance workflows.

The intent is to provide a clear, practical baseline for implementation and prioritization without over-specifying future features.

## 2. Product Vision
Build a simple, reliable system where:
- Residents can raise and track maintenance issues
- Apartment admins can manage apartment-level operations
- Shared staff can execute assigned work across apartments

Guiding principle:
- Mobile first, desktop interface being treated like a bigger mobile screen.
- Core user flows must work without JavaScript.

## 3. Problem Statement
Currently, apartments use a notebook at the security where residents note down their support requests on plumbing and electical works. Staff checks the notebook periodically and addresses the open requests. The apartment admin reads the notebook to see whether there are open issues and reminds staff to address if they haven't done so. We want to build a digital solution for the same.

The MVP should replace informal tracking with a minimal structured workflow.

## 4. Goals and Non-Goals

### 4.1 Goals (MVP)
- Provide end-to-end ticket lifecycle tracking
- Enforce strict role-based access control
- Keep UX mobile-first and fast on low-end devices
- Keep operational complexity and hosting cost low

### 4.2 Non-Goals (MVP)
- Payments and billing
- Attachments and media uploads
- Real-time chat or presence
- Notifications infrastructure
- Public signup or self-serve onboarding

## 5. Users and Roles

### 5.1 Resident
- Create tickets
- View own tickets and status history
- Add comments on own tickets
- Review completed tickets (one review per ticket)

### 5.2 Apartment Admin
- View all tickets in own apartment
- Assign staff to tickets
- Monitor apartment ticket metrics
- View apartment-scoped staff reviews and ratings
- View overall staff rating summary for hiring decisions

### 5.3 Staff
- View tickets assigned to them (across linked apartments)
- Update status on assigned tickets
- Add comments on assigned tickets

### 5.4 Platform Operator
- Performs provisioning directly via database
- No operator UI required in MVP

## 6. Core User Journeys

### 6.1 Resident Journey
1. Login
2. Submit ticket with issue details
3. Track assignment and progress
4. Add comments if needed
5. Submit review after completion

### 6.2 Admin Journey
1. Login
2. View apartment ticket queue
3. Assign eligible staff
4. Monitor progress and completion
5. Review apartment metrics and staff performance

### 6.3 Staff Journey
1. Login
2. View assigned work queue
3. Update ticket status as work progresses
4. Add clarifying comments

## 7. Functional Requirements

### 7.1 Authentication
- Username/password login
- Session-based auth
- No public signup
- Session expiry redirects to login safely

### 7.2 Ticket Lifecycle
- Allowed statuses: Open, Assigned, In Progress, Completed
- Only admins can assign staff
- Only assigned staff can move status forward
- Ticket history is append-only and auditable

### 7.3 Comments and Reviews
- Comments are append-only
- One review per completed ticket
- Only ticket owner can review

### 7.4 Access and Visibility
- Residents see only their own tickets
- Admins see only tickets in their apartment
- Staff see only tickets assigned to them
- Staff reviews visible only within apartments where staff is currently linked

### 7.5 Abuse Controls
- Limit active open tickets per resident
- Minimum content quality checks for ticket descriptions
- Optional cooldown between submissions
- Ability to deactivate abusive users

## 8. UX and Experience Requirements
- Mobile-first layout with 320px support
- No horizontal scrolling for core pages
- Forms optimized for quick input
- No dependency on JavaScript for core flows
- Desktop remains a centered mobile-style layout

## 9. Non-Functional Requirements
- Fast load on slow networks
- Minimal frontend payload and request count
- Clear error handling with actionable messages
- No exposed stack traces
- Low-cost deployment model with simple operations

## 10. Success Metrics (MVP)
- Ticket creation to assignment time
- Ticket completion time
- Percentage of tickets completed
- Review submission rate on completed tickets
- Role authorization errors discovered in testing (target: zero)

## 11. Scope Boundaries

### 11.1 In Scope
- Authentication and sessions
- Role-based ticket workflow
- Assignment, comments, reviews
- Apartment admin metrics (basic)

### 11.2 Out of Scope
- Payments, chat, attachments, escalations, background jobs, real-time updates

## 12. Assumptions and Risks

### 12.1 Assumptions
- Manual provisioning is acceptable for MVP
- Early traffic volume is manageable without asynchronous processing
- Users accept basic UI if reliability is strong

### 12.2 Key Risks
- Incorrect authorization boundaries in shared staff model
- Ambiguity in metric definitions if not standardized
- Data quality drift from manual provisioning operations

## 13. MVP Acceptance Criteria
- All three role workflows are complete and usable end-to-end
- Server-side authorization blocks cross-scope access attempts
- Core flows work without JavaScript enabled
- Ticket history, comments, status changes, and reviews are auditable
- Deployment and migration process is repeatable

## 14. Future Directions (Post-MVP)
- Notifications
- File attachments
- Escalation and SLA policies
- Richer analytics and reporting exports
