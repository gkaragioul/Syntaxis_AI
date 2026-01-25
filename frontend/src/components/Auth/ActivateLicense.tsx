// @ts-nocheck
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { ActivateLicenseInput } from '../../services/AuthService';

export const ActivateLicense: React.FC = () => {
    const navigate = useNavigate();
    const { activateLicense, error, clearError, isLoading } = useAuth();
    const [licenseKey, setLicenseKey] = useState('');
    const [validationError, setValidationError] = useState<string | null>(null);

    const validateLicenseKey = (key: string): boolean => {
        // License key format: XXXX-XXXX-XXXX-XXXX (where X is alphanumeric)
        const licenseKeyRegex = /^[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/;
        
        if (!key) {
            setValidationError('License key is required');
            return false;
        }

        if (!licenseKeyRegex.test(key.toUpperCase())) {
            setValidationError('Invalid license key format. Please use the format: XXXX-XXXX-XXXX-XXXX');
            return false;
        }

        setValidationError(null);
        return true;
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const value = e.target.value.toUpperCase();
        setLicenseKey(value);
        
        // Clear validation error when user starts typing
        if (validationError) {
            setValidationError(null);
        }
        // Clear auth error when user makes changes
        if (error) {
            clearError();
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        
        if (!validateLicenseKey(licenseKey)) {
            return;
        }

        try {
            await activateLicense({ licenseKey });
            navigate('/dashboard');
        } catch (err) {
            // Error is handled by the auth context
            console.error('License activation failed:', err);
        }
    };

    const formatLicenseKey = (value: string): string => {
        // Remove any non-alphanumeric characters
        const cleaned = value.replace(/[^A-Z0-9]/gi, '');
        
        // Format as XXXX-XXXX-XXXX-XXXX
        const parts = [];
        for (let i = 0; i < cleaned.length && i < 16; i += 4) {
            parts.push(cleaned.slice(i, i + 4));
        }
        
        return parts.join('-');
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
            <div className="max-w-md w-full space-y-8">
                <div>
                    <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
                        Activate your license
                    </h2>
                    <p className="mt-2 text-center text-sm text-gray-600">
                        Enter your license key to activate your account
                    </p>
                </div>

                <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
                    {(error || validationError) && (
                        <div className="rounded-md bg-red-50 p-4">
                            <div className="flex">
                                <div className="ml-3">
                                    <h3 className="text-sm font-medium text-red-800">
                                        {error || validationError}
                                    </h3>
                                </div>
                            </div>
                        </div>
                    )}

                    <div>
                        <label htmlFor="licenseKey" className="sr-only">
                            License Key
                        </label>
                        <input
                            id="licenseKey"
                            name="licenseKey"
                            type="text"
                            required
                            maxLength={19} // XXXX-XXXX-XXXX-XXXX format
                            className={`appearance-none rounded-md relative block w-full px-3 py-2 border ${
                                validationError ? 'border-red-300' : 'border-gray-300'
                            } placeholder-gray-500 text-gray-900 focus:outline-none focus:ring-blue-500 focus:border-blue-500 focus:z-10 sm:text-sm`}
                            placeholder="XXXX-XXXX-XXXX-XXXX"
                            value={licenseKey}
                            onChange={handleChange}
                            onBlur={(e) => {
                                const formatted = formatLicenseKey(e.target.value);
                                setLicenseKey(formatted);
                            }}
                        />
                    </div>

                    <div>
                        <button
                            type="submit"
                            disabled={isLoading}
                            className={`group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white ${
                                isLoading
                                    ? 'bg-blue-400 cursor-not-allowed'
                                    : 'bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500'
                            }`}
                        >
                            {isLoading ? (
                                <span className="absolute left-0 inset-y-0 flex items-center pl-3">
                                    <svg
                                        className="animate-spin h-5 w-5 text-white"
                                        xmlns="http://www.w3.org/2000/svg"
                                        fill="none"
                                        viewBox="0 0 24 24"
                                    >
                                        <circle
                                            className="opacity-25"
                                            cx="12"
                                            cy="12"
                                            r="10"
                                            stroke="currentColor"
                                            strokeWidth="4"
                                        ></circle>
                                        <path
                                            className="opacity-75"
                                            fill="currentColor"
                                            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                                        ></path>
                                    </svg>
                                </span>
                            ) : (
                                'Activate License'
                            )}
                        </button>
                    </div>

                    <div className="text-sm text-center text-gray-600">
                        Don't have a license key?{' '}
                        <a
                            href={`${import.meta.env.VITE_APP_URL || window.location.origin}/pricing`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="font-medium text-blue-600 hover:text-blue-500"
                        >
                            View our pricing plans
                        </a>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default ActivateLicense; 