import React from "react";
import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "./AuthContext";

export default function ProtectedRoute() {
  const {
    isAuthenticated,
    loading,
  } = useAuth();

  // ----------------------------------------------------------
  // WAIT FOR INITIAL JWT CHECK
  // ----------------------------------------------------------

  if (loading) {
    return (
      <div
        style={{
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: "Arial, sans-serif",
        }}
      >
        Checking authentication...
      </div>
    );
  }

  // ----------------------------------------------------------
  // NOT AUTHENTICATED
  // ----------------------------------------------------------

  if (!isAuthenticated) {
    return (
      <Navigate
        to="/login"
        replace
      />
    );
  }

  // ----------------------------------------------------------
  // AUTHENTICATED
  // ----------------------------------------------------------

  return <Outlet />;
}