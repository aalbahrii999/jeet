import { createRoot } from "react-dom/client";
import { JeetApp } from "./jeet/JeetApp";

const root = document.getElementById("root");
if (root) createRoot(root).render(<JeetApp />);
