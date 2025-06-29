import React, { useState } from 'react';
import { Box, Typography, Paper } from '@mui/material';
import { FileUploader } from '../components/FileUpload/FileUploader';
import FileUploadProgress from '../components/FileUpload/FileUploadProgress';

const InvoiceProcessor: React.FC = () => {
  const [batchJobId, setBatchJobId] = useState<string | null>(null);

  return (
    <Box display="flex" flexDirection="column" alignItems="center" sx={{ mt: 4 }}>
      <Paper sx={{ p: 4, width: '100%', maxWidth: 600 }}>
        <Typography variant="h4" gutterBottom>
          Upload Invoice PDF
        </Typography>
        <Typography variant="body1" gutterBottom>
          Select one or more PDF invoices and we'll extract the data automatically.
        </Typography>

        <FileUploader onUploadComplete={setBatchJobId} />

        {batchJobId && (
          <Box sx={{ mt: 4 }}>
            <Typography variant="h5" gutterBottom>
              Processing Progress
            </Typography>
            <FileUploadProgress batchJobId={batchJobId} />
          </Box>
        )}
      </Paper>
    </Box>
  );
};

export default InvoiceProcessor; 