// MongoDB initialization script
db = db.getSiblingDB('t-testing');

// Create collections with proper indexes
db.createCollection('users');
db.createCollection('sessions');
db.createCollection('rooms');
db.createCollection('sections');
db.createCollection('activitylogs');

// Create indexes for better performance
db.users.createIndex({ "email": 1 }, { unique: true });
db.users.createIndex({ "username": 1 }, { unique: true });

db.sessions.createIndex({ "createdBy": 1 });
db.sessions.createIndex({ "date": 1 });
db.sessions.createIndex({ "status": 1 });

db.rooms.createIndex({ "sections": 1 });
db.rooms.createIndex({ "status": 1 });

db.sections.createIndex({ "number": 1 });
db.sections.createIndex({ "studentCount": 1 });

db.activitylogs.createIndex({ "sessionId": 1 });
db.activitylogs.createIndex({ "timestamp": -1 });

print('Database initialized successfully');
