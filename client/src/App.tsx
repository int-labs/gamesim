import { Box, Button, ThemeProvider, Typography } from "@mui/material";
import CssBaseline from "@mui/material/CssBaseline";
import { jwtDecode } from "jwt-decode";
import React, { useEffect } from "react";
import { Link, Route, Routes, useLocation } from "react-router-dom";
import { useLocalStorage } from "./utils/hooks/useLocalStorage";

import PreviewToolbar from "./components/PreviewToolbar";
import ProtectedRoute from "./components/ProtectedRoute";
import Admin from "./pages/Admin";
import GlobalInputDetail from "./pages/admin/GlobalInputDetail";
import NewGlobalInput from "./pages/admin/NewGlobalInput";
import {
  default as AdminNewProduct,
  default as NewProduct,
} from "./pages/admin/NewProduct";
import NewSegment from "./pages/admin/NewSegment";
import NewSimulationType from "./pages/admin/NewSimulationType";
import ProductDetailUnderSimType from "./pages/admin/ProductDetailUnderSimType";
import SegmentDetail from "./pages/admin/SegmentDetail";
import SimulationDetailConfiguration from "./pages/admin/SimulationDetailConfiguration";
import SimulationTypeDetail from "./pages/admin/SimulationTypeDetail";
import SimulationTypeList from "./pages/admin/SimulationTypeList";
import AdminAnalysis from "./pages/AdminAnalysis";
import AdminEventList from "./pages/AdminEventList";
import AdminNewEventPage from "./pages/AdminNewEvent";
import AdminNewSimulationPage from "./pages/AdminNewSimulationPage";
import AdminNewUser from "./pages/AdminNewUser";
import AdminProductList from "./pages/AdminProductList";
import AdminSimActiveRound from "./pages/AdminSimActiveRound";
import AdminSimDetail from "./pages/AdminSimDetail";
import AdminUpdateEventPage from "./pages/AdminUpdateEvent";
import AdminUserList from "./pages/AdminUserList";
import Analysis from "./pages/Analysis";
import DecisionExample from "./pages/DecisionExample";
import EnhancedGeneric from "./pages/EnhancedGeneric";
import Home from "./pages/Home";
import TestingSlides from "./pages/TestingSlides";
import theme from "./theme";

import "./App.css";

const NotFound = () => (
  <Box
    sx={{
      height: "100vh",
      display: "flex",
      flexDirection: "column",
      justifyContent: "center",
      alignItems: "center",
      textAlign: "center",
      px: 2,
      bgcolor: "#f8f9fa",
    }}
  >
    <Typography variant="h2" color="error" gutterBottom>
      404
    </Typography>
    <Typography variant="h5" gutterBottom>
      Oops! The page you are looking for doesn’t exist.
    </Typography>
    <Typography variant="body1" sx={{ mb: 3 }}>
      It might have been moved or deleted. Let’s get you back on track.
    </Typography>
    <Button
      variant="contained"
      color="primary"
      component={Link}
      to="/"
      sx={{ textTransform: "none", px: 4, py: 1 }}
    >
      Back to Home
    </Button>
  </Box>
);

const AuthListener: React.FC = () => {
  const [token] = useLocalStorage("token", "", {
    deserializer: (val) => val,
    serializer: (val) => val,
  });
  const location = useLocation();

  useEffect(() => {
    if (token && (location.pathname === "/" || location.pathname === "/login")) {
      try {
        const decoded = jwtDecode<any>(token);
        if (decoded.role === "team") {
          sessionStorage.removeItem("redirect_to");
          window.location.href = `/v2/${decoded.simulationId}?segmentId=${decoded.segmentId}`;
        } else {
          const redirectTo = sessionStorage.getItem("redirect_to");
          if (redirectTo) {
            sessionStorage.removeItem("redirect_to");
            window.location.href = redirectTo;
          }
        }
      } catch (error) {
        console.error("AuthListener error:", error);
      }
    }
  }, [token, location.pathname]);

  return null;
};

