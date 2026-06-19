import { createFileRoute } from "@tanstack/react-router";
import MetodoOpApp from "@/MetodoOpApp";
import { AuthGate } from "@/components/app/AuthGate";
import { TopBar } from "@/components/app/TopBar";

export const Route = createFileRoute("/app")({
  component: AppPage,
});

function AppPage() {
  return (
    <AuthGate>
      <TopBar />
      <MetodoOpApp />
    </AuthGate>
  );
}
