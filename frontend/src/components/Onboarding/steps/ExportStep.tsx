import React from 'react';
import { Box, Typography, Button } from '@mui/material';

interface Props {
  onComplete: () => void;
  onBack: () => void;
  isLastStep?: boolean;
}

export const ExportStep: React.FC<Props> = ({ onBack, onComplete, isLastStep }) => (
  <Box textAlign="center">
    <Typography variant="h5" gutterBottom>
      Export Results
    </Typography>
    <Typography variant="body1" gutterBottom>
      Placeholder tutorial for exporting invoice data to Excel.
    </Typography>
    <Button onClick={onBack} sx={{ mr: 2 }}>
      Back
    </Button>
    <Button variant="contained" onClick={onComplete}>
      {isLastStep ? 'Finish' : 'Next'}
    </Button>
  </Box>
); 