"use client";

import React from "react";
import { Clock, Search } from "lucide-react";
import { UserMenu } from "./user-menu";

interface HeaderProps {
  title: string;
  description: string;
  status?: {
    label: string;
    color: "green" | "red" | "yellow" | "blue" | "gray";
    active: boolean;
  };
  timer?: {
    duration: number;
    format: (seconds: number) => string;
  };
  progress?: {
    value: number;
    label?: string;
  };
  actions?: React.ReactNode;
  search?: {
    placeholder: string;
    onSearch?: (query: string) => void;
  };
}

export function Header({
  title,
  description,
  status,
  timer,
  progress,
  actions,
  search
}: HeaderProps) {
  const getStatusColor = (color: string, active: boolean) => {
    const colors = {
      green: active ? 'bg-green-500' : 'bg-muted',
      red: active ? 'bg-red-500' : 'bg-muted',
      yellow: active ? 'bg-yellow-500' : 'bg-muted',
      blue: active ? 'bg-blue-500' : 'bg-muted',
      gray: 'bg-muted'
    };
    return colors[color as keyof typeof colors] || 'bg-muted';
  };

  const searchInputId = React.useId();

  return (
    <header className="glass-panel border-b border-border/50 px-8 py-4 sticky top-0 z-10">
      <div className="flex items-center justify-between max-w-7xl mx-auto">
        <div className="flex items-center gap-8">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-foreground">
              {title}
            </h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              {description}
            </p>
          </div>

          {status && (
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-secondary/50 border border-border/50">
              <div className={`size-2 rounded-full ${getStatusColor(status.color, status.active)} ${status.active ? 'animate-pulse' : ''}`} />
              <span className="text-xs font-medium text-foreground">
                {status.label}
              </span>
            </div>
          )}
        </div>

        <div className="flex items-center gap-4">
          {timer && (
            <div className="flex items-center gap-2 text-sm font-mono bg-secondary px-3 py-1.5 rounded-md border border-border/50">
              <Clock className="size-3.5 text-muted-foreground" />
              <span className="text-foreground font-medium">{timer.format(timer.duration)}</span>
            </div>
          )}

          {progress && (
            <div className="flex items-center gap-3 min-w-[140px]">
              <div className="flex-1 h-1.5 bg-secondary rounded-full overflow-hidden">
                <div
                  className="h-full bg-primary rounded-full transition-all duration-500 ease-apple"
                  style={{ width: `${progress.value}%` }}
                />
              </div>
              <span className="text-xs text-muted-foreground font-medium w-8 text-right">
                {progress.label || `${Math.round(progress.value)}%`}
              </span>
            </div>
          )}

          {search && (
            <div className="relative group">
              <label htmlFor={searchInputId} className="sr-only">
                {search.placeholder}
              </label>
              <Search
                className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground group-focus-within:text-foreground transition-colors"
                aria-hidden="true"
              />
              <input
                id={searchInputId}
                type="search"
                inputMode="search"
                placeholder={search.placeholder}
                className="w-64 rounded-lg border border-border/50 bg-secondary/50 pl-10 pr-4 py-2 text-sm text-foreground placeholder:text-muted-foreground transition-all focus:bg-background focus:border-primary/20 focus:ring-2 focus:ring-primary/10 outline-none"
                onChange={(e) => search.onSearch?.(e.target.value)}
              />
            </div>
          )}

          <div className="flex items-center gap-2">
            {actions}
          </div>

          <div className="pl-4 border-l border-border/50">
            <UserMenu />
          </div>
        </div>
      </div>
    </header>
  );
}
