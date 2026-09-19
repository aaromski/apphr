'use client';

import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Cell,
} from 'recharts';

export interface TipoDato {
  tipo: string;
  promedio: number;
  limpiezas: number;
  slaPct: number;
}

export interface PersonalDato {
  id: string;
  nombre: string;
  promedio: number;
  limpiezas: number;
  cumplidas: number;
  slaPct: number;
}

export const BAR_COLORS = ['#6366f1', '#8b5cf6', '#0ea5e9', '#10b981', '#f59e0b', '#f43f5e', '#14b8a6', '#f97316'];

const tooltipStyle = {
  borderRadius: 12,
  border: '1px solid #e2e8f0',
  fontSize: 12,
  background: '#ffffff',
} as const;

export function TipoPromedioChart({ data }: { data: TipoDato[] }) {
  return (
    <ResponsiveContainer width="100%" height={240}>
      <BarChart data={data} margin={{ top: 10, right: 10, left: -14, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" strokeOpacity={0.15} vertical={false} />
        <XAxis dataKey="tipo" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
        <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
        <Tooltip cursor={{ fill: 'rgba(99,102,241,0.08)' }} contentStyle={tooltipStyle} />
        <Bar dataKey="promedio" name="Min promedio" radius={[6, 6, 0, 0]}>
          {data.map((_, i) => (
            <Cell key={i} fill={BAR_COLORS[i % BAR_COLORS.length]} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

export function PersonalChart({ data }: { data: PersonalDato[] }) {
  return (
    <ResponsiveContainer width="100%" height={240}>
      <BarChart data={data} layout="vertical" margin={{ top: 0, right: 28, left: 8, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" strokeOpacity={0.15} horizontal={false} />
        <XAxis type="number" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
        <YAxis type="category" dataKey="nombre" width={110} tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
        <Tooltip cursor={{ fill: 'rgba(59,130,246,0.08)' }} contentStyle={tooltipStyle} />
        <Bar dataKey="promedio" name="Min promedio" fill="#3b82f6" radius={[0, 6, 6, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}