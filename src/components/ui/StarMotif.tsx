/** Decorative star schema: three fact tables in the middle, five shared dimensions around them. */
export function StarMotif({ className = "" }: { className?: string }) {
  const dims = [
    { x: 200, y: 52, t: "student" },
    { x: 352, y: 150, t: "course" },
    { x: 300, y: 330, t: "department" },
    { x: 100, y: 330, t: "faculty" },
    { x: 48, y: 150, t: "session" },
  ];
  const facts = [
    { x: 200, y: 170, t: "enrolment" },
    { x: 200, y: 222, t: "fee payment" },
    { x: 200, y: 274, t: "result" },
  ];
  return (
    <svg viewBox="0 0 400 390" className={className} role="img" aria-label="Star schema: three fact tables sharing five dimensions">
      <g stroke="#4a4540" strokeWidth="1.4">
        {facts.map((f) => dims.map((d) => <line key={f.t + d.t} x1={f.x} y1={f.y} x2={d.x} y2={d.y} opacity={f.t === "result" || d.t !== "course" ? 1 : 0} />))}
      </g>
      {dims.map((d) => (
        <g key={d.t}>
          <circle cx={d.x} cy={d.y} r="34" fill="#2d2a27" stroke="#4a4540" strokeWidth="1.4" />
          <text x={d.x} y={d.y + 4} textAnchor="middle" fontSize={d.t.length > 8 ? 11 : 12.5} fill="#fff8f5">{d.t}</text>
        </g>
      ))}
      {facts.map((f) => (
        <g key={f.t}>
          <rect x={f.x - 62} y={f.y - 19} width="124" height="38" rx="11" fill="#d9443e" />
          <text x={f.x} y={f.y + 4.5} textAnchor="middle" fontSize="13" fontWeight="600" fill="#ffffff">{f.t}</text>
        </g>
      ))}
    </svg>
  );
}
