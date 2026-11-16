import React from "react";
import ReactDOM from "react-dom/client";
import { MotionProvider } from "@stratagem/design-system";
import App from "./App";
import "./index.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <MotionProvider>
      <App />
    </MotionProvider>
  </React.StrictMode>
);