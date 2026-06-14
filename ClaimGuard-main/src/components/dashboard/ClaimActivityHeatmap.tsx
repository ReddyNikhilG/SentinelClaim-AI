import React, { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { CalendarDays } from 'lucide-react';
import { Claim } from '@/types/claims';
import { cn } from '@/lib/utils';

interface ClaimActivityHeatmapProps {
  claims: Claim[];
}

export function ClaimActivityHeatmap({ claims }: ClaimActivityHeatmapProps) {
  const heatmapData = useMemo(() => {
    const now = new Date();
    const weeks = 12;
    const data: { date: string; count: number; day: number; week: number }[] = [];

    // Generate last 12 weeks of dates
    for (let w = weeks - 1; w >= 0; w--) {
      for (let d = 0; d < 7; d++) {
        const date = new Date(now);
        date.setDate(date.getDate() - (w * 7 + (6 - d)));
        const dateStr = date.toISOString().split('T')[0];
        const count = claims.filter(c => c.created_at.startsWith(dateStr)).length;
        data.push({ date: dateStr, count, day: d, week: weeks - 1 - w });
      }
    }
    return data;
  }, [claims]);

  const maxCount = Math.max(...heatmapData.map(d => d.count), 1);

  const getColor = (count: number) => {
    if (count === 0) return 'bg-muted';
    const intensity = count / maxCount;
    if (intensity > 0.75) return 'bg-primary';
    if (intensity > 0.5) return 'bg-primary/70';
    if (intensity > 0.25) return 'bg-primary/40';
    return 'bg-primary/20';
  };

  const dayLabels = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

  return (
    <Card className="card-enterprise">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
          <CalendarDays className="h-5 w-5 text-accent" />
          Claim Activity (Last 12 Weeks)
        </CardTitle>
        <CardDescription>Daily claim submission frequency</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex gap-1">
          <div className="flex flex-col gap-1 mr-1">
            {dayLabels.map((label, i) => (
              <div key={i} className="h-3 w-3 flex items-center justify-center text-[8px] text-muted-foreground">
                {i % 2 === 1 ? label : ''}
              </div>
            ))}
          </div>
          <div className="flex gap-[2px] overflow-x-auto">
            {Array.from({ length: 12 }, (_, week) => (
              <div key={week} className="flex flex-col gap-[2px]">
                {Array.from({ length: 7 }, (_, day) => {
                  const cell = heatmapData.find(d => d.week === week && d.day === day);
                  return (
                    <Tooltip key={day}>
                      <TooltipTrigger asChild>
                        <div
                          className={cn(
                            'h-3 w-3 rounded-[2px] transition-colors cursor-default',
                            getColor(cell?.count || 0)
                          )}
                        />
                      </TooltipTrigger>
                      <TooltipContent side="top" className="text-xs">
                        <p>{cell?.date}: {cell?.count || 0} claim{(cell?.count || 0) !== 1 ? 's' : ''}</p>
                      </TooltipContent>
                    </Tooltip>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
        <div className="flex items-center justify-end gap-1 mt-2 text-[10px] text-muted-foreground">
          <span>Less</span>
          <div className="h-3 w-3 rounded-[2px] bg-muted" />
          <div className="h-3 w-3 rounded-[2px] bg-primary/20" />
          <div className="h-3 w-3 rounded-[2px] bg-primary/40" />
          <div className="h-3 w-3 rounded-[2px] bg-primary/70" />
          <div className="h-3 w-3 rounded-[2px] bg-primary" />
          <span>More</span>
        </div>
      </CardContent>
    </Card>
  );
}
