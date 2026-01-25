import React, { useState } from 'react';
import {
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    Button,
    TextField,
    Box,
    Typography,
    Rating,
    FormControl,
    InputLabel,
    Select,
    MenuItem,
    Alert,
    CircularProgress,
} from '@mui/material';
import { useMutation } from '@tanstack/react-query';
import { HelpService } from '../../services/HelpService';

interface FeedbackDialogProps {
    open: boolean;
    onClose: () => void;
    context: string;
    articleId?: string;
}

export const FeedbackDialog: React.FC<FeedbackDialogProps> = ({
    open,
    onClose,
    context,
    articleId,
}) => {
    const [feedback, setFeedback] = useState('');
    const [rating, setRating] = useState<number | null>(null);
    const [type, setType] = useState<'bug' | 'suggestion' | 'question' | 'other'>(
        'suggestion'
    );

    const feedbackMutation = useMutation({
        mutationFn: () =>
            HelpService.submitFeedback({
                page: context,
                context: articleId || context,
                feedback,
                rating: rating || undefined,
                type,
            }),
        onSuccess: () => {
            handleClose();
        },
    });

    const handleClose = () => {
        setFeedback('');
        setRating(null);
        setType('suggestion');
        onClose();
    };

    const handleSubmit = () => {
        if (!feedback.trim()) {
            return;
        }
        feedbackMutation.mutate();
    };

    return (
        <Dialog
            open={open}
            onClose={handleClose}
            maxWidth="sm"
            fullWidth
        >
            <DialogTitle>Submit Feedback</DialogTitle>
            <DialogContent>
                {feedbackMutation.isError && (
                    <Alert
                        severity="error"
                        sx={{ mb: 2 }}
                    >
                        Failed to submit feedback. Please try again.
                    </Alert>
                )}

                <Box mb={3}>
                    <Typography
                        component="legend"
                        gutterBottom
                    >
                        How helpful was this content?
                    </Typography>
                    <Rating
                        value={rating}
                        onChange={(_, value) => setRating(value)}
                        size="large"
                    />
                </Box>

                <FormControl
                    fullWidth
                    sx={{ mb: 3 }}
                >
                    <InputLabel>Feedback Type</InputLabel>
                    <Select
                        value={type}
                        label="Feedback Type"
                        onChange={(e) =>
                            setType(
                                e.target.value as
                                    | 'bug'
                                    | 'suggestion'
                                    | 'question'
                                    | 'other'
                            )
                        }
                    >
                        <MenuItem value="bug">Bug Report</MenuItem>
                        <MenuItem value="suggestion">Suggestion</MenuItem>
                        <MenuItem value="question">Question</MenuItem>
                        <MenuItem value="other">Other</MenuItem>
                    </Select>
                </FormControl>

                <TextField
                    fullWidth
                    multiline
                    rows={4}
                    label="Your Feedback"
                    value={feedback}
                    onChange={(e) => setFeedback(e.target.value)}
                    placeholder="Please describe your feedback in detail..."
                    error={feedbackMutation.isError}
                    helperText={
                        feedbackMutation.isError
                            ? 'Failed to submit feedback'
                            : 'Your feedback helps us improve our help content'
                    }
                />
            </DialogContent>
            <DialogActions>
                <Button
                    onClick={handleClose}
                    disabled={feedbackMutation.isPending}
                >
                    Cancel
                </Button>
                <Button
                    onClick={handleSubmit}
                    variant="contained"
                    disabled={
                        !feedback.trim() ||
                        feedbackMutation.isPending
                    }
                    startIcon={
                        feedbackMutation.isPending ? (
                            <CircularProgress
                                size={20}
                                color="inherit"
                            />
                        ) : null
                    }
                >
                    Submit Feedback
                </Button>
            </DialogActions>
        </Dialog>
    );
}; 