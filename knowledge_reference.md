# GoTSUian AI Knowledge Reference

## Project Overview
GoTSUian is a campus ride-hailing web application designed for TSU San Isidro students. The product should eventually support safe, reliable, and user-friendly transportation for passengers and drivers.

This document is intended as a shared knowledge reference for LLMs, AI agents, and AI models working on the project.

---

## Product Vision
The app should feel like a real ride-hailing platform, not just a static website.

### Core goals
- Help passengers request rides quickly and easily.
- Help drivers accept, manage, and complete rides.
- Provide a smooth, mobile-friendly experience.
- Build trust through transparent status updates and clear communication.
- Make the app reliable enough for real-world use.

---

## AI Agent Operating Guide
This file is meant to be read by AI models, AI agents, and future contributors as a compact instruction set.

### How to use this file
- Treat this as the product blueprint for GoTSUian.
- Prioritize the highest-value user journey first: request ride → driver accepts → trip status updates.
- Keep the implementation simple, polished, and user-focused.
- Prefer reliability and clarity over flashy but unstable features.

### AI handoff protocol
This file should work as a self-contained handoff document for any future agent.

#### Entry conditions
Before starting work, the agent should:
1. read this file completely or at least the latest relevant sections
2. identify the current highest-priority task
3. inspect the current app state and relevant files
4. update this document with the latest status before making changes

#### Execution rules
During the task, the agent should:
- work on the smallest useful improvement first
- keep the core ride flow intact
- avoid unrelated scope creep
- document any new risk, blocker, or issue immediately
- verify the result before closing the task

#### Exit conditions
When the task is finished, the agent should:
1. confirm the feature or fix works in the app
2. update this markdown file with the outcome
3. record the next recommended action
4. leave the project in a state that another agent can continue from easily

### Working rules for implementation
- Build features in small, testable increments.
- Always keep the user journey clear.
- Make status transitions explicit.
- Favor mobile-friendly and accessible design.
- Avoid introducing features that break the core flow.

### Mandatory documentation rule for AI agents
Whenever an AI agent changes the codebase, it must also update this markdown file.

The update must include:
- what changed
- what was completed
- what remains pending
- any new pain points or risks
- the current status of the relevant task

If a change affects the app workflow, UI, backend, or reliability, the agent must reflect that in this file before considering the task complete.

### Expected update behavior
After each meaningful change, the agent should:
1. update the task/status board
2. move completed items to Done
3. add new pending items if needed
4. update the current pain points section if new issues appear
5. keep the file concise, structured, and easy for future agents to follow

### Startup protocol for any new agent
When an agent reads this file, it should immediately:
1. understand the product goal
2. identify the highest-priority unfinished task
3. inspect the current codebase state
4. update this markdown file with current progress before making changes
5. implement the smallest useful improvement first
6. verify the result and then update the status board again

### Continuation protocol
If work is already in progress, the agent should:
- read this file first
- look for the latest task status
- continue from the most relevant unfinished item
- avoid restarting work that is already partially complete
- update the markdown file after every meaningful step

### Decision rules for agents
- If the feature is core to the ride flow, prioritize it.
- If the change improves reliability, prioritize it.
- If the change improves usability without breaking the core flow, prioritize it.
- If a feature is too large, break it into smaller tasks and document them.
- If a bug appears, fix the root cause first, then document it.

### Next best action rule
At the start of each session, the agent should choose the single highest-value next action that moves the product forward.

The default order is:
1. fix a broken or blocking issue
2. improve the core ride flow
3. improve reliability and persistence
4. improve UI/UX and usability
5. add supporting features such as payments, safety, or admin tools

### Do not do list
- Do not build large unrelated features before the core flow works.
- Do not ignore documentation updates.
- Do not introduce unstable or overly complex solutions when a simpler one works.
- Do not leave the UI in a confusing or broken state.
- Do not skip testing or verification.

### Agent summary template
After finishing a task, the agent should briefly record:
- Summary: what changed
- Status: completed, pending, or blocked
- Files touched: list of files modified
- Next step: what should happen next

---

## Current State Snapshot
This section should always reflect the latest known state of the project.

### Implemented so far
- session-based login and logout flow
- passenger ride request form
- ride request status display
- basic ride cancellation for passengers
- basic dashboard structure for passenger, driver, and admin

### Partially implemented
- driver-side request handling
- trip lifecycle transitions
- UI feedback and success/error handling

