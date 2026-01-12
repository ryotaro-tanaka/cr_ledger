import React from "react";

export function LoadingInline(props: { label?: string }) {
  return (
    <span style={{ display: "inline-flex", gap: 8, alignItems: "center" }}>
      <span
        aria-hidden
        style={{
          width: 12,
          height: 12,
          border: "2px solid #999",
          borderTopColor: "transparent",
          borderRadius: 999,
          display: "inline-block",
          animation: "spin 0.8s linear infinite",
        }}
      />
      <span>{props.label ?? "Loading..."}</span>
      <style>{`@keyframes spin { from{transform:rotate(0)} to{transform:rotate(360deg)} }`}</style>
    </span>
  );
}
