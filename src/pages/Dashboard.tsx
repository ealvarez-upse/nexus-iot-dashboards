import { Navigate } from "react-router";

/** El dashboard starter redirige a la experiencia principal de la plataforma. */
export default function Dashboard() {
  return <Navigate to="/app" replace />;
}