### Recently improved
- ride lifecycle now supports richer status transitions for drivers and passengers
- passenger status panel now shows active ride progress and avoids showing completed rides as active
- driver queue now supports accept, decline, and status progression actions

### Not yet implemented
- real backend authentication
- persistent database-backed ride storage
- multi-step trip lifecycle with real-time updates
- payments and fare calculation
- strong admin and safety tools

---

## Definition of Done
A task is only considered done when all of the following are true:
- the feature works in the app
- the UI behaves as expected
- the core logic is verified
- the markdown file is updated
- the next step is clearly documented

---

## Known Issues and Bug Log
Track issues here as they are discovered.

### Current known areas to watch
- auth is still not fully backend-secured
- ride state can become inconsistent without stronger validation
- UI feedback is still limited in some flows
- some features still rely on browser storage instead of a real database

### Bug log format
- Date:
- Issue:
- Impact:
- Fix status:
- Notes:

---

## Preferred Stack Decision
For this project, the preferred direction is:
- frontend: simple, mobile-friendly web app first
- backend: Node.js with Express or NestJS later
- database: PostgreSQL or MySQL
- auth: secure session/token-based flow
- realtime: WebSockets or polling as a stepping stone

Use this decision as the default unless a different choice is explicitly documented.

---

## Testing Checklist
Every meaningful change should be verified before it is considered complete.

### Minimum verification checklist
- [ ] UI behavior works as expected
- [ ] the relevant form or action completes successfully
- [ ] the status or state updates correctly
- [ ] the app does not break the core user flow
- [ ] the markdown file is updated

### Suggested manual verification
- test the main user path end-to-end
- confirm success and error states
- confirm the page remains usable on mobile view
- confirm authentication and logout work correctly

---

## Task and Status Board
Use this structure for todos, pending work, and completed work.

### Status labels
- Todo
- In Progress
- Blocked
- Pending Review
- Done

### Recommended backlog format
- [ ] Todo: short task description
- [ ] In Progress: short task description
- [ ] Blocked: short task description
- [x] Done: short task description

### Suggested current backlog
- [ ] Implement secure authentication with backend support
- [ ] Build full ride request lifecycle
- [ ] Add driver acceptance and decline flow
- [ ] Add trip progress states: Accepted, Picked Up, In Progress, Completed
- [ ] Improve mobile UI and responsiveness
- [ ] Add clear loading, success, and error states
- [ ] Add ride history and trip details
- [ ] Add admin monitoring tools
- [ ] Add safety and reporting features
- [ ] Add payment and fare calculation flow

---

## Current Pain Points
These are the main problems the project is still facing and should be addressed next.

### Current pain points
- Authentication is still too frontend-dependent and should be moved to a more secure backend-supported flow.
- The app currently behaves more like a static demo than a real ride-hailing service.
- Ride status is basic and should be expanded into a real lifecycle.
- The user experience needs better feedback for loading, success, and errors.
- The app needs stronger backend reliability, validation, and data persistence.
- The design should feel more polished and more mobile-friendly.
- There is still no strong real-time or live-tracking experience.
- Admin tools and safety features are still incomplete.

### Priority focus areas
1. Secure authentication
2. End-to-end ride request flow
3. Driver acceptance and trip status updates
4. Cleaner UI and better feedback
5. Backend reliability and persistence

---

## Recent Changes Log
Keep this section updated after every meaningful change.

### Latest update
- Date: 2026-07-04
- Summary: added stronger AI handoff protocol, current state snapshot, done criteria, testing checklist, backlog structure, and richer ride lifecycle updates
- Status: documentation updated
- Next action: continue implementing the core backend and real-time ride syncing

### Log format
- Date:
- Summary:
- Status:
- Files touched:
- Next action:

---

## File Ownership Map
Use this section to understand which files are central to each area.

### Core files
- app.js - shared app logic, auth state, ride flow, UI rendering
- passenger.html - passenger dashboard and ride request experience
- driver.html - driver dashboard and request handling
- admin.html - admin-facing views and management tools
- index.html - entry page and app navigation
- auth.html - authentication experience

### Documentation files
- AI_KNOWLEDGE_REFERENCE.md - single source of truth for product and agent guidance

---

## Agent Update Template
Every agent should use this format when updating the project or the reference file.

### Update format
- Summary:
- Status:
- Files touched:
- Verification:
- Next action:

### Example
- Summary: added passenger ride request form and status panel
- Status: completed
- Files touched: passenger.html, app.js
- Verification: verified ride request appears and persists locally
- Next action: implement driver acceptance flow

