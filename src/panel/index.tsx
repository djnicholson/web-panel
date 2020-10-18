import React from "react";
import ReactDOM from "react-dom";

import Frame from "./Frame";

import "./index.html";

function initialize() {
  (window.document.querySelector("html") as HTMLElement).style.height = "100%";
  (window.document.querySelector("body") as HTMLElement).style.margin = "0px";
  (window.document.querySelector("body") as HTMLElement).style.padding = "0px";
  (window.document.querySelector("#root") as HTMLElement).style.height = "100%";
  window.document.body.style.height = "100%";
  ReactDOM.render(
    <React.StrictMode>
      <Frame />
    </React.StrictMode>,
    document.getElementById("root")
  );
}

window.onload = initialize;
