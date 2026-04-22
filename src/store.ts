import { create } from "zustand";
import type { Alert, Prediction, Stop, Train } from "./types";

export const STOPS: Stop[] = [
  {
    id: "place-harvd",
    name: "Harvard Ave",
    coordinates: [-71.1313, 42.3503],
    route: "Green-B",
  },
  {
    id: "place-cool",
    name: "Coolidge Corner",
    coordinates: [-71.1213, 42.3424],
    route: "Green-C",
  },
];

// MBTA predictions return child stop IDs, not parent IDs.
// Map child → parent so we can match predictions to stops.
export const CHILD_TO_PARENT_STOP: Record<string, string> = {
  "70035": "place-harvd", // Harvard Ave inbound
  "70036": "place-harvd", // Harvard Ave outbound
  "70219": "place-cool",  // Coolidge Corner outbound
  "70220": "place-cool",  // Coolidge Corner inbound
};

interface AppState {
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
}

export const useStore = create<AppState>((set) => ({
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
}));
