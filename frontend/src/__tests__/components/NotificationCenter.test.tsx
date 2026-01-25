import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { NotificationCenter } from '../../components/NotificationCenter';
import { useNotifications } from '../../hooks/useNotifications';
import { NotificationType, NotificationStatus } from '../../types/notifications';

// Mock the useNotifications hook
jest.mock('../../hooks/useNotifications');

describe('NotificationCenter', () => {
  const mockNotifications = [
    {
      id: 'notif1',
      type: NotificationType.STATUS,
      status: NotificationStatus.COMPLETED,
      message: 'Job completed successfully',
      read: false,
      createdAt: new Date().toISOString(),
      metadata: { filesProcessed: 10 },
    },
    {
      id: 'notif2',
      type: NotificationType.ERROR,
      status: NotificationStatus.FAILED,
      message: 'Job failed to process',
      read: true,
      createdAt: new Date().toISOString(),
      metadata: {
        errorType: 'EXTRACTION_ERROR',
        errorCode: 'E001',
        errorReportId: 'report123',
      },
    },
  ];

  const mockUseNotifications = {
    notifications: mockNotifications,
    unreadCount: 1,
    isLoading: false,
    error: null,
    markAsRead: jest.fn(),
    markAllAsRead: jest.fn(),
    deleteNotification: jest.fn(),
    clearAllNotifications: jest.fn(),
    fetchNotifications: jest.fn(),
  };

  beforeEach(() => {
    (useNotifications as jest.Mock).mockReturnValue(mockUseNotifications);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('renders notification center with notifications', () => {
    render(<NotificationCenter />);

    expect(screen.getByText('Notifications')).toBeInTheDocument();
    expect(screen.getByText('Job completed successfully')).toBeInTheDocument();
    expect(screen.getByText('Job failed to process')).toBeInTheDocument();
    expect(screen.getByText('1 unread')).toBeInTheDocument();
  });

  it('shows loading state', () => {
    (useNotifications as jest.Mock).mockReturnValue({
      ...mockUseNotifications,
      isLoading: true,
    });

    render(<NotificationCenter />);

    expect(screen.getByTestId('loading-spinner')).toBeInTheDocument();
  });

  it('shows error state', () => {
    (useNotifications as jest.Mock).mockReturnValue({
      ...mockUseNotifications,
      error: new Error('Failed to fetch notifications'),
    });

    render(<NotificationCenter />);

    expect(screen.getByText('Failed to fetch notifications')).toBeInTheDocument();
    expect(screen.getByText('Retry')).toBeInTheDocument();
  });

  it('marks notification as read when clicked', async () => {
    render(<NotificationCenter />);

    const unreadNotification = screen.getByText('Job completed successfully').closest('div');
    fireEvent.click(unreadNotification!);

    await waitFor(() => {
      expect(mockUseNotifications.markAsRead).toHaveBeenCalledWith('notif1');
    });
  });

  it('marks all notifications as read', async () => {
    render(<NotificationCenter />);

    const markAllButton = screen.getByText('Mark all as read');
    fireEvent.click(markAllButton);

    await waitFor(() => {
      expect(mockUseNotifications.markAllAsRead).toHaveBeenCalled();
    });
  });

  it('deletes a notification', async () => {
    render(<NotificationCenter />);

    const deleteButtons = screen.getAllByTestId('delete-notification');
    fireEvent.click(deleteButtons[0]);

    await waitFor(() => {
      expect(mockUseNotifications.deleteNotification).toHaveBeenCalledWith('notif1');
    });
  });

  it('clears all notifications', async () => {
    render(<NotificationCenter />);

    const clearAllButton = screen.getByText('Clear all');
    fireEvent.click(clearAllButton);

    // Should show confirmation dialog
    expect(screen.getByText('Are you sure you want to clear all notifications?')).toBeInTheDocument();

    const confirmButton = screen.getByText('Clear');
    fireEvent.click(confirmButton);

    await waitFor(() => {
      expect(mockUseNotifications.clearAllNotifications).toHaveBeenCalled();
    });
  });

  it('cancels clear all confirmation', () => {
    render(<NotificationCenter />);

    const clearAllButton = screen.getByText('Clear all');
    fireEvent.click(clearAllButton);

    const cancelButton = screen.getByText('Cancel');
    fireEvent.click(cancelButton);

    expect(mockUseNotifications.clearAllNotifications).not.toHaveBeenCalled();
  });

  it('retries fetching notifications on error', async () => {
    (useNotifications as jest.Mock).mockReturnValue({
      ...mockUseNotifications,
      error: new Error('Failed to fetch notifications'),
    });

    render(<NotificationCenter />);

    const retryButton = screen.getByText('Retry');
    fireEvent.click(retryButton);

    await waitFor(() => {
      expect(mockUseNotifications.fetchNotifications).toHaveBeenCalled();
    });
  });

  it('displays notification timestamps', () => {
    render(<NotificationCenter />);

    const timestamps = screen.getAllByTestId('notification-timestamp');
    expect(timestamps).toHaveLength(2);
  });

  it('displays error report link for error notifications', () => {
    render(<NotificationCenter />);

    const errorReportLink = screen.getByText('View Error Report');
    expect(errorReportLink).toBeInTheDocument();
    expect(errorReportLink).toHaveAttribute('href', '/error-reports/report123');
  });

  it('displays notification metadata', () => {
    render(<NotificationCenter />);

    expect(screen.getByText('Files processed: 10')).toBeInTheDocument();
    expect(screen.getByText('Error type: EXTRACTION_ERROR')).toBeInTheDocument();
    expect(screen.getByText('Error code: E001')).toBeInTheDocument();
  });

  it('handles empty notifications list', () => {
    (useNotifications as jest.Mock).mockReturnValue({
      ...mockUseNotifications,
      notifications: [],
      unreadCount: 0,
    });

    render(<NotificationCenter />);

    expect(screen.getByText('No notifications')).toBeInTheDocument();
  });

  it('updates unread count when marking notifications as read', async () => {
    const { rerender } = render(<NotificationCenter />);

    expect(screen.getByText('1 unread')).toBeInTheDocument();

    // Simulate marking all as read
    (useNotifications as jest.Mock).mockReturnValue({
      ...mockUseNotifications,
      unreadCount: 0,
    });

    rerender(<NotificationCenter />);

    expect(screen.getByText('0 unread')).toBeInTheDocument();
  });
}); 