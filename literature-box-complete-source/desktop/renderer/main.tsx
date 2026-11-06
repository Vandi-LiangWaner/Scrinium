import React from "react";
import { createRoot } from "react-dom/client";
import Home from "../../app/page";
import { displayName } from "../../package.json";
import "../../app/globals.css";

document.title = displayName;
createRoot(document.getElementById("root")!).render(<React.StrictMode><Home/></React.StrictMode>);
