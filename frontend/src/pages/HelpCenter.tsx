import React from 'react';
import { Box, Container, Typography, Breadcrumbs, Link } from '@mui/material';
import { Link as RouterLink } from 'react-router-dom';
import { HelpCenter as HelpCenterComponent } from '../components/Help/HelpCenter';

export const HelpCenter: React.FC = () => {
    return (
        <Container maxWidth="lg">
            <Box py={4}>
                <Breadcrumbs sx={{ mb: 4 }}>
                    <Link
                        component={RouterLink}
                        to="/dashboard"
                        color="inherit"
                    >
                        Dashboard
                    </Link>
                    <Typography color="text.primary">
                        Help Center
                    </Typography>
                </Breadcrumbs>

                <Typography
                    variant="h4"
                    component="h1"
                    gutterBottom
                >
                    Help Center
                </Typography>
                <Typography
                    variant="body1"
                    color="text.secondary"
                    paragraph
                >
                    Find answers to your questions, learn how to use our features,
                    and get help with any issues you might encounter.
                </Typography>

                <HelpCenterComponent />
            </Box>
        </Container>
    );
}; 