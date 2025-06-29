import React from 'react';
import { Box, Typography, Button } from '@mui/material';

interface Props {
  onComplete: () => void;
  onBack: () => void;
  isLastStep?: boolean;
}

export const UploadStep: React.FC<Props> = ({ onComplete }) => {
  return (
    <Box textAlign="center">
      <Typography variant="h5" gutterBottom>
        Upload PDFs
      </Typography>
      <Typography variant="body1" gutterBottom>
        This is a placeholder for the upload tutorial.
      </Typography>
      <Button variant="contained" onClick={onComplete}>
        Next
      </Button>
    </Box>
  );
}; 