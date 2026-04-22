import { create } from "zustand";
import { devtools } from "zustand/middleware";
import type { Alert, Prediction, Stop, Train } from "./types";

export const ROUTES = ["Green-B", "Green-C", "Green-D", "Green-E"];
export const ROUTE_FILTER = ROUTES.join(",");

const DEFAULT_HOME: [number, number] = [
  parseFloat(import.meta.env.VITE_HOME_LNG ?? "-71.1304"),
  parseFloat(import.meta.env.VITE_HOME_LAT ?? "42.3467"),
];

interface AppState {
  home: [number, number];
  setHome: (home: [number, number]) => void;

  activeStops: Stop[];
  setActiveStops: (stops: Stop[]) => void;

  childToParent: Record<string, string>;
  setChildToParent: (map: Record<string, string>) => void;

  predictions: Prediction[];
  setPredictions: (predictions: Prediction[]) => void;
  updatePrediction: (prediction: Prediction) => void;
  removePrediction: (id: string) => void;

  trains: Train[];
  setTrains: (trains: Train[]) => void;
  updateTrain: (train: Train) => void;
  removeTrain: (vehicleId: string) => void;

  alerts: Alert[];
  setAlerts: (alerts: Alert[]) => void;

  walkTimes: Record<string, number>; // stopId → minutes
  setWalkTimes: (walkTimes: Record<string, number>) => void;

  walkRoutes: { stopId: string; path: [number, number][] }[];
  setWalkRoutes: (routes: { stopId: string; path: [number, number][] }[]) => void;

  alertArmed: boolean;
  setAlertArmed: (armed: boolean) => void;
  alertFired: boolean;
  setAlertFired: (fired: boolean) => void;
}

export const useStore = create<AppState>()(devtools((set) => ({
  home: DEFAULT_HOME,
  setHome: (home) => set({ home }),

  activeStops: [],
  setActiveStops: (activeStops) => set({ activeStops }),

  childToParent: {},
  setChildToParent: (childToParent) => set({ childToParent }),

  predictions: [],
  setPredictions: (predictions) => set({ predictions }),
  updatePrediction: (prediction) =>
    set((state) => {
      const idx = state.predictions.findIndex((p) => p.id === prediction.id);
      if (idx === -1) {
        return { predictions: [...state.predictions, prediction] };
      }
      const next = [...state.predictions];
      next[idx] = prediction;
      return { predictions: next };
    }),
  removePrediction: (id) =>
    set((state) => ({
      predictions: state.predictions.filter((p) => p.id !== id),
    })),

  trains: [],
  setTrains: (trains) => set({ trains }),
  updateTrain: (train) =>
    set((state) => {
      const idx = state.trains.findIndex(
        (t) => t.vehicleId === train.vehicleId
      );
      if (idx === -1) {
        return { trains: [...state.trains, train] };
      }
      const next = [...state.trains];
      next[idx] = train;
      return { trains: next };
    }),
  removeTrain: (vehicleId) =>
    set((state) => ({
      trains: state.trains.filter((t) => t.vehicleId !== vehicleId),
    })),

  alerts: [],
  setAlerts: (alerts) => set({ alerts }),

  walkTimes: {},
  setWalkTimes: (walkTimes) => set({ walkTimes }),

  walkRoutes: [],
  setWalkRoutes: (walkRoutes) => set({ walkRoutes }),

  alertArmed: false,
  setAlertArmed: (alertArmed) => set({ alertArmed, alertFired: false }),
  alertFired: false,
  setAlertFired: (alertFired) => set({ alertFired }),
}), { name: "mbta-store" }));
