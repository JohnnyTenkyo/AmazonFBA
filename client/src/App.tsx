import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import { AuthProvider } from "./contexts/AuthContext";
import AppLayout from "./components/AppLayout";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import SkuManagement from "./pages/SkuManagement";
import FbaSync from "./pages/FbaSync";
import InventoryAlert from "./pages/InventoryAlert";
import TransportConfig from "./pages/TransportConfig";
import Shipments from "./pages/Shipments";
import Promotions from "./pages/Promotions";
import ShippingPlan from "./pages/ShippingPlan";
import SpringFestival from "./pages/SpringFestival";
import FactoryPlan from "./pages/FactoryPlan";

function AppRoutes() {
  return (
    <Switch>
      <Route path="/login" component={Login} />
      <Route path="/">
        <AppLayout>
          <Dashboard />
        </AppLayout>
      </Route>
      <Route path="/sku">
        <AppLayout>
          <SkuManagement />
        </AppLayout>
      </Route>
      <Route path="/sync">
        <AppLayout>
          <FbaSync />
        </AppLayout>
      </Route>
      <Route path="/alerts">
        <AppLayout>
          <InventoryAlert />
        </AppLayout>
      </Route>
      <Route path="/transport">
        <AppLayout>
          <TransportConfig />
        </AppLayout>
      </Route>
      <Route path="/shipments">
        <AppLayout>
          <Shipments />
        </AppLayout>
      </Route>
      <Route path="/promotions">
        <AppLayout>
          <Promotions />
        </AppLayout>
      </Route>
      <Route path="/shipping-plan">
        <AppLayout>
          <ShippingPlan />
        </AppLayout>
      </Route>
      <Route path="/spring-festival">
        <AppLayout>
          <SpringFestival />
        </AppLayout>
      </Route>
      <Route path="/factory-plan">
        <AppLayout>
          <FactoryPlan />
        </AppLayout>
      </Route>
      <Route path="/404" component={NotFound} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="light">
        <AuthProvider>
          <TooltipProvider>
            <Toaster />
            <AppRoutes />
          </TooltipProvider>
        </AuthProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
