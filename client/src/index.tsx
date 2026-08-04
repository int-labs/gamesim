import React from "react";
import ReactDOM from "react-dom/client";

// Poppins — the brand's only typeface (guidelines §5.1). Self-hosted woff2 so
// the console works offline and never waits on Google Fonts.
// Scale weights: Light 300 / Regular 400 / Medium 500 / SemiBold 600 / Bold 700 / Black 900.
import "@fontsource/poppins/300.css";
import "@fontsource/poppins/400.css";
import "@fontsource/poppins/500.css";
import "@fontsource/poppins/600.css";
import "@fontsource/poppins/700.css";
import "@fontsource/poppins/900.css";

import "./styles/globals.css";
import App from "./App";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
