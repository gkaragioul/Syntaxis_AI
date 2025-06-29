import React from 'react';
import { Alert, AlertTitle } from '@mui/material';

interface Props {
  message: string;
  onClose: () => void;
}

export const FileUploadError: React.FC<Props> = ({ message, onClose }) => {
  return (
    <Alert severity="error" onClose={onClose} sx={{ mt: 2 }}>
      <AlertTitle>Upload Error</AlertTitle>
      {message}
    </Alert>
  );
};

export default FileUploadError; 