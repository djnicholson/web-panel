import React, { useEffect, useRef, useState } from "react";

declare var acquireVsCodeApi: any;
const vscode = acquireVsCodeApi();

export default function Frame() {
  const [iframeSrc, setIframeSrc] = useState<string>("");
  const iframe = useRef<HTMLIFrameElement>(null);
  const postMessage = (request: any) => {
    console.log("📤", request);
    vscode.postMessage(request);
  };
  const receiveMessage = (request: any) => {
    console.log("📬", request);
    if (!!request.url) {
      setIframeSrc(request.url);
    }
  };
  useEffect(() => {
    window.addEventListener("message", (msg) => receiveMessage(msg.data));
    postMessage({ alive: true });
  }, []);
  return (
    <div style={{ height: "100%", display: "flex", flexDirection: "column" }}>
      {!!iframeSrc && (
        <iframe style={{ flex: "1" }} src={iframeSrc} ref={iframe} />
      )}
      {!iframeSrc && (
        <div
          style={{
            flex: "1",
            textAlign: "center",
            marginTop: 30,
            fontSize: "1.5em",
          }}
        >
          Loading&hellip;
        </div>
      )}
    </div>
  );
}
