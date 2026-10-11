'use client';

import React, { createContext, useContext, ReactNode } from 'react';
import { useAuth } from '@/hooks/use-auth';

interface DataPersistenceContextType {
  saveData: (key: string, data: unknown) => void;
  loadData: (key: string) => unknown;
  removeData: (key: string) => void;
}

const DataPersistenceContext = createContext<DataPersistenceContextType | undefined>(undefined);

export function DataPersistenceProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();

  const getUserKey = (key: string): string => {
    const userId = user?.id || 'anonymous';
    return `ghg_${userId}_${key}`;
  };

  const saveData = (key: string, data: unknown) => {
    try {
      const userKey = getUserKey(key);
      localStorage.setItem(userKey, JSON.stringify(data));
    } catch (error) {
      console.error('Error saving data to localStorage:', error);
    }
  };

  const loadData = (key: string): unknown => {
    try {
      const userKey = getUserKey(key);
      const data = localStorage.getItem(userKey);
      return data ? JSON.parse(data) : null;
    } catch (error) {
      console.error('Error loading data from localStorage:', error);
      return null;
    }
  };

  const removeData = (key: string) => {
    try {
      const userKey = getUserKey(key);
      localStorage.removeItem(userKey);
    } catch (error) {
      console.error('Error removing data from localStorage:', error);
    }
  };

  return (
    <DataPersistenceContext.Provider value={{ saveData, loadData, removeData }}>
      {children}
    </DataPersistenceContext.Provider>
  );
}

export function useDataPersistence() {
  const context = useContext(DataPersistenceContext);
  if (context === undefined) {
    throw new Error('useDataPersistence must be used within a DataPersistenceProvider');
  }
  return context;
}