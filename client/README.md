# T-Testing Client

Frontend React application for the T-Testing school management system.

## Features

- **Professional Login System**: Secure authentication with username and password
- **User Registration**: Simple registration with first name, last name, and username
- **Responsive Design**: Modern UI that works on all devices
- **Component Organization**: Well-structured React components
- **API Integration**: Centralized API service layer

## Quick Start

### Prerequisites

- Node.js (v16 or higher)
- npm or yarn

### Installation

```bash
# Install dependencies
npm install

# Start development server
npm run dev
```

The application will be available at `http://localhost:5173`

## Project Structure

```
client/
├── src/
│   ├── components/           # React components
│   │   ├── LoginPage.jsx     # Login page component
│   │   ├── LoginPage.css     # Login page styles
│   │   ├── RegisterPage.jsx  # Registration page component
│   │   └── RegisterPage.css  # Registration page styles
│   ├── services/
│   │   └── api.js           # API service functions
│   ├── App.jsx              # Main application container
│   ├── App.css              # Global styles and dashboard
│   ├── index.css            # Base styles
│   └── main.jsx             # Application entry point
├── public/                  # Static assets
├── package.json             # Dependencies and scripts
└── vite.config.js          # Vite configuration
```

## Components

### App.jsx

Main application container that:

- Manages page switching between login and registration
- Handles user authentication state
- Provides dashboard placeholder after login

### LoginPage.jsx

Professional login page with:

- Username and password authentication
- Real-time form validation
- Loading states and error handling
- Navigation to registration page

### RegisterPage.jsx

Simple registration form with:

- First name and last name fields
- Username selection
- Password strength validation
- Navigation back to login

## API Integration

The `src/services/api.js` file provides:

- **Authentication API**: Login, register, logout, token verification
- **Testing Management API**: Room status and supply management
- **Utility Functions**: Token management and authentication helpers

## Environment Variables

Create a `.env` file in the client directory:

```
VITE_API_URL=http://localhost:3001/api
```

## Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run preview` - Preview production build
- `npm run lint` - Run ESLint

## Styling

The application uses modern CSS with:

- Gradient backgrounds and glass-morphism effects
- Responsive design with mobile-first approach
- Professional color scheme suitable for educational environments
- Component-specific CSS files for better organization
- Smooth animations and transitions

## Browser Support

- Chrome (latest)
- Firefox (latest)
- Safari (latest)
- Edge (latest)

## Development

### Adding New Components

1. Create component file in `src/components/`
2. Create corresponding CSS file
3. Import and use in App.jsx

### Modifying API Calls

1. Update functions in `src/services/api.js`
2. Ensure proper error handling
3. Test with the backend server

### Styling Changes

1. Edit component-specific CSS files
2. Use global styles in `src/App.css` for shared elements
3. Maintain responsive design principles

## Testing

The application includes:

- Form validation testing
- API integration testing
- Responsive design testing
- Cross-browser compatibility

## Production Build

```bash
# Build the application
npm run build

# Preview the build
npm run preview
```

The build output will be in the `dist/` directory.

## License

MIT License
