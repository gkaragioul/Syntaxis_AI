import React from 'react';
import {
  Alert,
  AlertTitle,
  Box,
  Button,
  Collapse,
  IconButton,
  Link,
  Paper,
  Typography,
} from '@mui/material';
import { Close as CloseIcon, ExpandMore as ExpandMoreIcon, ExpandLess as ExpandLessIcon } from '@mui/icons-material';
import { styled } from '@mui/material/styles';

interface ErrorDisplayProps {
  error: {
    code: string;
    userMessage: string;
    nextSteps: string;
    helpUrl: string;
    logId?: string;
  };
  onClose?: () => void;
  onRetry?: () => void;
  showDetails?: boolean;
}

const ErrorContainer = styled(Paper)(({ theme }) => ({
  padding: theme.spacing(2),
  marginBottom: theme.spacing(2),
  backgroundColor: theme.palette.error.light,
  color: theme.palette.error.contrastText,
}));

const DetailsContainer = styled(Box)(({ theme }) => ({
  marginTop: theme.spacing(2),
  padding: theme.spacing(2),
  backgroundColor: theme.palette.background.paper,
  borderRadius: theme.shape.borderRadius,
}));

export const ErrorDisplay: React.FC<ErrorDisplayProps> = ({
  error,
  onClose,
  onRetry,
  showDetails = false,
}) => {
  const [expanded, setExpanded] = React.useState(showDetails);

  const handleExpandClick = () => {
    setExpanded(!expanded);
  };

  return (
    <ErrorContainer elevation={2}>
      <Alert
        severity="error"
        action={
          <Box sx={{ display: 'flex', alignItems: 'center' }}>
            {onRetry && (
              <Button
                color="inherit"
                size="small"
                onClick={onRetry}
                sx={{ mr: 1 }}
              >
                Retry
              </Button>
            )}
            {onClose && (
              <IconButton
                aria-label="close"
                color="inherit"
                size="small"
                onClick={onClose}
              >
                <CloseIcon />
              </IconButton>
            )}
          </Box>
        }
      >
        <AlertTitle>Error: {error.code}</AlertTitle>
        <Typography variant="body1" gutterBottom>
          {error.userMessage}
        </Typography>
        {error.logId && (
          <Typography variant="caption" display="block" gutterBottom>
            Error ID: {error.logId}
          </Typography>
        )}
        <Box sx={{ mt: 1 }}>
          <Button
            size="small"
            onClick={handleExpandClick}
            endIcon={expanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
            sx={{ color: 'inherit' }}
          >
            {expanded ? 'Hide Details' : 'Show Details'}
          </Button>
        </Box>
        <Collapse in={expanded}>
          <DetailsContainer>
            <Typography variant="subtitle2" gutterBottom>
              Next Steps:
            </Typography>
            <Typography variant="body2" paragraph>
              {error.nextSteps}
            </Typography>
            {error.helpUrl && (
              <Link
                href={error.helpUrl}
                target="_blank"
                rel="noopener noreferrer"
                color="inherit"
                underline="hover"
              >
                Learn more about this error
              </Link>
            )}
          </DetailsContainer>
        </Collapse>
      </Alert>
    </ErrorContainer>
  );
};

export default ErrorDisplay; 