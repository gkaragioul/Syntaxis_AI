import React from 'react';
import { Box, Button, Container, Typography } from '@mui/material';
import ErrorDisplay from '../components/ErrorDisplay';
import useErrorHandler from '../hooks/useErrorHandler';
import axios from 'axios';

const ExamplePage: React.FC = () => {
  const { error, showError, hideError, handleApiError } = useErrorHandler();

  const handleSimulateError = async () => {
    try {
      // Simulate an API call that might fail
      await axios.get('/api/simulate-error');
    } catch (err) {
      handleApiError(err);
    }
  };

  const handleSimulateCustomError = () => {
    showError({
      code: 'CUSTOM_ERROR',
      userMessage: 'This is a custom error message',
      nextSteps: 'Try clicking the retry button or contact support',
      helpUrl: 'https://help.example.com/custom-error',
      logId: 'custom-error-123',
    });
  };

  return (
    <Container maxWidth="md">
      <Box sx={{ my: 4 }}>
        <Typography variant="h4" component="h1" gutterBottom>
          Error Handling Example
        </Typography>

        <Box sx={{ mb: 4 }}>
          <Button
            variant="contained"
            color="primary"
            onClick={handleSimulateError}
            sx={{ mr: 2 }}
          >
            Simulate API Error
          </Button>
          <Button
            variant="contained"
            color="secondary"
            onClick={handleSimulateCustomError}
          >
            Simulate Custom Error
          </Button>
        </Box>

        {error?.isVisible && (
          <ErrorDisplay
            error={{
              code: error.code,
              userMessage: error.userMessage,
              nextSteps: error.nextSteps,
              helpUrl: error.helpUrl,
              logId: error.logId,
            }}
            onClose={hideError}
            onRetry={handleSimulateError}
          />
        )}

        <Box sx={{ mt: 4 }}>
          <Typography variant="body1">
            This page demonstrates the error handling system with:
          </Typography>
          <ul>
            <li>API error handling with log IDs</li>
            <li>Custom error display</li>
            <li>Error retry functionality</li>
            <li>Expandable error details</li>
            <li>Help links and next steps</li>
          </ul>
        </Box>
      </Box>
    </Container>
  );
};

export default ExamplePage; 