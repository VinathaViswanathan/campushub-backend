import { HealthStatus } from '../types/health.types';

export const getHealthStatus = (): HealthStatus => {
  return {
    status: 'ok',
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
  };
};