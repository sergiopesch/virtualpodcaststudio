"use client";

import React from "react";
import { Button } from "@/components/ui/button";
import { Settings, Clock, Search } from "lucide-react";

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
      green: active ? 'bg-green-500' : 'bg-gray-300',
      red: active ? 'bg-red-500' : 'bg-gray-300', 
      yellow: active ? 'bg-yellow-500' : 'bg-gray-300',
      blue: active ? 'bg-blue-500' : 'bg-gray-300',
      gray: 'bg-gray-300'
    };
    return colors[color as keyof typeof colors] || 'bg-gray-300';
  };

  const getStatusTextColor = (color: string, active: boolean) => {
    const colors = {
      green: active ? 'text-green-600' : 'text-gray-500',
      red: active ? 'text-red-600' : 'text-gray-500',
      yellow: active ? 'text-yellow-600' : 'text-gray-500', 
      blue: active ? 'text-blue-600' : 'text-gray-500',
      gray: 'text-gray-500'
    };
    return colors[color as keyof typeof colors] || 'text-gray-500';
  };

  return (
    <header className="bg-white/80 backdrop-blur-sm border-b border-gray-200/60 px-6 py-5 sticky top-0 z-10">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 mb-1">
              {title}
            </h1>
            <p className="text-gray-600 text-sm">
              {description}
            </p>
          </div>
          
          {status && (
            <div className="flex items-center space-x-2">
              <div className={`w-3 h-3 rounded-full ${getStatusColor(status.color, status.active)} animate-pulse`}></div>
              <span className={`text-sm font-medium ${getStatusTextColor(status.color, status.active)}`}>
                {status.label}
              </span>
            </div>
          )}
        </div>
        
        <div className="flex items-center space-x-4">
          {timer && (
            <div className="flex items-center space-x-2 text-sm font-mono bg-gray-50 px-3 py-2 rounded-lg">
              <Clock className="w-4 h-4 text-gray-400" />
              <span className="text-gray-600">{timer.format(timer.duration)}</span>
            </div>
          )}
          
          {progress && (
            <div className="flex items-center space-x-3">
              <div className="w-32 bg-gray-200 rounded-full h-2">
                <div 
                  className="bg-gradient-primary h-2 rounded-full transition-all duration-500 ease-out"
                  style={{ width: `${progress.value}%` }}
                ></div>
              </div>
              <span className="text-xs text-gray-500 font-medium">
                {progress.label || `${Math.round(progress.value)}%`}
              </span>
            </div>
          )}
          
          {search && (
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder={search.placeholder}
                className="pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent bg-white/50 backdrop-blur-sm transition-all"
                onChange={(e) => search.onSearch?.(e.target.value)}
              />
            </div>
          )}
          
          {actions}
          
          <Button variant="ghost" size="sm" className="text-gray-600 hover:text-purple-700 hover:bg-purple-50">
            <Settings className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </header>
  );
}
