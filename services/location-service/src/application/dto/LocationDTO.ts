export interface UpdateLocationDTO {
  latitude: number;
  longitude: number;
  address?: string;
  accuracy?: number;
  altitude?: number;
  heading?: number;
  speed?: number;
}

export interface LocationResponseDTO {
  userId: string;
  coordinates: {
    latitude: number;
    longitude: number;
  };
  address?: string;
  accuracy?: number;
  altitude?: number;
  heading?: number;
  speed?: number;
  timestamp: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface NearbyUserDTO {
  userId: string;
  distance: number;
  coordinates: {
    latitude: number;
    longitude: number;
  };
  address?: string;
  lastUpdated: Date;
}

export interface LocationHistoryDTO {
  coordinates: {
    latitude: number;
    longitude: number;
  };
  address?: string;
  timestamp: Date;
}

export interface LocationStatsDTO {
  totalLocations: number;
  avgLocation?: {
    latitude: number;
    longitude: number;
  };
  bounds?: {
    north: number;
    south: number;
    east: number;
    west: number;
  };
  firstLocation?: Date;
  lastLocation?: Date;
}