---

## Local Development Notes
Use this section to keep setup instructions simple and consistent.

### How to run locally
- start a local server from the project root
- open the app in a browser
- verify the main user paths manually

### Common local commands
- python -m http.server 8000
- open the app in the browser at http://127.0.0.1:8000

### Environment notes
- this project is currently lightweight and browser-based
- local storage and session storage are used for demo-state persistence
- a real backend and database are still planned for production

---

## Decision History
Track significant product and architecture decisions here.

### Current decisions
- keep the frontend simple and mobile-friendly first
- use browser storage temporarily for prototype state
- prioritize the core ride-request flow before expanding into payments or advanced features
- keep this markdown file as the main agent operating guide

### Decision log format
- Date:
- Decision:
- Reason:
- Impact:
- Status:

---

## Common Issues and Troubleshooting
Use this section to capture quick fixes and recurring problems.

### Common problem areas
- login state not persisting correctly
- ride request not appearing after submission
- driver queue not refreshing after updates
- empty states not showing clearly
- auth redirect failing after logout

### Troubleshooting checklist
- confirm the relevant browser storage values
- check the console for JavaScript errors
- verify the expected DOM elements exist on the active page
- confirm the correct user role is loaded
- review the latest changes in the app logic

---

## Current Blockers
Record the main blockers that are preventing progress.

### Current blockers
- no real backend yet for secure authentication
- rides are still not stored in a production-grade persistent system
- real-time updates are not implemented yet
- trip lifecycle is still limited

### Blocker format
- Blocker:
- Impact:
- Suggested next step:
- Owner:

---

## Success Metrics
These are the signs that the project is moving in the right direction.

### Product success indicators
- passengers can request rides without confusion
- drivers can view and act on requests clearly
- ride status changes are easy to understand
- authentication feels reliable and secure
- the app feels usable on mobile devices

### Engineering success indicators
- core flows are tested and verified
- documentation stays current
- future agents can continue work without repeated re-explanation

---

## Runbook for Common Setup Issues
Use this section for quick recovery steps when the app behaves unexpectedly.

### If the app does not load
- confirm the local server is running
- verify the correct project folder is being served
- check the browser console for file loading errors

### If login or logout behaves incorrectly
- clear browser storage for the app domain
- confirm the auth state is being set or cleared correctly
- verify the correct page is being redirected after auth changes

### If ride requests are not showing
- confirm the request was saved to the expected storage key
- verify the dashboard is reading the stored data correctly
- inspect the browser console for rendering errors

---

## Release Checklist
Use this list before considering the project ready for a broader demo or release.

### Release readiness checklist
- [ ] core authentication works reliably
- [ ] ride requests can be created and tracked
- [ ] driver actions are visible and consistent
- [ ] major UI states are understandable
- [ ] documentation is updated and current
- [ ] key flows have been manually verified

---

## Environment Dependencies
Track the external requirements needed for setup and future expansion.

### Current environment notes
- local browser-based prototype
- no production backend configured yet
- no database service configured yet
- future deployment may require Node.js, a backend service, and a database

### Future dependency planning
- backend runtime: Node.js
- database: PostgreSQL or MySQL
- authentication: secure session or token-based flow
- deployment target: cloud hosting or a simple managed service

---

## Primary User Roles

### 1. Passenger
A passenger should be able to:
- sign up and log in securely
- request a ride
- choose pickup and drop-off locations
- see ride status
- cancel a ride if needed
- view ride history
- rate a trip after completion

### 2. Driver
A driver should be able to:
- sign up and log in securely
- see available ride requests
- accept or decline ride requests
- update ride status
- complete rides
- view earnings or performance summary
- manage availability

### 3. Admin
An admin should be able to:
- monitor users and rides
- review reports
- manage driver approvals
- monitor fraud or misuse
- view app analytics

---

## Core Features to Build

### Authentication and Account Management
- Secure registration and login
- Password validation
- Role-based access control
- Session or token-based authentication
- Forgot password flow
- Profile editing

### Ride Request Flow
- Passenger submits pickup and drop-off locations
- Ride request is created with status: Pending
- Driver sees pending requests
- Driver accepts or declines request
- Passenger sees live ride status

### Trip Lifecycle
Support these statuses:
- Pending
- Accepted
- Picked Up
- In Progress
- Completed
- Cancelled
- Failed

### Live Ride Tracking
- Show ride progress clearly
- Display ETA and trip status
- Update status in real time

