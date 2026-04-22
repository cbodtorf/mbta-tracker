export interface Prediction {
  id: string;
  routeId: string;
  stopId: string;
  tripId: string;
  vehicleId: string | null;
  arrivalTime: string | null;
  departureTime: string | null;
  directionId: number;
  status: string | null;
}

export interface Stop {
  id: string;
  name: string;
  coordinates: [number, number]; // [lng, lat]
  route: string;
}

export interface Train {
  vehicleId: string;
  routeId: string;
  latitude: number;
  longitude: number;
  bearing: number;
  currentStatus: string;
  updatedAt: string;
}

export interface Alert {
  id: string;
  header: string;
  description: string;
  effect: string;
  severity: number;
  routeIds: string[];
  activePeriods: { start: string; end: string | null }[];
}
