import React, { createContext, useContext, useState, useEffect } from "react";

// Define the app state structure
interface AppState {
  teamName: string;
  teamId: string;
  simulationId: string;
  roundNumber: number;
}

// Default app state
const defaultState: AppState = {
  teamName: "",
  teamId: "",
  simulationId: "",
  roundNumber: 1,
};

// Create the context
const AppContext = createContext<any>(null);

// AppProvider to manage and persist state
export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [appState, setAppState] = useState<AppState>(() => {
    // Check localStorage for saved state
    const savedState = localStorage.getItem("appState");
    return savedState ? JSON.parse(savedState) : defaultState;
  });

  useEffect(() => {
    // Save the state to localStorage whenever it changes
    localStorage.setItem("appState", JSON.stringify(appState));
  }, [appState]);

  return (
    <AppContext.Provider value={{ appState, setAppState }}>
      {children}
    </AppContext.Provider>
  );
};

// Custom hook for accessing the context
export const useAppContext = () => useContext(AppContext);
