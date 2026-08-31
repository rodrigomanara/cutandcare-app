Prompt: SugarCRM Booking System with FullCalendar Integration

Project Overview

Build a web application that integrates with SugarCRM, featuring user authentication, token management, 
and a calendar-based booking system for managing pet appointments/services across multiple pets per customer. 
The system will use my own framework, I only need the frontend done as webapp that can be used on Apple or Android, it 
needs  run as native app but using vanilla javascript. I only needs to fetch use rest api, so once the user login the 
token will be fetched.




Phase 1: Authentication & Session Management

1.1 Login Page

Create a login form with email/username and password fields
Integrate with SugarCRM's REST API (OAuth 2.0 or API Token authentication)
Establish initial session and store authentication token securely
Display loading state and error messages for failed authentication

1.2 Token Management

Implement JWT/Bearer token storage in browser (preferably HttpOnly cookies if possible, else sessionStorage)
Create a token refresh mechanism that:
Monitors token expiration time
Automatically refreshes token 5 minutes before expiry using SugarCRM's refresh endpoint
Re-authenticates user if refresh fails
Handles token expiration gracefully without disrupting user workflow

1.3 Session Persistence

Maintain session state across page reloads
Redirect unauthenticated users back to login
Implement logout functionality that clears session/token
Phase 2: Calendar Interface

2.1 FullCalendar Setup

Integrate FullCalendar JS library (React/Vue/Vanilla JS)
Display calendar with month, week, and day view options
Load existing bookings from SugarCRM and display as events
Color-code bookings by status (pending, confirmed, completed)

2.2 Booking Creation

Allow users to click on calendar date/time to create new booking
Clicking should trigger a booking modal/form
Phase 3: Booking Form & Account/Pet Data

3.1 Booking Form Modal

Display when user creates or edits a booking
Fields to include:
Account/Customer selection (searchable dropdown)
Service type/booking type
Booking date & time (pre-filled from calendar click)
Notes/special instructions
Pet selection (checkboxes or multi-select)

3.2 Account Module Integration

When user selects an account, fetch:
Account name, phone, email, address
All related contact information
Display as read-only reference in the form

3.3 Pets Module Integration

Query SugarCRM's Pets/Animals module (or custom module if applicable)
Filter pets belonging to selected account
Display all related dogs with:
Pet name
Breed
Age/DOB
Any health notes or allergies
Allow user to select one or multiple pets via checkboxes
Phase 4: Multi-Pet Booking Logic

4.1 Booking Generation

When user selects multiple pets (e.g., 2 dogs) and submits form:
Create individual booking record in SugarCRM for each selected pet
Bookings should share the same time slot, location, and notes
Link each booking to its respective pet record
Each booking gets unique ID but grouped/related in system

4.2 Data Validation

Prevent double-booking same pet at same time
Validate account and pet selection
Ensure date/time is in future
Check for account/pet status (active, inactive, etc.)
Phase 5: Booking Management (CRUD Operations)

5.1 Create

Submit form to create new booking(s) in SugarCRM
Return success/error message
Refresh calendar to show new booking(s)

5.2 Read

Display booking details when clicking on calendar event
Show associated account and pet information
Display booking status and history

5.3 Update/Edit

Click on existing booking to edit
Allow changes to time, date, notes, service type
Prevent editing if booking is locked/completed
Handle multi-pet updates appropriately

5.4 Delete

Confirm deletion before removing booking
Support bulk deletion of related bookings (e.g., if deleting account-level booking)
Archive instead of hard delete if needed for audit trail
Phase 6: Technical Requirements

6.1 API Integration

Use SugarCRM REST API v10+ or v11
Implement proper error handling and retry logic
Log API calls for debugging
Handle rate limiting

6.2 Security

Never expose API keys or tokens in client-side code
Implement CORS properly (use backend proxy if needed)
Validate all user inputs server-side
Implement role-based access control (check user permissions)

6.3 State Management

Use state management library (Redux, Vuex, Context API, or Pinia)
Manage auth state, calendar events, selected account/pets, form state

6.4 UI/UX

Responsive design (mobile-friendly)
Loading spinners for API calls
Toast notifications for success/error messages
Confirmation modals for destructive actions
Phase 7: Optional Enhancements
Recurring booking support
Booking reminders/notifications
Export bookings to CSV/ICS
Custom fields per booking type
Availability/scheduling restrictions
Integration with SugarCRM's email module for confirmations
Audit trail/activity log
Deliverables
Fully functional login page with token management
Calendar interface with CRUD operations
Booking form with account/pet data population
Multi-pet booking generation logic
API integration layer with error handling
Documentation on setup and deployment






