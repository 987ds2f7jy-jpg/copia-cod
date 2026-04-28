import React from 'react';
import { Card, CardContent } from "@/components/ui/card";
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';

export default function KPICard({ label, value, sub, icon: Icon, color, trend, trendLabel, loading }) {
  const trendColor = trend > 0 ? 'text-emerald-600' : trend < 0 ? 'text-red-500' : 'text-muted-foreground';
  const TrendIcon = trend > 0 ? TrendingUp : trend < 0 ? TrendingDown : Minus;

  return (
    <Card className="border-border shadow-sm hover:shadow-md transition-shadow bg-card">
      <CardContent className="p-5">
        <div className="flex items-start justify-between mb-3">
          <div className={`w-10 h-10 rounded-xl ${color} flex items-center justify-center`}>
            <Icon className="w-5 h-5" />
          </div>
          {trend !== undefined && (
            <div className={`flex items-center gap-1 text-xs font-medium ${trendColor}`}>
              <TrendIcon className="w-3 h-3" />
              <span>{Math.abs(trend)}%</span>
            </div>
          )}
        </div>
        {loading ? (
          <div className="space-y-2">
            <div className="h-7 bg-muted rounded animate-pulse w-16" />
            <div className="h-3 bg-muted rounded animate-pulse w-24" />
          </div>
        ) : (
          <>
            <p className="text-2xl font-bold text-foreground leading-none mb-1">{value}</p>
            <p className="text-sm text-muted-foreground">{label}</p>
            {trendLabel && <p className="text-xs text-muted-foreground mt-1">{trendLabel}</p>}
            {sub && <p className="text-xs text-muted-foreground mt-1">{sub}</p>}
          </>
        )}
      </CardContent>
    </Card>
  );
}
