import React from "react";
import { AuthProvider, useAuth } from "./AuthContext";
import LandingPage from "./components/LandingPage";
import Dashboard from "./components/Dashboard";
import "./styles/globals.css";

function AppInner() {
  const { isAuthed } = useAuth();
  return isAuthed ? <Dashboard /> : <LandingPage />;
}

export default function App() {
  return (
    <AuthProvider>
      <AppInner />
    </AuthProvider>
  );
}