const App: React.FC = () => {
  // Detect if we're in a preview environment
  const isPreview = window.location.hostname.includes("onrender.com");

  return (
    <React.Fragment>
      <ThemeProvider theme={theme}>
        <CssBaseline />
        <AuthListener />
        <PreviewToolbar isPreview={isPreview} />
        <Routes>
          {/* Public routes */}
          <Route path="/" element={<Home />} />
          <Route path="/decision-example" element={<DecisionExample />} />
          <Route path="/login" element={<Home />} />
          <Route path="/test-slides" element={<TestingSlides />} />

          {/* Team routes */}
          <Route element={<ProtectedRoute allowedRoles={["team"]} />}>
            <Route path="/analysis" element={<Analysis />} />

            <Route
              path="/v2/:simulationId"
              element={<EnhancedGeneric segment="" />}
            />
            <Route
              path="/v2/:simulationId/:segmentKey"
              element={<EnhancedGeneric segment="" />}
            />
          </Route>

          {/* Admin routes */}
          <Route
            path="admin"
            element={
              <ProtectedRoute allowedRoles={["admin", "operator", "client"]} />
            }
          >
            {/** events */}
            <Route index path="events" element={<AdminEventList />} />
            <Route index path="events/new" element={<AdminNewEventPage />} />
            <Route
              index
              path="events/:eventId"
              element={<AdminUpdateEventPage />}
            />

            {/** products */}
            <Route index path="products" element={<AdminProductList />} />
            <Route index path="products/new" element={<NewProduct />} />

            {/** simulations */}
            <Route index path="simulations" element={<Admin />} />
            <Route
              path="simulations/new"
              element={<AdminNewSimulationPage />}
            />
            <Route
              path="simulations/:simulationId"
              element={<AdminSimDetail />}
            />
            <Route
              path="simulations/:simulationId/configs"
              element={<SimulationDetailConfiguration />}
            />
            <Route
              path="simulations/:simulationId/rounds/:roundNumber"
              element={<AdminSimActiveRound />}
            />
            <Route
              path="simulations/:simulationId/analysis"
              element={<AdminAnalysis />}
            />
            <Route
              path="simulations/:simulationId/rounds/:roundNumber/slides"
              element={<TestingSlides />}
            />

            {/** users */}
            <Route
              element={
                <ProtectedRoute
                  allowedRoles={["admin", "operator"]}
                  renderNavbar={false}
                />
              }
            >
              <Route index path="users" element={<AdminUserList />} />
              <Route index path="users/new" element={<AdminNewUser />} />
            </Route>

            {/**
             * simulation types
             * accessible only via URL bar, not available in any menu
             *
             */}
            <Route
              element={
                <ProtectedRoute allowedRoles={["admin"]} renderNavbar={false} />
              }
            >
              <Route
                index
                path="simulation-types"
                element={<SimulationTypeList />}
              />
              <Route
                index
                path="simulation-types/new"
                element={<NewSimulationType />}
              />
              <Route
                index
                path="simulation-types/:simulationTypeId"
                element={<SimulationTypeDetail />}
              />

              <Route
                index
                path="simulation-types/:simulationTypeId/segments/new"
                element={<NewSegment />}
              />
              <Route
                index
                path="simulation-types/:simulationTypeId/segments/:segmentId"
                element={<SegmentDetail />}
              />

              <Route
                index
                path="simulation-types/:simulationTypeId/products/:productId"
                element={<ProductDetailUnderSimType />}
              />

              <Route
                index
                path="simulation-types/:simulationTypeId/products/new"
                element={<AdminNewProduct />}
              />

              <Route
                index
                path="simulation-types/:simulationTypeId/events/new"
                element={<AdminNewEventPage />}
              />
              <Route
                index
                path="simulation-types/:simulationTypeId/events/:eventId"
                element={<AdminUpdateEventPage />}
              />

              <Route
                index
                path="simulation-types/:simulationTypeId/global-inputs/new"
                element={<NewGlobalInput />}
              />
              <Route
                index
                path="simulation-types/:simulationTypeId/global-inputs/:globalInputId"
                element={<GlobalInputDetail />}
              />
            </Route>
          </Route>

          <Route path="*" element={<NotFound />} />
        </Routes>
      </ThemeProvider>
    </React.Fragment>
  );
};

export default App;
