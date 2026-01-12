import React from "react";

export function ErrorBanner(props: { title: string; detail?: string }) {
  return (
    <div style={{ border: "1px solid #f5c2c7", background: "#f8d7da", padding: 12, borderRadius: 8 }}>
      <div style={{ fontWeight: 700 }}>{props.title}</div>
      {props.detail ? <pre style={{ margin: "8px 0 0", whiteSpace: "pre-wrap" }}>{props.detail}</pre> : null}
    </div>
  );
}
