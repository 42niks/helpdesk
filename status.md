1. Apartment Helpdesk MVP milestones 1-5 are implemented end-to-end.
2. Authentication uses username/password with bcrypt hash verification.
3. Sessions are stored server-side with token hashing and sliding expiry.
4. Session cookie is HttpOnly, SameSite=Lax, path-scoped, secure in production.
5. CSRF token validation is enforced for authenticated POST mutations.
6. Login routes users by role to resident, admin, or staff homes.
7. Logout revokes the active session and clears the cookie.
8. Resident home shows apartment profile and active ticket count.
9. Resident ticket list is rendered server-side with status and assignee summary.
10. Resident can open tickets through /tickets/new and POST /tickets.
11. Ticket create validates issue type, title length, and description length.
12. Ticket create enforces active-ticket cap (max 5) per resident flat.
13. Ticket numbers are deterministic using apartment code plus padded ID.
14. Ticket create writes immutable created event in ticket_events.
15. Shared ticket detail route /tickets/:id is role-aware and access-controlled.
16. Unauthorized ticket detail access returns 404 to prevent enumeration.
17. Ticket detail includes apartment, resident, issue, status, and timeline.
18. Assigned staff details are shown when available on ticket detail.
19. Commenting is available across roles with visibility restrictions.
20. Comment input is validated to 1-2000 characters after trim.
21. Comments are blocked with conflict response once ticket is completed.
22. Admin home shows apartment queue with practical status counts.
23. Admin queue lists apartment tickets with resident and assignment context.
24. Admin can assign/reassign staff via POST /tickets/:id/assign.
25. Assignment requires active staff-apartment link in same apartment.
26. Assignment enforces staff type matching ticket issue type.
27. Assignment writes assigned/reassigned audit events.
28. Admin can complete tickets for cancel/duplicate handling.
29. Admin completion requires a cancellation reason.
30. Admin completion writes admin audit event and admin comment trail.
31. Staff home lists only tickets currently assigned to that staff user.
32. Staff can move status assigned -> in_progress.
33. Staff can move status in_progress -> completed.
34. Invalid staff transitions return conflict response and no mutation.
35. Resident review submission is supported on completed assigned tickets.
36. Review supports empty, rating-only, and rating+text combinations.
37. Review text without rating is rejected with validation error.
38. Duplicate review submission per ticket is blocked with conflict.
39. Resident staff ratings page is apartment-scoped.
40. Resident ratings page shows linked staff summaries and text reviews.
41. Admin staff page supports apartment scope with review text visibility.
42. Admin staff page supports platform scope with count/average only.
43. Database migration 0003 adds tickets, ticket_events, ticket_comments.
44. Database migration 0004 adds staff_apartment_links and ticket_reviews.
45. Schema version now reports as 4 through /_db/ health endpoint.
46. Local seed and e2e setup include staff-apartment links for workflows.
47. Unit tests cover security token behavior and input validation rules.
48. Integration tests cover role auth, workflows, transitions, reviews, ratings.
49. E2E tests cover login, resident flow, and full cross-role lifecycle flow.
50. Cloudflare deploy completed successfully with remote D1 migrations applied.
