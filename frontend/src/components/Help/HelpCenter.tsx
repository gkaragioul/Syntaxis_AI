// @ts-nocheck
import React, { useState } from 'react';
import {
    Box,
    Container,
    Typography,
    TextField,
    InputAdornment,
    Grid,
    Card,
    CardContent,
    CardActionArea,
    Chip,
    Tabs,
    Tab,
    IconButton,
    useTheme,
    useMediaQuery,
    Drawer,
    List,
    ListItem,
    ListItemText,
    ListItemIcon,
    Divider,
} from '@mui/material';
import {
    Search as SearchIcon,
    Menu as MenuIcon,
    Category as CategoryIcon,
    Tag as TagIcon,
    Help as HelpIcon,
    Book as BookIcon,
    Settings as SettingsIcon,
    CloudUpload as UploadIcon,
    TableChart as TableIcon,
    Save as SaveIcon,
    PlaylistAdd as BatchIcon,
    FileDownload as ExportIcon,
} from '@mui/icons-material';
import { useQuery } from '@tanstack/react-query';
import { HelpService, HelpContent } from '../../services/HelpService';
import { HelpArticle } from './HelpArticle';
import { FeedbackDialog } from './FeedbackDialog';

const categories = [
    { id: 'getting-started', label: 'Getting Started', icon: <HelpIcon /> },
    { id: 'templates', label: 'Templates', icon: <SaveIcon /> },
    { id: 'upload', label: 'Upload', icon: <UploadIcon /> },
    { id: 'extraction', label: 'Extraction', icon: <TableIcon /> },
    { id: 'batch', label: 'Batch Processing', icon: <BatchIcon /> },
    { id: 'export', label: 'Export', icon: <ExportIcon /> },
    { id: 'settings', label: 'Settings', icon: <SettingsIcon /> },
];

const popularTags = [
    'upload',
    'templates',
    'extraction',
    'batch',
    'export',
    'pdf',
    'excel',
    'csv',
    'api',
];