### Dashboard Experience
Passenger dashboard should include:
- upcoming ride
- ride request form
- current ride status
- ride history
- saved locations

Driver dashboard should include:
- incoming ride requests
- accepted rides
- trip status updates
- availability control

Admin dashboard should include:
- user management
- ride oversight
- reports
- support tools

---

## User Experience Requirements
The product should be:
- fast
- simple
- intuitive
- mobile-first
- visually clear
- accessible
- consistent across pages

### UX priorities
- Clear buttons and labels
- Minimal clutter
- Fast response after actions
- Helpful error messages
- Smooth success feedback
- Good empty states and loading states

### Accessibility expectations
- Keyboard-friendly navigation
- Good contrast
- Descriptive labels
- Screen-reader compatible form fields
- Mobile-friendly interactions

---

## Interface Design Principles
- Keep things simple and focused on the ride flow.
- Avoid overloading the user with too many options.
- Use strong visual hierarchy.
- Highlight important actions like Request Ride and Accept Ride.
- Make status colors meaningful and consistent.

### Recommended UI patterns
- cards for trip summaries
- clear status badges
- modal dialogs for confirmations or errors
- toast notifications for success/error feedback
- progress indicators for trip states

---

## Backend Requirements
The app should eventually move beyond static local storage and use a real backend.

### Recommended backend responsibilities
- authenticate users
- store users safely
- manage ride requests
- manage trip lifecycle
- track driver availability
- support real-time updates
- store ride history
- support payments and notifications later

### Suggested backend stack
- Node.js with Express or NestJS
- PostgreSQL or MySQL
- Prisma or Sequelize
- JWT or session-based authentication
- WebSockets for live updates

### Important backend principles
- Never trust client-side data alone.
- Validate all inputs on the server.
- Use proper authorization for every role.
- Secure sensitive data.
- Log important events and errors.

---

## Data Model Ideas
The system should eventually support these main entities:

### User
- id
- name
- email
- password hash
- role
- phone number
- profile image
- created at

### Driver
- id
- userId
- vehicle type
- plate number
- availability
- rating
- verified status

### RideRequest
- id
- passengerId
- pickupLocation
- dropoffLocation
- status
- createdAt
- updatedAt

### Trip
- id
- requestId
- driverId
- passengerId
- startTime
- endTime
- fare
- status

### Rating
- id
- tripId
- riderId
- driverId
- score
- comment

### Report
- id
- reporterId
- targetUserId
- reason
- createdAt

---

## Reliability and Quality Expectations
A good ride-hailing app must be dependable.

### Reliability checklist
- Prevent duplicate ride requests
- Handle failed requests gracefully
- Ensure status updates are consistent
- Handle cancellations without breaking the flow
- Avoid stale UI states
- Protect against invalid input

### Error handling expectations
- Show clear user-facing error messages
- Log backend errors
- Avoid silent failures
- Gracefully handle network issues

### Security expectations
- Hash passwords
- Protect API endpoints
- Use HTTPS in production
- Prevent IDOR and authorization issues
- Protect user data and ride history

---

## Recommended Development Roadmap

### Phase 1: Core MVP
- secure auth
- passenger registration/login
- driver registration/login
- ride request creation
- ride status display
- basic driver acceptance flow

### Phase 2: Better Product Experience
- trip lifecycle updates
- ride history
- notifications
- better mobile UI
- stronger validation and feedback

### Phase 3: Trust and Safety
- driver verification
- reporting system
- emergency support feature
- trip tracking and ETA updates

### Phase 4: Commercial-Ready Features
- payments
- fare calculation
- receipts
- analytics
- admin tools
- real-time driver tracking

---

## Suggested Priorities for This Project
If the team wants to make this app genuinely strong, the highest-priority features are:
1. secure authentication
2. complete ride request and driver acceptance flow
3. real trip status tracking
4. clean and mobile-friendly UI
5. reliable backend data handling
6. admin monitoring and reporting

---

## Important Engineering Advice
Do not try to build everything at once.

The best strategy is:
- start with one complete user journey
- make it polished
- then expand to more features

The most important user journey is:
- passenger requests ride
- driver accepts ride
- ride status is updated clearly
- trip completes safely

---

## Final Product Standard
The final app should feel like:
- trustworthy
- simple to use
- fast and responsive
- safe for both riders and drivers
- polished enough to impress stakeholders and evaluators

A great ride-hailing app is not defined by flashy design alone. It is defined by reliability, clarity, trust, and smooth user flow.
