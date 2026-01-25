import React from 'react';
import {
    Box,
    Typography,
    IconButton,
    Chip,
    Button,
    Paper,
    useTheme,
} from '@mui/material';
import {
    ArrowBack as BackIcon,
    Help as HelpIcon,
    Tag as TagIcon,
    AccessTime as TimeIcon,
    Person as PersonIcon,
} from '@mui/icons-material';
import { HelpContent } from '../../services/HelpService';
import { formatDistanceToNow } from 'date-fns';

interface HelpArticleProps {
    article: HelpContent;
    onBack: () => void;
    onFeedback: () => void;
}

export const HelpArticle: React.FC<HelpArticleProps> = ({
    article,
    onBack,
    onFeedback,
}) => {
    const theme = useTheme();

    return (
        <Box>
            <Box
                display="flex"
                alignItems="center"
                justifyContent="space-between"
                mb={3}
            >
                <Box display="flex" alignItems="center">
                    <IconButton
                        onClick={onBack}
                        sx={{ mr: 2 }}
                        size="small"
                    >
                        <BackIcon />
                    </IconButton>
                    <Typography variant="h5">{article.title}</Typography>
                </Box>
                <IconButton
                    onClick={onFeedback}
                    color="primary"
                    size="small"
                >
                    <HelpIcon />
                </IconButton>
            </Box>

            <Paper
                elevation={0}
                sx={{
                    p: 3,
                    mb: 3,
                    bgcolor: 'background.default',
                    borderRadius: 2,
                }}
            >
                <Box mb={3}>
                    <Typography
                        variant="body1"
                        component="div"
                        sx={{
                            '& p': { mb: 2 },
                            '& h2': {
                                fontSize: '1.5rem',
                                fontWeight: 600,
                                mb: 2,
                                mt: 3,
                            },
                            '& h3': {
                                fontSize: '1.25rem',
                                fontWeight: 600,
                                mb: 1.5,
                                mt: 2.5,
                            },
                            '& ul, & ol': {
                                pl: 3,
                                mb: 2,
                            },
                            '& li': {
                                mb: 1,
                            },
                            '& code': {
                                bgcolor: 'action.hover',
                                px: 0.5,
                                py: 0.25,
                                borderRadius: 0.5,
                                fontFamily: 'monospace',
                            },
                            '& pre': {
                                bgcolor: 'action.hover',
                                p: 2,
                                borderRadius: 1,
                                overflowX: 'auto',
                                mb: 2,
                            },
                            '& img': {
                                maxWidth: '100%',
                                height: 'auto',
                                borderRadius: 1,
                                my: 2,
                            },
                            '& blockquote': {
                                borderLeft: `4px solid ${theme.palette.primary.main}`,
                                pl: 2,
                                py: 1,
                                my: 2,
                                bgcolor: 'action.hover',
                            },
                        }}
                    >
                        {article.content}
                    </Typography>
                </Box>

                <Box
                    display="flex"
                    flexWrap="wrap"
                    gap={1}
                    mb={3}
                >
                    {article.tags.map((tag) => (
                        <Chip
                            key={tag}
                            label={tag}
                            size="small"
                            icon={<TagIcon />}
                        />
                    ))}
                </Box>

                <Box
                    display="flex"
                    alignItems="center"
                    justifyContent="space-between"
                    flexWrap="wrap"
                    gap={2}
                >
                    <Box
                        display="flex"
                        alignItems="center"
                        gap={2}
                        flexWrap="wrap"
                    >
                        <Box
                            display="flex"
                            alignItems="center"
                            color="text.secondary"
                        >
                            <TimeIcon
                                sx={{ fontSize: 16, mr: 0.5 }}
                            />
                            <Typography variant="caption">
                                Updated{' '}
                                {formatDistanceToNow(
                                    new Date(article.lastUpdated),
                                    { addSuffix: true }
                                )}
                            </Typography>
                        </Box>
                        <Box
                            display="flex"
                            alignItems="center"
                            color="text.secondary"
                        >
                            <PersonIcon
                                sx={{ fontSize: 16, mr: 0.5 }}
                            />
                            <Typography variant="caption">
                                {article.author}
                            </Typography>
                        </Box>
                        <Chip
                            size="small"
                            label={`v${article.version}`}
                            color="primary"
                            variant="outlined"
                        />
                    </Box>

                    <Button
                        variant="outlined"
                        color="primary"
                        onClick={onFeedback}
                        startIcon={<HelpIcon />}
                    >
                        Was this helpful?
                    </Button>
                </Box>
            </Paper>
        </Box>
    );
}; 