import React, { useEffect, useState } from 'react';
import {
  Box,
  Button,
  Card,
  CardContent,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  Grid,
  IconButton,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
  useTheme,
} from '@mui/material';
import {
  Delete as DeleteIcon,
  Refresh as RefreshIcon,
  Warning as WarningIcon,
} from '@mui/icons-material';
import { useError } from '../contexts/ErrorContext';
import { api } from '../services/api';
import { formatDistanceToNow } from 'date-fns';

interface Device {
  id: string;
  deviceInfo: {
    os: string;
    browser: string;
    deviceType: string;
    ipAddress: string;
    screenResolution?: string;
    timezone?: string;
  };
  status: string;
  activatedAt: string;
  deactivatedAt?: string;
  lastSeenAt: string;
}

interface DeviceManagementProps {
  licenseId: string;
}

const DeviceManagement: React.FC<DeviceManagementProps> = ({ licenseId }) => {
  const [devices, setDevices] = useState<Device[]>([]);
  const [loading, setLoading] = useState(true);
  const [deactivateDialog, setDeactivateDialog] = useState<{
    open: boolean;
    device: Device | null;
  }>({
    open: false,
    device: null,
  });
  const { showError, handleApiError } = useError();
  const theme = useTheme();

  const fetchDevices = async () => {
    try {
      setLoading(true);
      const response = await api.get(`/licenses/${licenseId}/devices`);
      setDevices(response.data.devices);
    } catch (error) {
      handleApiError(error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDevices();
  }, [licenseId]);

  const handleDeactivate = async (device: Device) => {
    try {
      await api.post(`/licenses/${licenseId}/devices/${device.id}/deactivate`);
      await fetchDevices();
      setDeactivateDialog({ open: false, device: null });
    } catch (error) {
      handleApiError(error);
    }
  };

  const handleActivate = async () => {
    try {
      const response = await api.post(`/licenses/${licenseId}/devices/activate`);
      if (response.data.device) {
        await fetchDevices();
      }
    } catch (error: any) {
      if (error.response?.status === 409) {
        // Handle device conflict
        const { conflict } = error.response.data.error;
        showError({
          code: 'DEVICE_CONFLICT',
          userMessage: 'This license is already active on another device',
          nextSteps: `Please deactivate the device (${conflict.deviceInfo.deviceType}) that was activated ${formatDistanceToNow(new Date(conflict.activatedAt))} ago`,
          helpUrl: '/help/device-management',
        });
      } else {
        handleApiError(error);
      }
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return theme.palette.success.main;
      case 'deactivated':
        return theme.palette.error.main;
      default:
        return theme.palette.grey[500];
    }
  };

  return (
    <Box sx={{ p: 3 }}>
      <Grid container spacing={3}>
        <Grid item xs={12}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 3 }}>
            <Typography variant="h5" component="h1">
              Device Management
            </Typography>
            <Box>
              <Button
                variant="contained"
                color="primary"
                onClick={handleActivate}
                sx={{ mr: 1 }}
              >
                Activate This Device
              </Button>
              <IconButton onClick={fetchDevices} disabled={loading}>
                <RefreshIcon />
              </IconButton>
            </Box>
          </Box>
        </Grid>

        <Grid item xs={12}>
          <Card>
            <CardContent>
              <TableContainer component={Paper}>
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableCell>Device</TableCell>
                      <TableCell>Browser</TableCell>
                      <TableCell>OS</TableCell>
                      <TableCell>Status</TableCell>
                      <TableCell>Last Seen</TableCell>
                      <TableCell>Actions</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {devices.map((device) => (
                      <TableRow key={device.id}>
                        <TableCell>
                          <Typography variant="body2">
                            {device.deviceInfo.deviceType}
                          </Typography>
                          {device.deviceInfo.screenResolution && (
                            <Typography variant="caption" color="textSecondary">
                              {device.deviceInfo.screenResolution}
                            </Typography>
                          )}
                        </TableCell>
                        <TableCell>{device.deviceInfo.browser}</TableCell>
                        <TableCell>{device.deviceInfo.os}</TableCell>
                        <TableCell>
                          <Typography
                            variant="body2"
                            sx={{ color: getStatusColor(device.status) }}
                          >
                            {device.status}
                          </Typography>
                          {device.status === 'active' && (
                            <Typography variant="caption" display="block">
                              Activated {formatDistanceToNow(new Date(device.activatedAt))} ago
                            </Typography>
                          )}
                        </TableCell>
                        <TableCell>
                          {formatDistanceToNow(new Date(device.lastSeenAt))} ago
                        </TableCell>
                        <TableCell>
                          {device.status === 'active' && (
                            <IconButton
                              color="error"
                              onClick={() =>
                                setDeactivateDialog({ open: true, device })
                              }
                            >
                              <DeleteIcon />
                            </IconButton>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                    {devices.length === 0 && !loading && (
                      <TableRow>
                        <TableCell colSpan={6} align="center">
                          <Typography variant="body2" color="textSecondary">
                            No devices found
                          </Typography>
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </TableContainer>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Deactivate Confirmation Dialog */}
      <Dialog
        open={deactivateDialog.open}
        onClose={() => setDeactivateDialog({ open: false, device: null })}
      >
        <DialogTitle>Deactivate Device?</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Are you sure you want to deactivate this device? You will need to
            reactivate it if you want to use it again.
          </DialogContentText>
          {deactivateDialog.device && (
            <Box sx={{ mt: 2, display: 'flex', alignItems: 'center' }}>
              <WarningIcon color="warning" sx={{ mr: 1 }} />
              <Typography variant="body2" color="textSecondary">
                {deactivateDialog.device.deviceInfo.deviceType} -{' '}
                {deactivateDialog.device.deviceInfo.browser}
              </Typography>
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button
            onClick={() => setDeactivateDialog({ open: false, device: null })}
          >
            Cancel
          </Button>
          <Button
            onClick={() =>
              deactivateDialog.device && handleDeactivate(deactivateDialog.device)
            }
            color="error"
            variant="contained"
          >
            Deactivate
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default DeviceManagement; 