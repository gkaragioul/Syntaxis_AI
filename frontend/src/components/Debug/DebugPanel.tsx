import React, { useState, useEffect } from 'react';
import {
  Box,
  Drawer,
  Typography,
  IconButton,
  Tabs,
  Tab,
  Card,
  CardContent,
  List,
  ListItem,
  ListItemText,
  Chip,
  Button,
  TextField,
  Alert,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Switch,
  FormControlLabel,
} from '@mui/material';
import {
  Close,
  BugReport,
  Storage,
  NetworkCheck,
  Speed,
  ExpandMore,
  Refresh,
  Clear,
} from '@mui/icons-material';
import { useQueryClient } from '@tanstack/react-query';
import { apiUtils } from '../../services/api';

interface DebugPanelProps {
  open: boolean;
  onClose: () => void;
}

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

const TabPanel: React.FC<TabPanelProps> = ({ children, value, index, ...other }) => {
  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`debug-tabpanel-${index}`}
      aria-labelledby={`debug-tab-${index}`}
      {...other}
    >
      {value === index && <Box sx={{ p: 2 }}>{children}</Box>}
    </div>
  );
};

export const DebugPanel: React.FC<DebugPanelProps> = ({ open, onClose }) => {
  const [tabValue, setTabValue] = useState(0);
  const [logs, setLogs] = useState<any[]>([]);
  const [apiTestUrl, setApiTestUrl] = useState('/api/v1/health');
  const [apiTestResult, setApiTestResult] = useState<any>(null);
  const [enableConsoleCapture, setEnableConsoleCapture] = useState(true);
  
  const queryClient = useQueryClient();

  // Capture console logs
  useEffect(() => {
    if (!enableConsoleCapture) return;

    const originalConsole = {
      log: console.log,
      error: console.error,
      warn: console.warn,
      info: console.info,
    };

    const captureLog = (level: string, originalFn: Function) => {
      return (...args: any[]) => {
        originalFn.apply(console, args);
        setLogs(prev => [...prev.slice(-99), {
          id: Date.now() + Math.random(),
          level,
          message: args.map(arg => 
            typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)
          ).join(' '),
          timestamp: new Date().toISOString(),
        }]);
      };
    };

    console.log = captureLog('log', originalConsole.log);
    console.error = captureLog('error', originalConsole.error);
    console.warn = captureLog('warn', originalConsole.warn);
    console.info = captureLog('info', originalConsole.info);

    return () => {
      Object.assign(console, originalConsole);
    };
  }, [enableConsoleCapture]);

  const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
    setTabValue(newValue);
  };

  const clearLogs = () => {
    setLogs([]);
  };

  const testApiEndpoint = async () => {
    try {
      setApiTestResult({ loading: true });
      const response = await fetch(apiTestUrl);
      const data = await response.json();
      setApiTestResult({
        status: response.status,
        statusText: response.statusText,
        data,
        headers: Object.fromEntries(response.headers.entries()),
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      setApiTestResult({
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
      });
    }
  };

  const getQueryCacheData = () => {
    const cache = queryClient.getQueryCache();
    return cache.getAll().map(query => ({
      queryKey: query.queryKey,
      state: query.state,
      dataUpdatedAt: query.state.dataUpdatedAt,
      errorUpdatedAt: query.state.errorUpdatedAt,
      fetchStatus: query.state.fetchStatus,
      status: query.state.status,
    }));
  };

  const clearQueryCache = () => {
    queryClient.clear();
  };

  const invalidateAllQueries = () => {
    queryClient.invalidateQueries();
  };

  const getLocalStorageData = () => {
    const data: { [key: string]: string } = {};
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key) {
        data[key] = localStorage.getItem(key) || '';
      }
    }
    return data;
  };

  const clearLocalStorage = () => {
    localStorage.clear();
  };

  const getSystemInfo = () => {
    return {
      userAgent: navigator.userAgent,
      language: navigator.language,
      platform: navigator.platform,
      cookieEnabled: navigator.cookieEnabled,
      onLine: navigator.onLine,
      screen: {
        width: screen.width,
        height: screen.height,
        colorDepth: screen.colorDepth,
      },
      window: {
        innerWidth: window.innerWidth,
        innerHeight: window.innerHeight,
        devicePixelRatio: window.devicePixelRatio,
      },
      location: {
        href: window.location.href,
        origin: window.location.origin,
        pathname: window.location.pathname,
        search: window.location.search,
        hash: window.location.hash,
      },
      performance: {
        navigation: performance.navigation.type,
        timing: {
          loadEventEnd: performance.timing.loadEventEnd,
          loadEventStart: performance.timing.loadEventStart,
          domContentLoadedEventEnd: performance.timing.domContentLoadedEventEnd,
          domContentLoadedEventStart: performance.timing.domContentLoadedEventStart,
        },
      },
    };
  };

  if (process.env.NODE_ENV !== 'development') {
    return null; // Only show in development
  }

  return (
    <Drawer
      anchor="right"
      open={open}
      onClose={onClose}
      sx={{
        '& .MuiDrawer-paper': {
          width: 600,
          maxWidth: '90vw',
        },
      }}
    >
      <Box sx={{ p: 2, borderBottom: 1, borderColor: 'divider' }}>
        <Box display="flex" alignItems="center" justifyContent="space-between">
          <Box display="flex" alignItems="center" gap={1}>
            <BugReport color="primary" />
            <Typography variant="h6">Debug Panel</Typography>
          </Box>
          <IconButton onClick={onClose}>
            <Close />
          </IconButton>
        </Box>
      </Box>

      <Tabs value={tabValue} onChange={handleTabChange} variant="scrollable">
        <Tab label="Console" />
        <Tab label="API Test" />
        <Tab label="Query Cache" />
        <Tab label="Storage" />
        <Tab label="System Info" />
      </Tabs>

      <TabPanel value={tabValue} index={0}>
        <Box display="flex" alignItems="center" justifyContent="space-between" mb={2}>
          <Typography variant="h6">Console Logs</Typography>
          <Box>
            <FormControlLabel
              control={
                <Switch
                  checked={enableConsoleCapture}
                  onChange={(e) => setEnableConsoleCapture(e.target.checked)}
                />
              }
              label="Capture"
            />
            <Button onClick={clearLogs} startIcon={<Clear />}>
              Clear
            </Button>
          </Box>
        </Box>
        
        <List dense sx={{ maxHeight: 400, overflow: 'auto' }}>
          {logs.map((log) => (
            <ListItem key={log.id} sx={{ flexDirection: 'column', alignItems: 'flex-start' }}>
              <Box display="flex" alignItems="center" gap={1} width="100%">
                <Chip
                  label={log.level}
                  size="small"
                  color={
                    log.level === 'error' ? 'error' :
                    log.level === 'warn' ? 'warning' :
                    log.level === 'info' ? 'info' : 'default'
                  }
                />
                <Typography variant="caption" color="text.secondary">
                  {new Date(log.timestamp).toLocaleTimeString()}
                </Typography>
              </Box>
              <Typography
                variant="body2"
                component="pre"
                sx={{
                  fontFamily: 'monospace',
                  fontSize: '0.75rem',
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-word',
                  mt: 0.5,
                }}
              >
                {log.message}
              </Typography>
            </ListItem>
          ))}
        </List>
      </TabPanel>

      <TabPanel value={tabValue} index={1}>
        <Typography variant="h6" gutterBottom>API Endpoint Tester</Typography>
        
        <Box display="flex" gap={1} mb={2}>
          <TextField
            fullWidth
            label="API Endpoint"
            value={apiTestUrl}
            onChange={(e) => setApiTestUrl(e.target.value)}
            size="small"
          />
          <Button onClick={testApiEndpoint} variant="contained">
            Test
          </Button>
        </Box>

        {apiTestResult && (
          <Card>
            <CardContent>
              {apiTestResult.loading ? (
                <Typography>Loading...</Typography>
              ) : apiTestResult.error ? (
                <Alert severity="error">{apiTestResult.error}</Alert>
              ) : (
                <Box>
                  <Typography variant="subtitle2" gutterBottom>
                    Status: {apiTestResult.status} {apiTestResult.statusText}
                  </Typography>
                  <Typography variant="caption" color="text.secondary" display="block" gutterBottom>
                    {apiTestResult.timestamp}
                  </Typography>
                  <Typography
                    component="pre"
                    sx={{
                      fontFamily: 'monospace',
                      fontSize: '0.75rem',
                      whiteSpace: 'pre-wrap',
                      backgroundColor: 'grey.100',
                      p: 1,
                      borderRadius: 1,
                      overflow: 'auto',
                      maxHeight: 300,
                    }}
                  >
                    {JSON.stringify(apiTestResult.data, null, 2)}
                  </Typography>
                </Box>
              )}
            </CardContent>
          </Card>
        )}
      </TabPanel>

      <TabPanel value={tabValue} index={2}>
        <Box display="flex" alignItems="center" justifyContent="space-between" mb={2}>
          <Typography variant="h6">React Query Cache</Typography>
          <Box>
            <Button onClick={invalidateAllQueries} startIcon={<Refresh />} sx={{ mr: 1 }}>
              Invalidate All
            </Button>
            <Button onClick={clearQueryCache} startIcon={<Clear />}>
              Clear Cache
            </Button>
          </Box>
        </Box>

        <List dense>
          {getQueryCacheData().map((query, index) => (
            <ListItem key={index}>
              <ListItemText
                primary={JSON.stringify(query.queryKey)}
                secondary={
                  <Box>
                    <Chip label={query.status} size="small" sx={{ mr: 1 }} />
                    <Chip label={query.fetchStatus} size="small" />
                    {query.dataUpdatedAt && (
                      <Typography variant="caption" display="block">
                        Updated: {new Date(query.dataUpdatedAt).toLocaleString()}
                      </Typography>
                    )}
                  </Box>
                }
              />
            </ListItem>
          ))}
        </List>
      </TabPanel>

      <TabPanel value={tabValue} index={3}>
        <Box display="flex" alignItems="center" justifyContent="space-between" mb={2}>
          <Typography variant="h6">Local Storage</Typography>
          <Button onClick={clearLocalStorage} startIcon={<Clear />}>
            Clear All
          </Button>
        </Box>

        <List dense>
          {Object.entries(getLocalStorageData()).map(([key, value]) => (
            <ListItem key={key}>
              <ListItemText
                primary={key}
                secondary={
                  <Typography
                    component="span"
                    sx={{
                      fontFamily: 'monospace',
                      fontSize: '0.75rem',
                      wordBreak: 'break-word',
                    }}
                  >
                    {value.length > 100 ? `${value.substring(0, 100)}...` : value}
                  </Typography>
                }
              />
            </ListItem>
          ))}
        </List>
      </TabPanel>

      <TabPanel value={tabValue} index={4}>
        <Typography variant="h6" gutterBottom>System Information</Typography>
        
        <Typography
          component="pre"
          sx={{
            fontFamily: 'monospace',
            fontSize: '0.75rem',
            whiteSpace: 'pre-wrap',
            backgroundColor: 'grey.100',
            p: 2,
            borderRadius: 1,
            overflow: 'auto',
          }}
        >
          {JSON.stringify(getSystemInfo(), null, 2)}
        </Typography>
      </TabPanel>
    </Drawer>
  );
};

export default DebugPanel;
