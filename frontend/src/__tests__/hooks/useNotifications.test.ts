import { renderHook, act } from '@testing-library/react-hooks';
import { useNotifications } from '../../hooks/useNotifications';
import { api } from '../../services/api';
import { NotificationType, NotificationStatus } from '../../types/notifications';

// Mock api service
jest.mock('../../services/api');

describe('useNotifications', () => {
  const mockNotifications = [
    {
      id: 'notif1',
      type: NotificationType.STATUS,
      status: NotificationStatus.COMPLETED,
      message: 'Job completed successfully',
      read: false,
      createdAt: '2024-03-20T10:00:00Z',
      metadata: { filesProcessed: 10 },
    },
    {
      id: 'notif2',
      type: NotificationType.ERROR,
      status: NotificationStatus.FAILED,
      message: 'Job failed to process',
      read: true,
      createdAt: '2024-03-20T10:05:00Z',
      metadata: {
        errorType: 'EXTRACTION_ERROR',
        errorCode: 'E001',
        errorReportId: 'report123',
      },
    },
  ];

  beforeEach(() => {
    (api.getNotifications as jest.Mock).mockResolvedValue({
      notifications: mockNotifications,
      total: 2,
      unreadCount: 1,
    });
    (api.markNotificationAsRead as jest.Mock).mockResolvedValue({ ...mockNotifications[0], read: true });
    (api.markAllNotificationsAsRead as jest.Mock).mockResolvedValue({ success: true });
    (api.deleteNotification as jest.Mock).mockResolvedValue({ success: true });
    (api.clearAllNotifications as jest.Mock).mockResolvedValue({ success: true });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('fetches notifications on mount', async () => {
    const { result, waitForNextUpdate } = renderHook(() => useNotifications());

    expect(result.current.isLoading).toBe(true);
    expect(result.current.error).toBe(null);

    await waitForNextUpdate();

    expect(result.current.notifications).toEqual(mockNotifications);
    expect(result.current.unreadCount).toBe(1);
    expect(result.current.isLoading).toBe(false);
    expect(result.current.error).toBe(null);
    expect(api.getNotifications).toHaveBeenCalledWith({ limit: 10, offset: 0 });
  });

  it('handles fetch error', async () => {
    const error = new Error('Failed to fetch notifications');
    (api.getNotifications as jest.Mock).mockRejectedValue(error);

    const { result, waitForNextUpdate } = renderHook(() => useNotifications());

    await waitForNextUpdate();

    expect(result.current.isLoading).toBe(false);
    expect(result.current.error).toBe(error);
    expect(result.current.notifications).toEqual([]);
  });

  it('marks notification as read', async () => {
    const { result, waitForNextUpdate } = renderHook(() => useNotifications());

    await waitForNextUpdate();

    await act(async () => {
      await result.current.markAsRead('notif1');
    });

    expect(api.markNotificationAsRead).toHaveBeenCalledWith('notif1');
    expect(result.current.notifications[0].read).toBe(true);
    expect(result.current.unreadCount).toBe(0);
  });

  it('marks all notifications as read', async () => {
    const { result, waitForNextUpdate } = renderHook(() => useNotifications());

    await waitForNextUpdate();

    await act(async () => {
      await result.current.markAllAsRead();
    });

    expect(api.markAllNotificationsAsRead).toHaveBeenCalled();
    expect(result.current.notifications.every(n => n.read)).toBe(true);
    expect(result.current.unreadCount).toBe(0);
  });

  it('deletes a notification', async () => {
    const { result, waitForNextUpdate } = renderHook(() => useNotifications());

    await waitForNextUpdate();

    await act(async () => {
      await result.current.deleteNotification('notif1');
    });

    expect(api.deleteNotification).toHaveBeenCalledWith('notif1');
    expect(result.current.notifications).toHaveLength(1);
    expect(result.current.notifications[0].id).toBe('notif2');
  });

  it('clears all notifications', async () => {
    const { result, waitForNextUpdate } = renderHook(() => useNotifications());

    await waitForNextUpdate();

    await act(async () => {
      await result.current.clearAllNotifications();
    });

    expect(api.clearAllNotifications).toHaveBeenCalled();
    expect(result.current.notifications).toEqual([]);
    expect(result.current.unreadCount).toBe(0);
  });

  it('refreshes notifications', async () => {
    const { result, waitForNextUpdate } = renderHook(() => useNotifications());

    await waitForNextUpdate();

    const updatedNotifications = [
      {
        ...mockNotifications[0],
        message: 'Updated message',
      },
    ];

    (api.getNotifications as jest.Mock).mockResolvedValueOnce({
      notifications: updatedNotifications,
      total: 1,
      unreadCount: 1,
    });

    await act(async () => {
      await result.current.fetchNotifications();
    });

    expect(api.getNotifications).toHaveBeenCalledTimes(2);
    expect(result.current.notifications).toEqual(updatedNotifications);
  });

  it('handles pagination', async () => {
    const { result, waitForNextUpdate } = renderHook(() => useNotifications());

    await waitForNextUpdate();

    const nextPageNotifications = [
      {
        id: 'notif3',
        type: NotificationType.STATUS,
        status: NotificationStatus.PROCESSING,
        message: 'Job in progress',
        read: false,
        createdAt: '2024-03-20T10:10:00Z',
        metadata: { progress: 50 },
      },
    ];

    (api.getNotifications as jest.Mock).mockResolvedValueOnce({
      notifications: nextPageNotifications,
      total: 3,
      unreadCount: 2,
    });

    await act(async () => {
      await result.current.fetchNotifications({ limit: 10, offset: 10 });
    });

    expect(api.getNotifications).toHaveBeenCalledWith({ limit: 10, offset: 10 });
    expect(result.current.notifications).toEqual(nextPageNotifications);
  });

  it('handles mark as read error', async () => {
    const error = new Error('Failed to mark as read');
    (api.markNotificationAsRead as jest.Mock).mockRejectedValue(error);

    const { result, waitForNextUpdate } = renderHook(() => useNotifications());

    await waitForNextUpdate();

    await act(async () => {
      await expect(result.current.markAsRead('notif1')).rejects.toThrow('Failed to mark as read');
    });

    expect(result.current.notifications[0].read).toBe(false);
    expect(result.current.unreadCount).toBe(1);
  });

  it('handles delete error', async () => {
    const error = new Error('Failed to delete notification');
    (api.deleteNotification as jest.Mock).mockRejectedValue(error);

    const { result, waitForNextUpdate } = renderHook(() => useNotifications());

    await waitForNextUpdate();

    await act(async () => {
      await expect(result.current.deleteNotification('notif1')).rejects.toThrow('Failed to delete notification');
    });

    expect(result.current.notifications).toEqual(mockNotifications);
  });

  it('handles clear all error', async () => {
    const error = new Error('Failed to clear notifications');
    (api.clearAllNotifications as jest.Mock).mockRejectedValue(error);

    const { result, waitForNextUpdate } = renderHook(() => useNotifications());

    await waitForNextUpdate();

    await act(async () => {
      await expect(result.current.clearAllNotifications()).rejects.toThrow('Failed to clear notifications');
    });

    expect(result.current.notifications).toEqual(mockNotifications);
  });

  it('updates unread count when marking notifications as read', async () => {
    const { result, waitForNextUpdate } = renderHook(() => useNotifications());

    await waitForNextUpdate();

    expect(result.current.unreadCount).toBe(1);

    await act(async () => {
      await result.current.markAsRead('notif1');
    });

    expect(result.current.unreadCount).toBe(0);
  });

  it('maintains notification order by creation date', async () => {
    const unsortedNotifications = [
      {
        ...mockNotifications[1],
        createdAt: '2024-03-20T10:00:00Z',
      },
      {
        ...mockNotifications[0],
        createdAt: '2024-03-20T10:05:00Z',
      },
    ];

    (api.getNotifications as jest.Mock).mockResolvedValueOnce({
      notifications: unsortedNotifications,
      total: 2,
      unreadCount: 1,
    });

    const { result, waitForNextUpdate } = renderHook(() => useNotifications());

    await waitForNextUpdate();

    expect(result.current.notifications[0].createdAt).toBe('2024-03-20T10:05:00Z');
    expect(result.current.notifications[1].createdAt).toBe('2024-03-20T10:00:00Z');
  });
}); 