// @ts-nocheck
import React, { useEffect, useState } from 'react';
import { Notification, NotificationStatus, NotificationType } from '../types/notifications';
import { useNotifications } from '../hooks/useNotifications';
import { formatDistanceToNow } from 'date-fns';
import { BellIcon, CheckCircleIcon, ExclamationCircleIcon, XCircleIcon } from '@heroicons/react/24/outline';

const statusIcons = {
  processing: BellIcon,
  completed: CheckCircleIcon,
  failed: ExclamationCircleIcon,
};

const statusColors = {
  processing: 'text-blue-500',
  completed: 'text-green-500',
  failed: 'text-red-500',
};

export const NotificationCenter: React.FC = () => {
  const { notifications, loading, error, markAsRead } = useNotifications();
  const [isOpen, setIsOpen] = useState(false);

  // Poll for new notifications every 10 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      // The useNotifications hook will handle the polling
    }, 10000);

    return () => clearInterval(interval);
  }, []);

  const unreadCount = notifications.filter(n => !n.read).length;

  const handleNotificationClick = async (notification: Notification) => {
    if (!notification.read) {
      await markAsRead(notification.id);
    }

    // Navigate to the appropriate page based on notification type
    if (notification.type === 'error' && notification.metadata?.errorReportId) {
      window.location.href = `/error-reports/${notification.metadata.errorReportId}`;
    } else {
      window.location.href = `/jobs/${notification.batchJobId}`;
    }
  };

  return (
    <div className="relative">
      {/* Notification Bell Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 text-gray-600 hover:text-gray-900 focus:outline-none"
      >
        <BellIcon className="h-6 w-6" />
        {unreadCount > 0 && (
          <span className="absolute top-0 right-0 inline-flex items-center justify-center px-2 py-1 text-xs font-bold leading-none text-white transform translate-x-1/2 -translate-y-1/2 bg-red-500 rounded-full">
            {unreadCount}
          </span>
        )}
      </button>

      {/* Notification Dropdown */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-80 bg-white rounded-lg shadow-lg overflow-hidden z-50">
          <div className="p-4 border-b">
            <h3 className="text-lg font-semibold text-gray-900">Notifications</h3>
          </div>

          {loading ? (
            <div className="p-4 text-center text-gray-500">Loading notifications...</div>
          ) : error ? (
            <div className="p-4 text-center text-red-500">{error}</div>
          ) : notifications.length === 0 ? (
            <div className="p-4 text-center text-gray-500">No notifications</div>
          ) : (
            <div className="max-h-96 overflow-y-auto">
              {notifications.map(notification => {
                const StatusIcon = statusIcons[notification.status];
                const statusColor = statusColors[notification.status];

                return (
                  <button
                    key={notification.id}
                    onClick={() => handleNotificationClick(notification)}
                    className={`w-full p-4 text-left border-b hover:bg-gray-50 ${
                      !notification.read ? 'bg-blue-50' : ''
                    }`}
                  >
                    <div className="flex items-start">
                      <StatusIcon className={`h-5 w-5 mt-1 ${statusColor}`} />
                      <div className="ml-3 flex-1">
                        <p className="text-sm font-medium text-gray-900">
                          {notification.message}
                        </p>
                        <p className="mt-1 text-xs text-gray-500">
                          {formatDistanceToNow(new Date(notification.createdAt), {
                            addSuffix: true,
                          })}
                        </p>
                      </div>
                      {!notification.read && (
                        <div className="ml-2 h-2 w-2 rounded-full bg-blue-500" />
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          )}

          {notifications.length > 0 && (
            <div className="p-4 border-t">
              <button
                onClick={() => window.location.href = '/notifications'}
                className="w-full text-sm text-blue-600 hover:text-blue-800"
              >
                View all notifications
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}; 