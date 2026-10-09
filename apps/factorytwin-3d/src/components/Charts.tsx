import { Area, AreaChart, CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { SensorReading, WhatIfPoint } from "../types";

export function SensorChart({ data }: { data: SensorReading[] }) {
  if (data.length === 0) {
    return <div className="flex h-44 items-center justify-center rounded border border-slate-800 bg-slate-950 text-sm text-slate-500">Start the simulation or import CSV data</div>;
  }

  return (
    <div className="h-44 rounded border border-slate-800 bg-slate-950 p-2">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data}>
          <defs>
            <linearGradient id="temp" x1="0" x2="0" y1="0" y2="1">
              <stop offset="5%" stopColor="#39c6d6" stopOpacity={0.5} />
              <stop offset="95%" stopColor="#39c6d6" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke="#1f2937" strokeDasharray="3 3" />
          <XAxis dataKey="timestamp" stroke="#64748b" tick={{ fontSize: 11 }} />
          <YAxis stroke="#64748b" tick={{ fontSize: 11 }} />
          <Tooltip contentStyle={{ background: "#0f172a", border: "1px solid #334155", color: "#d8e2ef" }} />
          <Area type="monotone" dataKey="temperature" stroke="#39c6d6" fill="url(#temp)" name="Temp C" />
          <Line type="monotone" dataKey="vibration" stroke="#f59e0b" dot={false} name="Vibration" />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

export function WhatIfChart({ data }: { data: WhatIfPoint[] }) {
  return (
    <div className="mt-3 h-48 rounded border border-slate-800 bg-slate-950 p-2">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data}>
          <CartesianGrid stroke="#1f2937" strokeDasharray="3 3" />
          <XAxis dataKey="second" stroke="#64748b" tick={{ fontSize: 11 }} />
          <YAxis stroke="#64748b" tick={{ fontSize: 11 }} />
          <Tooltip contentStyle={{ background: "#0f172a", border: "1px solid #334155", color: "#d8e2ef" }} />
          <Legend wrapperStyle={{ fontSize: 11 }} />
          <Line type="monotone" dataKey="baselineTemp" stroke="#94a3b8" dot={false} name="Baseline temp" />
          <Line type="monotone" dataKey="scenarioTemp" stroke="#39c6d6" dot={false} name="Scenario temp" />
          <Line type="monotone" dataKey="scenarioRisk" stroke="#fb7185" dot={false} name="Scenario risk" />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
