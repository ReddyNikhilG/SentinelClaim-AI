import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Legend } from 'recharts';
import { BarChart3 } from 'lucide-react';

const chartConfig = {
  approved: { label: 'Approved', color: 'hsl(var(--success))' },
  rejected: { label: 'Rejected', color: 'hsl(var(--destructive))' },
  escalated: { label: 'Escalated', color: 'hsl(var(--warning, 45 93% 47%))' },
  reassigned: { label: 'Reassigned', color: 'hsl(var(--primary))' },
};

interface TrendChartProps {
  data: Record<string, unknown>[];
  onBarClick: (data: Record<string, unknown>) => void;
}

export function TrendChart({ data, onBarClick }: TrendChartProps) {
  return (
    <Card className="card-enterprise">
      <CardContent className="p-4">
        <div className="flex items-center gap-2 mb-4">
          <BarChart3 className="h-5 w-5 text-primary" />
          <h3 className="font-semibold text-foreground">Bulk Action Trends — Last 30 Days</h3>
        </div>
        <ChartContainer config={chartConfig} className="h-[220px] w-full">
          <BarChart data={data} barGap={1} onClick={(state) => state?.activePayload?.[0]?.payload && onBarClick(state.activePayload[0].payload)} className="cursor-pointer">
            <CartesianGrid strokeDasharray="3 3" className="stroke-border/40" />
            <XAxis dataKey="date" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} interval="preserveStartEnd" />
            <YAxis allowDecimals={false} tick={{ fontSize: 11 }} tickLine={false} axisLine={false} width={28} />
            <ChartTooltip content={<ChartTooltipContent />} />
            <Legend wrapperStyle={{ fontSize: 12, paddingTop: 8 }} />
            <Bar dataKey="approved" name="Approved" stackId="a" fill="var(--color-approved)" radius={[0, 0, 0, 0]} />
            <Bar dataKey="rejected" name="Rejected" stackId="a" fill="var(--color-rejected)" radius={[0, 0, 0, 0]} />
            <Bar dataKey="escalated" name="Escalated" stackId="a" fill="var(--color-escalated)" radius={[0, 0, 0, 0]} />
            <Bar dataKey="reassigned" name="Reassigned" stackId="a" fill="var(--color-reassigned)" radius={[2, 2, 0, 0]} />
          </BarChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}
