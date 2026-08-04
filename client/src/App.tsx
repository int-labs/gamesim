import { lazy, Suspense } from "react";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { AppShell } from "@/components/layout/app-shell";
import { Providers } from "@/providers";
import { RouteFallback } from "@/components/app/route-fallback";
import { AuthGate } from "@/features/auth/auth-gate";

const DashboardPage = lazy(() => import("@/features/dashboard/page"));
const SimulationsPage = lazy(() => import("@/features/simulations/page"));
const RoundsPage = lazy(() => import("@/features/rounds/page"));
const TeamsPage = lazy(() => import("@/features/teams/page"));
const UsersPage = lazy(() => import("@/features/users/page"));
const DecisionsPage = lazy(() => import("@/features/decisions/page"));
const ResultsPage = lazy(() => import("@/features/results/page"));
const DebriefPage = lazy(() => import("@/features/debrief/page"));
const GameContentPage = lazy(() => import("@/features/game-content/page"));
const SimulationTypesPage = lazy(() => import("@/features/simulation-types/page"));
const ProductsPage = lazy(() => import("@/features/products/page"));
const SegmentsPage = lazy(() => import("@/features/segments/page"));
const InitiativesPage = lazy(() => import("@/features/initiatives/page"));
const SimPreviewPage = lazy(() => import("@/features/sim-preview/page"));
const ProductFieldsPage = lazy(() => import("@/features/product-fields/page"));
const DriversPage = lazy(() => import("@/features/drivers/page"));
const GlobalInputsPage = lazy(() => import("@/features/global-inputs/page"));
const ParamListPage = lazy(() => import("@/features/param-list/page"));
const ProjectionsPage = lazy(() => import("@/features/projections/page"));
const BaseDataPage = lazy(() => import("@/features/base-data/page"));
const ImageAssetsPage = lazy(() => import("@/features/image-assets/page"));
const KitchenSinkPage = lazy(() => import("@/features/kitchen-sink/page"));
const PlaceholderPage = lazy(() => import("@/features/placeholder/page"));

export default function App() {
  return (
    <Providers>
      {/* Nothing below this renders — and no query fires — without a session. */}
      <AuthGate>
      <BrowserRouter>
        <Routes>
          <Route element={<AppShell />}>
            <Route
              path="/"
              element={
                <Suspense fallback={<RouteFallback />}>
                  <DashboardPage />
                </Suspense>
              }
            />
            {(
              [
                ["/simulations", SimulationsPage],
                ["/rounds", RoundsPage],
                ["/teams", TeamsPage],
                ["/users", UsersPage],
                ["/decisions", DecisionsPage],
                ["/results", ResultsPage],
                ["/debrief", DebriefPage],
                ["/game-content", GameContentPage],
                ["/simulation-types", SimulationTypesPage],
                ["/products", ProductsPage],
                ["/segments", SegmentsPage],
                ["/initiatives", InitiativesPage],
                ["/sim-preview", SimPreviewPage],
                ["/product-fields", ProductFieldsPage],
                ["/drivers", DriversPage],
                ["/global-inputs", GlobalInputsPage],
                ["/param-list", ParamListPage],
                ["/projections", ProjectionsPage],
                ["/base-data", BaseDataPage],
                ["/image-assets", ImageAssetsPage],
                ["/kitchen-sink", KitchenSinkPage],
              ] as const
            ).map(([path, Page]) => (
              <Route
                key={path}
                path={path}
                element={
                  <Suspense fallback={<RouteFallback />}>
                    <Page />
                  </Suspense>
                }
              />
            ))}
            <Route
              path="*"
              element={
                <Suspense fallback={<RouteFallback />}>
                  <PlaceholderPage />
                </Suspense>
              }
            />
          </Route>
        </Routes>
      </BrowserRouter>
      </AuthGate>
    </Providers>
  );
}
