// @ts-nocheck
import React, { useState } from 'react';
import {
    Box,
    Card,
    CardContent,
    Typography,
    Accordion,
    AccordionSummary,
    AccordionDetails,
    Button,
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    Alert,
    CircularProgress,
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import SecurityIcon from '@mui/icons-material/Security';
import PrivacyTipIcon from '@mui/icons-material/PrivacyTip';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../services/api';

interface PrivacyContent {
    version: string;
    lastUpdated: string;
    content: {
        [key: string]: {
            title: string;
            description: string;
            items: string[];
        };
    };
}

export const PrivacyInfo: React.FC = () => {
    const [expandedSection, setExpandedSection] = useState<string | false>(false);
    const [showDeleteDialog, setShowDeleteDialog] = useState(false);
    const [deleteRequestId, setDeleteRequestId] = useState<string | null>(null);

    const { data: privacyPolicy, isLoading: privacyLoading } = useQuery<PrivacyContent>({
        queryKey: ['privacyPolicy'],
        queryFn: async () => {
            const response = await api.get('/privacy/privacy-policy');
            return response.data;
        },
    });

    const { data: securityInfo, isLoading: securityLoading } = useQuery<PrivacyContent>({
        queryKey: ['securityInfo'],
        queryFn: async () => {
            const response = await api.get('/privacy/security-info');
            return response.data;
        },
    });

    const { data: deletionStatus } = useQuery({
        queryKey: ['deletionStatus', deleteRequestId],
        queryFn: async () => {
            if (!deleteRequestId) return null;
            const response = await api.get(`/privacy/delete-account/status/${deleteRequestId}`);
            return response.data;
        },
        enabled: !!deleteRequestId,
        refetchInterval: (data) => {
            if (data?.status === 'pending' || data?.status === 'processing') {
                return 5000; // Poll every 5 seconds while processing
            }
            return false;
        },
    });

    const handleDeleteRequest = async () => {
        try {
            const response = await api.post('/privacy/delete-account');
            setDeleteRequestId(response.data.requestId);
            setShowDeleteDialog(false);
        } catch (error) {
            console.error('Failed to request account deletion:', error);
        }
    };

    const handleAccordionChange = (section: string) => (
        event: React.SyntheticEvent,
        isExpanded: boolean
    ) => {
        setExpandedSection(isExpanded ? section : false);
    };

    if (privacyLoading || securityLoading) {
        return (
            <Box display="flex" justifyContent="center" alignItems="center" minHeight="200px">
                <CircularProgress />
            </Box>
        );
    }

    return (
        <Box>
            {deleteRequestId && deletionStatus && (
                <Alert
                    severity={
                        deletionStatus.status === 'completed'
                            ? 'success'
                            : deletionStatus.status === 'failed'
                            ? 'error'
                            : 'info'
                    }
                    sx={{ mb: 2 }}
                >
                    {deletionStatus.status === 'pending' && (
                        'Your account deletion request has been received and will be processed within 48 hours.'
                    )}
                    {deletionStatus.status === 'processing' && (
                        'Your account deletion is currently being processed.'
                    )}
                    {deletionStatus.status === 'completed' && (
                        'Your account and all associated data have been successfully deleted.'
                    )}
                    {deletionStatus.status === 'failed' && (
                        `Failed to delete your account: ${deletionStatus.error}`
                    )}
                </Alert>
            )}

            <Card sx={{ mb: 3 }}>
                <CardContent>
                    <Box display="flex" alignItems="center" mb={2}>
                        <PrivacyTipIcon sx={{ mr: 1 }} />
                        <Typography variant="h6">Privacy Policy</Typography>
                    </Box>
                    <Typography variant="caption" color="text.secondary" display="block" gutterBottom>
                        Last updated: {privacyPolicy?.lastUpdated}
                    </Typography>

                    {privacyPolicy?.content &&
                        Object.entries(privacyPolicy.content).map(([key, section]) => (
                            <Accordion
                                key={key}
                                expanded={expandedSection === key}
                                onChange={handleAccordionChange(key)}
                            >
                                <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                                    <Typography>{section.title}</Typography>
                                </AccordionSummary>
                                <AccordionDetails>
                                    <Typography paragraph>{section.description}</Typography>
                                    <Box component="ul" sx={{ pl: 2 }}>
                                        {section.items.map((item, index) => (
                                            <Typography
                                                component="li"
                                                key={index}
                                                variant="body2"
                                                paragraph
                                            >
                                                {item}
                                            </Typography>
                                        ))}
                                    </Box>
                                </AccordionDetails>
                            </Accordion>
                        ))}
                </CardContent>
            </Card>

            <Card sx={{ mb: 3 }}>
                <CardContent>
                    <Box display="flex" alignItems="center" mb={2}>
                        <SecurityIcon sx={{ mr: 1 }} />
                        <Typography variant="h6">Security Information</Typography>
                    </Box>
                    <Typography variant="caption" color="text.secondary" display="block" gutterBottom>
                        Last updated: {securityInfo?.lastUpdated}
                    </Typography>

                    {securityInfo?.content &&
                        Object.entries(securityInfo.content).map(([key, section]) => (
                            <Accordion
                                key={key}
                                expanded={expandedSection === key}
                                onChange={handleAccordionChange(key)}
                            >
                                <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                                    <Typography>{section.title}</Typography>
                                </AccordionSummary>
                                <AccordionDetails>
                                    <Typography paragraph>{section.description}</Typography>
                                    <Box component="ul" sx={{ pl: 2 }}>
                                        {section.items.map((item, index) => (
                                            <Typography
                                                component="li"
                                                key={index}
                                                variant="body2"
                                                paragraph
                                            >
                                                {item}
                                            </Typography>
                                        ))}
                                    </Box>
                                </AccordionDetails>
                            </Accordion>
                        ))}
                </CardContent>
            </Card>

            <Card>
                <CardContent>
                    <Typography variant="h6" gutterBottom>
                        Account Deletion
                    </Typography>
                    <Typography paragraph>
                        You have the right to request deletion of your account and all associated data.
                        This process will:
                    </Typography>
                    <Box component="ul" sx={{ pl: 2, mb: 2 }}>
                        <Typography component="li" variant="body2" paragraph>
                            Delete all your uploaded PDFs and extracted data
                        </Typography>
                        <Typography component="li" variant="body2" paragraph>
                            Remove your account information and license details
                        </Typography>
                        <Typography component="li" variant="body2" paragraph>
                            Delete all associated templates and processing history
                        </Typography>
                        <Typography component="li" variant="body2" paragraph>
                            Remove your data from our systems within 48 hours
                        </Typography>
                    </Box>
                    <Button
                        variant="contained"
                        color="error"
                        onClick={() => setShowDeleteDialog(true)}
                        disabled={!!deleteRequestId}
                    >
                        Request Account Deletion
                    </Button>
                </CardContent>
            </Card>

            <Dialog
                open={showDeleteDialog}
                onClose={() => setShowDeleteDialog(false)}
                maxWidth="sm"
                fullWidth
            >
                <DialogTitle>Confirm Account Deletion</DialogTitle>
                <DialogContent>
                    <Typography paragraph>
                        Are you sure you want to delete your account? This action cannot be undone.
                    </Typography>
                    <Alert severity="warning" sx={{ mb: 2 }}>
                        All your data will be permanently deleted within 48 hours of your request.
                    </Alert>
                    <Typography variant="body2" color="text.secondary">
                        You will receive a confirmation email once the deletion is complete.
                    </Typography>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setShowDeleteDialog(false)}>Cancel</Button>
                    <Button
                        onClick={handleDeleteRequest}
                        color="error"
                        variant="contained"
                    >
                        Delete Account
                    </Button>
                </DialogActions>
            </Dialog>
        </Box>
    );
}; 