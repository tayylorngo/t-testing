# T-Testing

A comprehensive school testing management system for administrators to monitor live testing results, track room completion status, and manage testing supplies.

## Project Structure

```
t-testing/
├── client/                 # Frontend React application
│   ├── src/
│   │   ├── components/     # React components
│   │   ├── services/       # API services
│   │   └── ...
│   ├── package.json
│   └── README.md
├── server/                 # Backend Node.js/Express API
│   ├── server.js          # Main server file
│   ├── package.json       # Server dependencies
│   ├── env.example        # Environment variables template
│   └── README.md          # Server documentation
└── README.md              # This file
```

## Features

- **Professional Login System**: Secure authentication with username and password
- **User Registration**: Simple registration with first name, last name, and username
- **Real-time Monitoring**: Track testing progress across multiple rooms
- **Supply Management**: Monitor and request testing supplies
- **Responsive Design**: Works seamlessly on desktop and mobile devices
- **Full-stack Application**: Complete client-server architecture

## Quick Start

### Prerequisites

- Node.js (v16 or higher)
- npm or yarn
- MongoDB (local installation or MongoDB Atlas)

### 1. Clone and Setup

```bash
git clone <repository-url>
cd t-testing
```

### 2. Backend Setup

```bash
# Navigate to server directory
cd server

# Install dependencies
npm install

# Copy environment file
cp env.example .env

# Edit .env with your MongoDB connection
# MONGODB_URI=mongodb://localhost:27017/t-testing

# Start development server
npm run dev
```

The backend will start on `http://localhost:3001`

### 3. Frontend Setup

```bash
# Open a new terminal and navigate to client directory
cd client

# Install dependencies
npm install

# Start development server
npm run dev
```

The frontend will start on `http://localhost:5173`

## Demo Credentials

For testing the application, use these demo credentials:

- **Username**: `admin`
- **Password**: `password`

## API Endpoints

### Authentication

- `POST /api/register` - Register new user
- `POST /api/login` - User login
- `GET /api/verify` - Verify JWT token
- `POST /api/logout` - User logout

### Testing Management

- `GET /api/rooms` - Get all testing rooms
- `POST /api/rooms` - Create new room
- `PUT /api/rooms/:id/status` - Update room status
- `DELETE /api/rooms/:id` - Delete room
- `GET /api/supplies` - Get supplies needed

### Health Check

- `GET /api/health` - Server status

## Development

### Frontend (Client)

- **Framework**: React with Vite
- **Styling**: CSS with modern design patterns
- **State Management**: React hooks
- **API Integration**: Fetch API with centralized service layer

### Backend (Server)

- **Framework**: Node.js with Express
- **Database**: MongoDB with Mongoose ODM
- **Authentication**: JWT tokens with bcrypt password hashing
- **Validation**: express-validator for input validation
- **Security**: Helmet, CORS, and security headers

## Environment Variables

### Client (.env)

```
VITE_API_URL=http://localhost:3001/api
```

### Server (.env)

```
PORT=3001
JWT_SECRET=your-super-secret-jwt-key
MONGODB_URI=mongodb://localhost:27017/t-testing
NODE_ENV=development
```

## Scripts

### Client

```bash
cd client
npm run dev      # Start development server
npm run build    # Build for production
npm run preview  # Preview production build
```

### Server

```bash
cd server
npm run dev      # Start development server with nodemon
npm start        # Start production server
```

## Security Features

- **JWT Authentication**: Secure token-based authentication
- **Password Hashing**: bcryptjs for secure password storage
- **Input Validation**: Comprehensive form and API validation
- **CORS Protection**: Cross-origin resource sharing configuration
- **Security Headers**: Helmet middleware for protection
- **Request Logging**: Morgan for HTTP request logging

## Production Deployment

### Frontend

1. Build the application: `npm run build`
2. Deploy the `dist/` folder to your hosting service
3. Configure environment variables for production API URL

### Backend

1. Set up MongoDB Atlas for production database
2. Configure environment variables for production
3. Use a process manager like PM2
4. Set up HTTPS and proper security measures
5. Implement rate limiting and monitoring

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## License

This project is licensed under the MIT License.

## Support

For support and questions:

- Check the individual README files in `client/` and `server/` directories
- Review the API documentation in `server/README.md`
- Contact the development team
