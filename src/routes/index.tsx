import { createFileRoute } from "@tanstack/react-router";
import { JeetApp } from "@/jeet/JeetApp";

export const Route = createFileRoute("/")({ component: Home });

function Home() {
  return <JeetApp />;
}
