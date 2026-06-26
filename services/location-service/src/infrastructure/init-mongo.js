// This script initializes MongoDB collections with proper indexes
db.createCollection('locations', {
  validator: {
    $jsonSchema: {
      bsonType: 'object',
      required: ['userId', 'coordinates', 'timestamp'],
      properties: {
        _id: { bsonType: 'objectId' },
        userId: { bsonType: 'string' },
        coordinates: {
          bsonType: 'object',
          required: ['type', 'coordinates'],
          properties: {
            type: { enum: ['Point'] },
            coordinates: {
              bsonType: 'array',
              minItems: 2,
              maxItems: 2,
              items: { bsonType: 'double' }
            }
          }
        },
        address: { bsonType: 'string' },
        accuracy: { bsonType: 'double' },
        altitude: { bsonType: 'double' },
        heading: { bsonType: 'double' },
        speed: { bsonType: 'double' },
        timestamp: { bsonType: 'date' },
        createdAt: { bsonType: 'date' },
        updatedAt: { bsonType: 'date' }
      }
    }
  }
});

// Create geospatial index
db.locations.createIndex({ 'coordinates': '2dsphere' });
db.locations.createIndex({ 'userId': 1, 'timestamp': -1 });
db.locations.createIndex({ 'timestamp': -1 });
db.locations.createIndex({ 'createdAt': 1 }, { expireAfterSeconds: 2592000 }); // 30 days TTL

db.createCollection('location_history', {
  validator: {
    $jsonSchema: {
      bsonType: 'object',
      required: ['userId', 'coordinates', 'timestamp'],
      properties: {
        _id: { bsonType: 'objectId' },
        userId: { bsonType: 'string' },
        coordinates: {
          bsonType: 'object',
          properties: {
            type: { enum: ['Point'] },
            coordinates: { bsonType: 'array' }
          }
        },
        address: { bsonType: 'string' },
        timestamp: { bsonType: 'date' },
        createdAt: { bsonType: 'date' }
      }
    }
  }
});

db.location_history.createIndex({ 'userId': 1, 'timestamp': -1 });
db.location_history.createIndex({ 'coordinates': '2dsphere' });

print('MongoDB collections initialized successfully');