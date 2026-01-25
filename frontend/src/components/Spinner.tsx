import React from 'react';
import { CircularProgress } from '@mui/material';

export const Spinner: React.FC<{ size?: number }> = ({ size = 24 }) => {
  return <CircularProgress size={size} thickness={4} />;
}; 