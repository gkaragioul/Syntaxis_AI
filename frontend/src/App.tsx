import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { Box, Container, CssBaseline, ThemeProvider } from '@mui/material';
import ErrorBoundary from './components/ErrorBoundary';
import { Header } from './components/Header';
import DeviceManagement from './pages/DeviceManagement';
import LoginPage from './pages/Login';
import RegisterPage from './pages/Register';
import ExamplePage from './pages/ExamplePage';
import { PrivacySettings } from './pages/PrivacySettings';
import { PerformanceMetrics } from './components/Performance/PerformanceMetrics';
import { useAuth } from './hooks/useAuth';
import { theme } from './theme';
import { HelpCenter } from './pages/HelpCenter';
import { OnboardingFlow } from './components/Onboarding/OnboardingFlow';
import { useOnboarding } from './hooks/useOnboarding';
import InvoiceProcessor from './pages/InvoiceProcessor';

const App: React.FC = () => {
    const { user } = useAuth();
    const { isOpen: isOnboardingOpen, closeOnboarding } = useOnboarding();

    return (
        <ThemeProvider theme={theme}>
            <CssBaseline />
            <ErrorBoundary>
                    <BrowserRouter>
                        <Box sx={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
                            <Header />
                            <Container component="main" sx={{ flexGrow: 1, py: 3 }}>
                                {user?.licenseId && (
                                    <Box sx={{ mb: 3 }}>
                                        <PerformanceMetrics />
                                    </Box>
                                )}
                                <Routes>
                                    <Route path="/" element={<InvoiceProcessor />} />
                                    <Route path="/example" element={<ExamplePage />} />
                                    <Route path="/login" element={<LoginPage />} />
                                    <Route path="/register" element={<RegisterPage />} />
                                    {user?.licenseId && (
                                        <>
                                            <Route
                                                path="/devices"
                                                element={<DeviceManagement licenseId={user.licenseId} />}
                                            />
                                            <Route
                                                path="/privacy"
                                                element={<PrivacySettings />}
                                            />
                                            <Route path="/help" element={<HelpCenter />} />
                                        </>
                                    )}
                                    {/* Add other routes here */}
                                </Routes>
                            </Container>
                            {user && (
                                <OnboardingFlow
                                    open={isOnboardingOpen}
                                    onClose={closeOnboarding}
                                />
                            )}
                        </Box>
                    </BrowserRouter>
                </ErrorBoundary>
        </ThemeProvider>
    );
};

export default App; 