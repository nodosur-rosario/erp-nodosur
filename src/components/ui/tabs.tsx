"use client";

import React, { createContext, useContext, useState } from "react";

interface TabsContextProps {
  value: string;
  onValueChange: (value: string) => void;
}

const TabsContext = createContext<TabsContextProps | null>(null);

export function Tabs({ 
  defaultValue, 
  value, 
  onValueChange, 
  children, 
  className = "" 
}: { 
  defaultValue?: string; 
  value?: string; 
  onValueChange?: (val: string) => void; 
  children: React.ReactNode; 
  className?: string;
}) {
  const [localVal, setLocalVal] = useState(defaultValue || "");
  const activeValue = value !== undefined ? value : localVal;
  
  const handleValueChange = (val: string) => {
    if (onValueChange) onValueChange(val);
    else setLocalVal(val);
  };

  return (
    <TabsContext.Provider value={{ value: activeValue, onValueChange: handleValueChange }}>
      <div className={`space-y-6 ${className}`}>{children}</div>
    </TabsContext.Provider>
  );
}

export function TabsList({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`inline-flex items-center justify-start rounded-xl bg-zinc-900/60 border border-zinc-800 p-1 text-zinc-400 backdrop-blur-md ${className}`}>
      {children}
    </div>
  );
}

export function TabsTrigger({ value, children, className = "" }: { value: string; children: React.ReactNode; className?: string }) {
  const ctx = useContext(TabsContext);
  if (!ctx) throw new Error("TabsTrigger must be used within Tabs");

  const isActive = ctx.value === value;

  return (
    <button
      onClick={() => ctx.onValueChange(value)}
      className={`px-4 py-2 text-xs font-bold rounded-lg transition-all duration-200 focus:outline-none whitespace-nowrap ${
        isActive
          ? "bg-zinc-800 text-white shadow-md border border-zinc-700/40"
          : "hover:text-zinc-200 hover:bg-zinc-900/40 text-zinc-450 border border-transparent"
      } ${className}`}
    >
      {children}
    </button>
  );
}

export function TabsContent({ value, children, className = "" }: { value: string; children: React.ReactNode; className?: string }) {
  const ctx = useContext(TabsContext);
  if (!ctx) throw new Error("TabsContent must be used within Tabs");

  if (ctx.value !== value) return null;

  return (
    <div className={`animate-fade-in-up focus:outline-none ${className}`}>
      {children}
    </div>
  );
}
