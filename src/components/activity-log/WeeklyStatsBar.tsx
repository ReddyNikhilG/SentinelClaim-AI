import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { ACTION_CONFIG } from './constants';

interface WeeklyStats {
  counts: Record<string, number>;
  total: number;
  totalClaims: number;
}

interface WeeklyStatsBarProps {
  stats: WeeklyStats;
}

export function WeeklyStatsBar({ stats }: WeeklyStatsBarProps) {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
      <Card className="card-enterprise">
        <CardContent className="p-4 text-center">
          <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">This Week</p>
          <p className="text-2xl font-bold text-foreground">{stats.total}</p>
          <p className="text-xs text-muted-foreground">{stats.totalClaims} claims affected</p>
        </CardContent>
      </Card>
      {Object.entries(ACTION_CONFIG).map(([key, config]) => {
        const Icon = config.icon;
        return (
          <Card key={key} className="card-enterprise">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-1">
                <div className={`h-6 w-6 rounded-md ${config.bgColor} flex items-center justify-center`}>
                  <Icon className={`h-3.5 w-3.5 ${config.color}`} />
                </div>
                <span className="text-xs text-muted-foreground truncate">{config.label.replace('Bulk ', '')}</span>
              </div>
              <p className="text-xl font-bold text-foreground">{stats.counts[key] || 0}</p>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
