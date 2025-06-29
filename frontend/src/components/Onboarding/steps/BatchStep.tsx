import React from 'react';
import { Box, Typography, Button } from '@mui/material';

interface Props {
  onComplete: () => void;
  onBack: () => void;
  isLastStep?: boolean;
}

export const BatchStep: React.FC<Props> = ({ onComplete, onBack }) => (
  <Box textAlign="center">
    <Typography variant="h5" gutterBottom>
      Batch Processing
    </Typography>
    <Typography variant="body1" gutterBottom>
      Placeholder tutorial for batch uploading and monitoring progress.
    </Typography>
    <Button onClick={onBack} sx={{ mr: 2 }}>
      Back
    </Button>
    <Button variant="contained" onClick={onComplete}>
      Next
    </Button>
  </Box>
); 