export const HelpCenter: React.FC = () => {
    const theme = useTheme();
    const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
    const [selectedTags, setSelectedTags] = useState<string[]>([]);
    const [selectedArticle, setSelectedArticle] = useState<HelpContent | null>(null);
    const [isFeedbackOpen, setIsFeedbackOpen] = useState(false);
    const [drawerOpen, setDrawerOpen] = useState(false);

    const { data: articles, isLoading } = useQuery({
        queryKey: ['helpContent', searchQuery, selectedCategory, selectedTags],
        queryFn: () =>
            HelpService.getHelpContent({
                category: selectedCategory || undefined,
                tags: selectedTags.length > 0 ? selectedTags : undefined,
                search: searchQuery || undefined,
            }),
    });

    const handleCategoryChange = (category: string | null) => {
        setSelectedCategory(category);
        if (isMobile) {
            setDrawerOpen(false);
        }
    };

    const handleTagClick = (tag: string) => {
        setSelectedTags((prev) =>
            prev.includes(tag)
                ? prev.filter((t) => t !== tag)
                : [...prev, tag]
        );
    };

    const handleArticleClick = (article: HelpContent) => {
        setSelectedArticle(article);
    };

    const handleFeedbackOpen = () => {
        setIsFeedbackOpen(true);
    };

    const handleFeedbackClose = () => {
        setIsFeedbackOpen(false);
    };

    const renderContent = () => {
        if (selectedArticle) {
            return (
                <HelpArticle
                    article={selectedArticle}
                    onBack={() => setSelectedArticle(null)}
                    onFeedback={handleFeedbackOpen}
                />
            );
        }

        return (
            <Box>
                <Box mb={4}>
                    <TextField
                        fullWidth
                        variant="outlined"
                        placeholder="Search help articles..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        InputProps={{
                            startAdornment: (
                                <InputAdornment position="start">
                                    <SearchIcon />
                                </InputAdornment>
                            ),
                        }}
                    />
                </Box>

                {!isMobile && (
                    <Box mb={3}>
                        <Tabs
                            value={selectedCategory}
                            onChange={(_, value) => handleCategoryChange(value)}
                            variant="scrollable"
                            scrollButtons="auto"
                        >
                            <Tab
                                label="All"
                                value={null}
                                icon={<CategoryIcon />}
                                iconPosition="start"
                            />
                            {categories.map((category) => (
                                <Tab
                                    key={category.id}
                                    label={category.label}
                                    value={category.id}
                                    icon={category.icon}
                                    iconPosition="start"
                                />
                            ))}
                        </Tabs>
                    </Box>
                )}

                <Box mb={3}>
                    <Typography variant="subtitle2" gutterBottom>
                        Popular Tags
                    </Typography>
                    <Box display="flex" flexWrap="wrap" gap={1}>
                        {popularTags.map((tag) => (
                            <Chip
                                key={tag}
                                label={tag}
                                onClick={() => handleTagClick(tag)}
                                color={
                                    selectedTags.includes(tag)
                                        ? 'primary'
                                        : 'default'
                                }
                                variant={
                                    selectedTags.includes(tag)
                                        ? 'filled'
                                        : 'outlined'
                                }
                            />
                        ))}
                    </Box>
                </Box>

                {isLoading ? (
                    <Typography>Loading...</Typography>
                ) : articles?.length === 0 ? (
                    <Typography>No articles found.</Typography>
                ) : (
                    <Grid container spacing={3}>
                        {articles?.map((article) => (
                            <Grid item xs={12} sm={6} md={4} key={article.id}>
                                <Card>
                                    <CardActionArea
                                        onClick={() => handleArticleClick(article)}
                                    >
                                        <CardContent>
                                            <Typography
                                                variant="h6"
                                                gutterBottom
                                            >
                                                {article.title}
                                            </Typography>
                                            <Typography
                                                variant="body2"
                                                color="text.secondary"
                                                noWrap
                                            >
                                                {article.content}
                                            </Typography>
                                            <Box
                                                mt={2}
                                                display="flex"
                                                gap={1}
                                                flexWrap="wrap"
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
                                        </CardContent>
                                    </CardActionArea>
                                </Card>
                            </Grid>
                        ))}
                    </Grid>
                )}
            </Box>
        );
    };

    return (
        <Container maxWidth="lg">
            <Box py={4}>
                <Box
                    display="flex"
                    alignItems="center"
                    justifyContent="space-between"
                    mb={4}
                >
                    <Box display="flex" alignItems="center">
                        {isMobile && (
                            <IconButton
                                onClick={() => setDrawerOpen(true)}
                                sx={{ mr: 2 }}
                            >
                                <MenuIcon />
                            </IconButton>
                        )}
                        <Typography variant="h4">Help Center</Typography>
                    </Box>
                    <IconButton
                        onClick={handleFeedbackOpen}
                        color="primary"
                    >
                        <HelpIcon />
                    </IconButton>
                </Box>

                {renderContent()}
            </Box>

            {/* Mobile drawer for categories */}
            <Drawer
                anchor="left"
                open={drawerOpen}
                onClose={() => setDrawerOpen(false)}
            >
                <Box sx={{ width: 250 }}>
                    <List>
                        <ListItem>
                            <ListItemText
                                primary="Categories"
                                primaryTypographyProps={{
                                    variant: 'h6',
                                }}
                            />
                        </ListItem>
                        <Divider />
                        <ListItem
                            button
                            selected={selectedCategory === null}
                            onClick={() => handleCategoryChange(null)}
                        >
                            <ListItemIcon>
                                <CategoryIcon />
                            </ListItemIcon>
                            <ListItemText primary="All" />
                        </ListItem>
                        {categories.map((category) => (
                            <ListItem
                                key={category.id}
                                button
                                selected={selectedCategory === category.id}
                                onClick={() =>
                                    handleCategoryChange(category.id)
                                }
                            >
                                <ListItemIcon>{category.icon}</ListItemIcon>
                                <ListItemText primary={category.label} />
                            </ListItem>
                        ))}
                    </List>
                </Box>
            </Drawer>

            <FeedbackDialog
                open={isFeedbackOpen}
                onClose={handleFeedbackClose}
                context="help-center"
            />
        </Container>
    );
}; 