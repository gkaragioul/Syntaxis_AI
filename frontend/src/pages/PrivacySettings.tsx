import React from 'react';
import { Box, Container, Typography, Breadcrumbs, Link } from '@mui/material';
import { Link as RouterLink } from 'react-router-dom';
import { PrivacyInfo } from '../components/Privacy/PrivacyInfo';

export const PrivacySettings: React.FC = () => {
    return (
        <Container maxWidth="lg">
            <Box sx={{ mb: 4 }}>
                <Breadcrumbs aria-label="breadcrumb">
                    <Link
                        component={RouterLink}
                        to="/"
                        color="inherit"
                        underline="hover"
                    >
                        Dashboard
                    </Link>
                    <Typography color="text.primary">Privacy & Security</Typography>
                </Breadcrumbs>
            </Box>

            <Typography variant="h4" component="h1" gutterBottom>
                Privacy & Security Settings
            </Typography>

            <Typography variant="body1" color="text.secondary" paragraph>
                Review our privacy policy, security measures, and manage your account data.
            </Typography>

            <PrivacyInfo />
        </Container>
    );
}; 