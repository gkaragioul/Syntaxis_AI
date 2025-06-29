import { useEffect, useState } from 'react';
import { useError } from '../contexts/ErrorContext';
import { useAuth } from './useAuth';
import { api } from '../services/api';
import FingerprintJS from '@fingerprintjs/fingerprintjs';

interface UseDeviceActivationResult {
  isActivating: boolean;
  isActivated: boolean;
  error: Error | null;
  activateDevice: () => Promise<void>;
}

export function useDeviceActivation(): UseDeviceActivationResult {
  const [isActivating, setIsActivating] = useState(false);
  const [isActivated, setIsActivated] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const { user } = useAuth();
  const { showError, handleApiError } = useError();

  const generateFingerprint = async (): Promise<string> => {
    const fp = await FingerprintJS.load();
    const result = await fp.get();
    return result.visitorId;
  };

  const activateDevice = async () => {
    if (!user?.licenseId) {
      setError(new Error('No license found'));
      return;
    }

    try {
      setIsActivating(true);
      setError(null);

      const response = await api.post(`/licenses/${user.licenseId}/devices/activate`);
      
      if (response.data.device) {
        setIsActivated(true);
        // Store device ID in localStorage for future requests
        localStorage.setItem('deviceId', response.data.device.id);
      }
    } catch (error: any) {
      if (error.response?.status === 409) {
        // Handle device conflict
        const { conflict } = error.response.data.error;
        showError({
          code: 'DEVICE_CONFLICT',
          userMessage: 'This license is already active on another device',
          nextSteps: 'Please visit the device management page to deactivate the existing device',
          helpUrl: '/devices',
        });
      } else {
        handleApiError(error);
      }
      setError(error);
    } finally {
      setIsActivating(false);
    }
  };

  // Attempt to activate device on mount if we have a license
  useEffect(() => {
    if (user?.licenseId && !isActivated && !localStorage.getItem('deviceId')) {
      activateDevice();
    }
  }, [user?.licenseId]);

  return {
    isActivating,
    isActivated,
    error,
    activateDevice,
  };
}

export default useDeviceActivation; 