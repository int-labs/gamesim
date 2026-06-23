import { useState } from "react";
import SimulationsPage from "./pages/SimulationsPage";
import SimulationTypesPage from "./pages/SimulationTypesPage";
import RoundsPage from "./pages/RoundsPage";
import TeamsPage from "./pages/TeamsPage";
import UsersPage from "./pages/UsersPage";
import SegmentsPage from "./pages/SegmentsPage";
import ProductsPage from "./pages/ProductsPage";
import DriversPage from "./pages/DriversPage";
import InitiativesPage from "./pages/InitiativesPage";
import DecisionsPage from "./pages/DecisionsPage";
import ParamListPage from "./pages/ParamListPage";
import ProjectionsPage from "./pages/ProjectionsPage";
import ResultsPage from "./pages/ResultsPage";
import BaseDataPage from "./pages/BaseDataPage";
import ImageAssetsPage from "./pages/ImageAssetsPage";
import ProductFieldsPage from "./pages/ProductFieldsPage";

type View =
  | "simulations"
  | "simulation-types"
  | "rounds"
  | "teams"
  | "users"
  | "segments"
  | "products"
  | "product-fields"
  | "drivers"
  | "initiatives"
  | "decisions"
  | "param-list"
  | "projections"
  | "results"
  | "base-data"
  | "image-assets";

const NAV: { label: string; view: View }[] = [
  { label: "Simulations", view: "simulations" },
  { label: "Simulation Types", view: "simulation-types" },
  { label: "Rounds", view: "rounds" },
  { label: "Teams", view: "teams" },
  { label: "Users", view: "users" },
  { label: "Segments", view: "segments" },
  { label: "Products", view: "products" },
  { label: "Product Fields", view: "product-fields" },
  { label: "Drivers", view: "drivers" },
  { label: "Initiatives", view: "initiatives" },
  { label: "Decisions", view: "decisions" },
  { label: "Param List", view: "param-list" },
  { label: "Projections", view: "projections" },
  { label: "Results", view: "results" },
  { label: "Base Data", view: "base-data" },
  { label: "Image Assets", view: "image-assets" },
];

export default function App() {
  const [view, setView] = useState<View>("simulations");

  const renderView = () => {
    switch (view) {
      case "simulations": return <SimulationsPage />;
      case "simulation-types": return <SimulationTypesPage />;
      case "rounds": return <RoundsPage />;
      case "teams": return <TeamsPage />;
      case "users": return <UsersPage />;
      case "segments": return <SegmentsPage />;
      case "products": return <ProductsPage />;
      case "drivers": return <DriversPage />;
      case "initiatives": return <InitiativesPage />;
      case "decisions": return <DecisionsPage />;
      case "param-list": return <ParamListPage />;
      case "projections": return <ProjectionsPage />;
      case "results": return <ResultsPage />;
      case "base-data": return <BaseDataPage />;
      case "image-assets": return <ImageAssetsPage />;
      case "product-fields": return <ProductFieldsPage />;
    }
  };

  return (
    <div style={{ display: "flex", minHeight: "100vh" }}>
      <nav style={{ width: 200, borderRight: "1px solid #ccc", padding: 8, flexShrink: 0 }}>
        <strong>Admin Dashboard</strong>
        <ul style={{ listStyle: "none", padding: 0, marginTop: 12 }}>
          {NAV.map(({ label, view: v }) => (
            <li key={v} style={{ marginBottom: 4 }}>
              <button
                onClick={() => setView(v)}
                style={{
                  background: view === v ? "#eee" : "none",
                  border: "none",
                  cursor: "pointer",
                  textAlign: "left",
                  width: "100%",
                  padding: "4px 6px",
                  fontWeight: view === v ? "bold" : "normal",
                }}
              >
                {label}
              </button>
            </li>
          ))}
        </ul>
      </nav>
      <main style={{ padding: 16, flex: 1, overflow: "auto" }}>
        {renderView()}
      </main>
    </div>
  );
}
