# T-Testing

A comprehensive school testing management system for administrators to monitor live testing results, track room completion status, and manage testing supplies.

## Features

- **Professional Login System**: Secure authentication for school administrators
- **User Registration**: Create new accounts with role-based access
- **Real-time Monitoring**: Track testing progress across multiple rooms
- **Supply Management**: Monitor and request testing supplies
- **Responsive Design**: Works seamlessly on desktop and mobile devices

## Pages

### Login Page

The application features a modern, professional login page with:

- Email and password authentication
- Form validation with real-time error feedback
- Loading states and success/error messaging
- Secure token-based authentication
- Link to registration page
- Responsive design for all devices

### Registration Page

New users can create accounts with:

- Comprehensive form validation
- Role selection (Administrator, Testing Coordinator, Test Supervisor)
- School information collection
- Password strength requirements
- Email verification workflow
- Seamless navigation between login and registration

## API Endpoints

The application expects the following API endpoints:

### POST /api/login

Authenticates a user and returns a JWT token.

**Request Body:**

```json
{
  "email": "admin@school.edu",
  "password": "securepassword"
}
```

**Success Response (200):**

```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": 1,
    "email": "admin@school.edu",
    "name": "Administrator Name",
    "role": "admin"
  }
}
```

### POST /api/register

Creates a new user account.

**Request Body:**

```json
{
  "firstName": "John",
  "lastName": "Doe",
  "email": "john.doe@school.edu",
  "password": "SecurePass123",
  "schoolName": "Springfield High School",
  "role": "admin"
}
```

**Success Response (201):**

```json
{
  "message": "User registered successfully",
  "user": {
    "id": 2,
    "email": "john.doe@school.edu",
    "firstName": "John",
    "lastName": "Doe",
    "schoolName": "Springfield High School",
    "role": "admin"
  }
}
```

## Setup Instructions

### 1. Install Dependencies

```bash
npm install
```

### 2. Configure API Endpoint

Set your API base URL in the environment variables:

Create a `.env` file in the root directory:

```
VITE_API_URL=http://localhost:3001/api
```

### 3. Start Development Server

```bash
npm run dev
```

The application will be available at `http://localhost:5173`

## Project Structure

```
src/
├── App.jsx                    # Main application container
├── App.css                    # Global styles and dashboard
├── index.css                  # Base styles
├── main.jsx                   # Application entry point
├── components/
│   ├── LoginPage.jsx          # Login page component
│   ├── LoginPage.css          # Login page styles
│   ├── RegisterPage.jsx       # Registration page component
│   └── RegisterPage.css       # Registration page styles
└── services/
    └── api.js                 # API service functions
```

## Component Organization

### App.jsx

- Main application container
- Handles page switching between login and registration
- Manages user authentication state
- Provides dashboard placeholder

### LoginPage.jsx

- Email and password authentication
- Form validation and error handling
- API integration for login
- Navigation to registration page

### RegisterPage.jsx

- Comprehensive user registration form
- Role selection and school information
- Password strength validation
- Navigation back to login page

### API Service (api.js)

- Centralized API communication
- Authentication endpoints (login, register, logout)
- Testing management endpoints
- Token management utilities

## Form Validation

### Login Form

- Email format validation
- Required field validation
- Minimum password length (6 characters)

### Registration Form

- First and last name validation (minimum 2 characters)
- Email format validation
- Password strength requirements:
  - Minimum 8 characters
  - At least one uppercase letter
  - At least one lowercase letter
  - At least one number
- Password confirmation matching
- School name validation
- Role selection

## Styling

The application uses modern CSS with:

- Gradient backgrounds and glass-morphism effects
- Responsive design with mobile-first approach
- Professional color scheme suitable for educational environments
- Smooth animations and transitions
- Component-specific CSS files for better organization

## Security Features

- JWT token-based authentication
- Secure password validation
- Protected API endpoints
- Local storage for session management
- Form validation on both client and server sides

## Browser Support

- Chrome (latest)
- Firefox (latest)
- Safari (latest)
- Edge (latest)

## Development

To extend the application:

1. **Add New Components**: Create new React components in `src/components/`
2. **Add New API Endpoints**: Update `src/services/api.js`
3. **Modify Styling**: Edit component-specific CSS files
4. **Environment Configuration**: Update `.env` file for different environments

## License

This project is licensed under the MIT License.
