export interface Coordinates {
  type: 'Point';
  coordinates: [number, number]; // [longitude, latitude]
}

export interface Location {
  _id?: string;
  userId: string;
  coordinates: Coordinates;
  address?: string;
  accuracy?: number;
  altitude?: number;
  heading?: number;
  speed?: number;
  timestamp: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface LocationHistory {
  _id?: string;
  userId: string;
  coordinates: Coordinates;
  address?: string;
  timestamp: Date;
  createdAt: Date;
}

export interface NearbyUser {
  userId: string;
  distance: number;
  coordinates: Coordinates;
  address?: string;
  lastUpdated: Date;
}

export interface LocationSearchParams {
  latitude: number;
  longitude: number;
  radiusMeters?: number;
  limit?: number;
}