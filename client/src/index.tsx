import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App";
import { SocketProvider } from "./components/SocketProvider";
import { AppProvider } from "./context/AppContext";
import "./i18n";

const root = ReactDOM.createRoot(document.getElementById("root")!);
root.render(
  <React.StrictMode>
    <BrowserRouter>
      <SocketProvider>
        <AppProvider>
          <App />
        </AppProvider>
      </SocketProvider>
    </BrowserRouter>
  </React.StrictMode>
);
