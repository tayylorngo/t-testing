# T-Testing Server

Backend API for the T-Testing school management system with MongoDB integration.

## Features

- **User Authentication**: JWT-based login and registration with MongoDB
- **Username-based Login**: Simple username and password authentication
- **Testing Management**: Room status tracking and supply management
- **Database Integration**: MongoDB with Mongoose ODM
- **Security**: Password hashing, input validation, and CORS protection
- **API Documentation**: Comprehensive endpoint documentation

## Prerequisites

- Node.js (v16 or higher)
- MongoDB (local installation or MongoDB Atlas)

## Quick Start

### 1. Install Dependencies

```bash
cd server
npm install
```

### 2. MongoDB Setup

#### Option A: Local MongoDB

1. Install MongoDB Community Edition
2. Start MongoDB service
3. Create database: `t-testing`

#### Option B: MongoDB Atlas (Cloud)

1. Create a free account at [MongoDB Atlas](https://www.mongodb.com/atlas)
2. Create a new cluster
3. Get your connection string

### 3. Environment Setup

```bash
# Copy the example environment file
cp env.example .env

# Edit .env with your configuration
```

**Required environment variables:**

```env
PORT=3001
JWT_SECRET=your-super-secret-jwt-key
MONGODB_URI=mongodb://localhost:27017/t-testing
# OR for MongoDB Atlas:
# MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/t-testing
```

### 4. Start Development Server

```bash
npm run dev
```

The server will start on `http://localhost:3001`

## Database Models

### User Model

```javascript
{
  firstName: String (required, min 2 chars),
  lastName: String (required, min 2 chars),
  username: String (required, unique, min 3, max 30 chars),
  password: String (required, min 8 chars),
  verified: Boolean (default: false),
  createdAt: Date (default: now)
}
```

### Room Model

```javascript
{
  name: String (required),
  status: String (enum: not-started, in-progress, completed),
  supplies: [String],
  createdAt: Date (default: now),
  updatedAt: Date (auto-updated)
}
```

## API Endpoints

### Authentication

#### POST /api/register

Register a new user account.

**Request Body:**

```json
{
  "firstName": "John",
  "lastName": "Doe",
  "username": "johndoe",
  "password": "SecurePass123"
}
```

**Response:**

```json
{
  "message": "User registered successfully",
  "user": {
    "_id": "60f7b3b3b3b3b3b3b3b3b3b3",
    "firstName": "John",
    "lastName": "Doe",
    "username": "johndoe",
    "verified": false,
    "createdAt": "2024-01-01T00:00:00.000Z"
  }
}
```

#### POST /api/login

Authenticate a user and receive a JWT token.

**Request Body:**

```json
{
  "username": "admin",
  "password": "password"
}
```

**Response:**

```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "_id": "60f7b3b3b3b3b3b3b3b3b3b3",
    "firstName": "Admin",
    "lastName": "User",
    "username": "admin",
    "verified": true
  }
}
```

#### GET /api/verify

Verify JWT token validity.

**Headers:**

```
Authorization: Bearer <token>
```

#### POST /api/logout

Logout user (client-side token removal).

**Headers:**

```
Authorization: Bearer <token>
```

### Testing Management

#### GET /api/rooms

Get all testing rooms and their status.

**Headers:**

```
Authorization: Bearer <token>
```

**Response:**

```json
[
  {
    "_id": "60f7b3b3b3b3b3b3b3b3b3b3",
    "name": "Room 101",
    "status": "in-progress",
    "supplies": ["pencils", "paper"],
    "createdAt": "2024-01-01T00:00:00.000Z",
    "updatedAt": "2024-01-01T00:00:00.000Z"
  }
]
```

#### POST /api/rooms

Create a new testing room.

**Headers:**

```
Authorization: Bearer <token>
```

**Request Body:**

```json
{
  "name": "Room 104",
  "status": "not-started",
  "supplies": ["calculators", "rulers"]
}
```

#### PUT /api/rooms/:id/status

Update room status.

**Headers:**

```
Authorization: Bearer <token>
```

**Request Body:**

```json
{
  "status": "completed"
}
```

#### DELETE /api/rooms/:id

Delete a room.

**Headers:**

```
Authorization: Bearer <token>
```

#### GET /api/supplies

Get all supplies needed across rooms.

**Headers:**

```
Authorization: Bearer <token>
```

**Response:**

```json
{
  "supplies": ["pencils", "paper", "calculators"]
}
```

### Health Check

#### GET /api/health

Check server and database status.

**Response:**

```json
{
  "status": "OK",
  "message": "T-Testing API is running",
  "database": "connected"
}
```

## Environment Variables

| Variable      | Description               | Default                               |
| ------------- | ------------------------- | ------------------------------------- |
| `PORT`        | Server port               | `3001`                                |
| `JWT_SECRET`  | JWT signing secret        | `your-secret-key`                     |
| `MONGODB_URI` | MongoDB connection string | `mongodb://localhost:27017/t-testing` |
| `NODE_ENV`    | Environment               | `development`                         |

## Development

### Scripts

- `npm start` - Start production server
- `npm run dev` - Start development server with nodemon
- `npm test` - Run tests (placeholder)

### Project Structure

```
server/
├── server.js          # Main server file with MongoDB integration
├── package.json       # Dependencies and scripts
├── env.example        # Environment variables template
└── README.md          # This file
```

## Database Features

- **Automatic Demo Data**: Creates demo admin user and rooms on first run
- **Data Validation**: Mongoose schema validation
- **Indexing**: Automatic indexing on username field
- **Timestamps**: Automatic createdAt and updatedAt fields
- **Error Handling**: Duplicate key and validation error handling

## Security Features

- **Password Hashing**: bcryptjs for secure password storage
- **JWT Authentication**: Secure token-based authentication
- **Input Validation**: express-validator for request validation
- **CORS Protection**: Cross-origin resource sharing configuration
- **Helmet**: Security headers middleware
- **Morgan**: HTTP request logging

## Demo Credentials

For testing purposes, a demo admin account is automatically created:

- **Username**: `admin`
- **Password**: `password`

## MongoDB Setup Options

### Local Installation

1. Download MongoDB Community Server
2. Install and start MongoDB service
3. Use connection string: `mongodb://localhost:27017/t-testing`

### MongoDB Atlas (Recommended for Production)

1. Create account at MongoDB Atlas
2. Create a new cluster
3. Get connection string from cluster
4. Replace username, password, and cluster details

### Docker (Alternative)

```bash
docker run -d -p 27017:27017 --name mongodb mongo:latest
```

## Production Considerations

1. **MongoDB Atlas**: Use cloud MongoDB for production
2. **Environment Variables**: Use strong, unique JWT secrets
3. **HTTPS**: Enable HTTPS in production
4. **Rate Limiting**: Implement rate limiting for API endpoints
5. **Logging**: Set up proper logging and monitoring
6. **Backup**: Configure MongoDB backups
7. **Indexing**: Add appropriate database indexes
8. **Connection Pooling**: Configure MongoDB connection pooling

## Troubleshooting

### MongoDB Connection Issues

- Check if MongoDB is running
- Verify connection string format
- Ensure network connectivity (for Atlas)
- Check firewall settings

### Common Errors

- `MongoServerSelectionError`: MongoDB not running
- `MongoParseError`: Invalid connection string
- `MongoNetworkError`: Network connectivity issues

## License

MIT License
