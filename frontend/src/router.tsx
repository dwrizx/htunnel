import { Link, Outlet, createBrowserRouter } from "react-router-dom";
import DashboardRoute from "./routes/dashboard";
import HelpRoute from "./routes/help";
import TunnelDetailRoute from "./routes/tunnel-detail";

function RootLayout() {
  return (
    <div className="min-h-screen">
      <nav className="border-b border-slate-800 bg-slate-900/80">
        <div className="mx-auto flex max-w-6xl items-center gap-5 px-4 py-3 text-sm">
          <Link to="/" className="font-medium text-violet-300">
            Dashboard
          </Link>
          <Link to="/help" className="text-slate-300 hover:text-white">
            Help
          </Link>
          <a
            href="http://localhost:4000"
            className="text-slate-500 hover:text-slate-300"
          >
            Legacy UI
          </a>
        </div>
      </nav>
      <Outlet />
    </div>
  );
}

export const AppRouter = createBrowserRouter([
  {
    path: "/",
    element: <RootLayout />,
    children: [
      { index: true, element: <DashboardRoute /> },
      { path: "help", element: <HelpRoute /> },
      { path: "tunnels/:id", element: <TunnelDetailRoute /> },
    ],
  },
]);
