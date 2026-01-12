import React from "react";

export function Table(props: { children: React.ReactNode }) {
  return (
    <div style={{ overflowX: "auto" }}>
      <table style={{ width: "100%", borderCollapse: "collapse" }}>{props.children}</table>
    </div>
  );
}

export function Th(props: { children: React.ReactNode }) {
  return (
    <th
      style={{
        textAlign: "left",
        borderBottom: "1px solid #ddd",
        padding: "8px 6px",
        fontSize: 12,
        opacity: 0.8,
        whiteSpace: "nowrap",
      }}
    >
      {props.children}
    </th>
  );
}

export function Td(props: { children: React.ReactNode }) {
  return (
    <td style={{ borderBottom: "1px solid #eee", padding: "8px 6px", whiteSpace: "nowrap" }}>
      {props.children}
    </td>
  );
}
