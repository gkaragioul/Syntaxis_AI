import React from 'react';
import { Box, Typography, Button } from '@mui/material';

interface Props {
  onComplete: () => void;
  onBack: () => void;
  isLastStep?: boolean;
}

export const ExtractionStep: React.FC<Props> = ({ onComplete, onBack }) => (
  <Box textAlign="center">
    <Typography variant="h5" gutterBottom>
      Table Extraction
    </Typography>
    <Typography variant="body1" gutterBottom>
      Placeholder instructions for reviewing extraction results.
    </Typography>
    <Button onClick={onBack} sx={{ mr: 2 }}>
      Back
    </Button>
    <Button variant="contained" onClick={onComplete}>
      Next
    </Button>
  </Box>
); 