import { useEffect, useState } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { AdminPage } from "./pages/AdminPage";
import { AppointmentsPage } from "./pages/AppointmentsPage";
import { AuthPage } from "./pages/AuthPage";
import { BookingPage } from "./pages/BookingPage";
import { ClinicalDecisionPage } from "./pages/ClinicalDecisionPage";
import { EmergencyVitalsPage } from "./pages/EmergencyVitalsPage";
import type { AuthUser } from "./types";

function App() {
  const [user, setUser] = useState<AuthUser | null>(() => {
    const raw = localStorage.getItem("auth_user");
    return raw ? (JSON.parse(raw) as AuthUser) : null;
  });

  useEffect(() => {
    if (user) {
      localStorage.setItem("auth_user", JSON.stringify(user));
    } else {
      localStorage.removeItem("auth_user");
    }
  }, [user]);

  return (
    <Routes>
      {/* Auth — full screen */}
      <Route
        path="/auth"
        element={user ? <Navigate to="/" replace /> : <AuthPage onLogin={setUser} />}
      />

      {/* Admin dashboard */}
      <Route
        path="/admin"
        element={
          !user ? (
            <Navigate to="/auth" replace />
          ) : user.role.toLowerCase() !== "admin" ? (
            <Navigate to="/" replace />
          ) : (
            <AdminPage user={user} onLogout={() => {
              localStorage.removeItem("token");
              localStorage.removeItem("auth_user");
              window.location.href = "/auth";
            }} />
          )
        }
      />

      {/* Patient booking — full screen (has own AppHeader + TabStrip) */}
      <Route
        path="/"
        element={
          !user ? (
            <Navigate to="/auth" replace />
          ) : user.role.toLowerCase() === "admin" ? (
            <Navigate to="/admin" replace />
          ) : user.role.toLowerCase() === "doctor" ? (
            <ClinicalDecisionPage user={user} />
          ) : (
            <BookingPage user={user} />
          )
        }
      />

      {/* Patient appointments — full screen */}
      <Route
        path="/appointments"
        element={
          !user ? (
            <Navigate to="/auth" replace />
          ) : user.role.toLowerCase() === "doctor" ? (
            <Navigate to="/" replace />
          ) : (
            <AppointmentsPage user={user} />
          )
        }
      />

      {/* Emergency vitals — full screen */}
      <Route
        path="/emergency-vitals"
        element={user ? <EmergencyVitalsPage /> : <Navigate to="/auth" replace />}
      />

      <Route path="*" element={<Navigate to={user ? "/" : "/auth"} replace />} />
    </Routes>
  );
}

export default App;
