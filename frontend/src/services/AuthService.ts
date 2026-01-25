import axios from 'axios';
import { API_BASE_URL } from '../config';

export interface User {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
}

export interface Device {
    id: string;
    name: string;
    type: string;
    browserInfo?: string;
    isActive: boolean;
    lastActiveAt?: string;
    activatedAt: string;
}

export interface License {
    id: string;
    type: 'trial' | 'subscription' | 'lifetime';
    status: 'active' | 'expired' | 'revoked';
    validFrom: string;
    validUntil: string;
    maxDevices: number;
    activatedDevices: number;
    createdAt: string;
}

export interface AuthTokens {
    accessToken: string;
    refreshToken: string;
}

export interface LoginResponse {
    user: User;
    tokens: AuthTokens;
    device: Device;
    license: License | null;
}

export interface RegisterInput {
    email: string;
    password: string;
    firstName: string;
    lastName: string;
}

export interface LoginInput {
    email: string;
    password: string;
}

export interface ActivateLicenseInput {
    licenseKey: string;
}

class AuthService {
    private static API_URL = `${(API_BASE_URL || '').replace(/\/+$/,'')}/api/v1/auth`;
    private static TOKEN_KEY = 'auth_tokens';
    private static USER_KEY = 'auth_user';

    // Token management
    private static getStoredTokens(): AuthTokens | null {
        const tokens = localStorage.getItem(this.TOKEN_KEY);
        return tokens ? JSON.parse(tokens) : null;
    }

    private static setStoredTokens(tokens: AuthTokens | null): void {
        if (tokens) {
            localStorage.setItem(this.TOKEN_KEY, JSON.stringify(tokens));
        } else {
            localStorage.removeItem(this.TOKEN_KEY);
        }
    }

    private static getStoredUser(): User | null {
        const user = localStorage.getItem(this.USER_KEY);
        return user ? JSON.parse(user) : null;
    }

    private static setStoredUser(user: User | null): void {
        if (user) {
            localStorage.setItem(this.USER_KEY, JSON.stringify(user));
        } else {
            localStorage.removeItem(this.USER_KEY);
        }
    }

    // API calls
    static async register(input: RegisterInput): Promise<User> {
        const response = await axios.post(`${this.API_URL}/register`, input);
        return response.data.user;
    }

    static async login(input: LoginInput): Promise<LoginResponse> {
        const response = await axios.post(`${this.API_URL}/login`, input);
        const { user, tokens, device, license } = response.data;
        
        this.setStoredTokens(tokens);
        this.setStoredUser(user);
        
        return { user, tokens, device, license };
    }

    static async refreshToken(): Promise<AuthTokens> {
        const tokens = this.getStoredTokens();
        if (!tokens?.refreshToken) {
            throw new Error('No refresh token available');
        }

        const response = await axios.post(`${this.API_URL}/refresh-token`, {
            refreshToken: tokens.refreshToken
        });

        const newTokens = response.data.tokens;
        this.setStoredTokens(newTokens);
        return newTokens;
    }

    static async activateLicense(input: ActivateLicenseInput): Promise<{ license: License; device: Device }> {
        const tokens = this.getStoredTokens();
        if (!tokens?.accessToken) {
            throw new Error('Not authenticated');
        }

        const response = await axios.post(
            `${this.API_URL}/activate-license`,
            input,
            {
                headers: { Authorization: `Bearer ${tokens.accessToken}` }
            }
        );

        return {
            license: response.data.license,
            device: response.data.device
        };
    }

    static async getDevices(): Promise<Device[]> {
        const tokens = this.getStoredTokens();
        if (!tokens?.accessToken) {
            throw new Error('Not authenticated');
        }

        const response = await axios.get(`${this.API_URL}/devices`, {
            headers: { Authorization: `Bearer ${tokens.accessToken}` }
        });

        return response.data.devices;
    }

    static async deactivateDevice(deviceId: string): Promise<void> {
        const tokens = this.getStoredTokens();
        if (!tokens?.accessToken) {
            throw new Error('Not authenticated');
        }

        await axios.post(
            `${this.API_URL}/devices/${deviceId}/deactivate`,
            {},
            {
                headers: { Authorization: `Bearer ${tokens.accessToken}` }
            }
        );
    }

    static async getLicenses(): Promise<License[]> {
        const tokens = this.getStoredTokens();
        if (!tokens?.accessToken) {
            throw new Error('Not authenticated');
        }

        const response = await axios.get(`${this.API_URL}/licenses`, {
            headers: { Authorization: `Bearer ${tokens.accessToken}` }
        });

        return response.data.licenses;
    }

    // Auth state management
    static isAuthenticated(): boolean {
        return !!this.getStoredTokens()?.accessToken;
    }

    static getCurrentUser(): User | null {
        return this.getStoredUser();
    }

    static getAccessToken(): string | null {
        return this.getStoredTokens()?.accessToken || null;
    }

    static logout(): void {
        this.setStoredTokens(null);
        this.setStoredUser(null);
    }

    // Axios interceptor setup
    static setupAxiosInterceptors(): void {
        axios.interceptors.request.use(
            (config) => {
                const tokens = this.getStoredTokens();
                if (tokens?.accessToken) {
                    config.headers.Authorization = `Bearer ${tokens.accessToken}`;
                }
                return config;
            },
            (error) => Promise.reject(error)
        );

        axios.interceptors.response.use(
            (response) => response,
            async (error) => {
                const originalRequest = error.config;

                // If error is 401 and we haven't tried to refresh the token yet
                if (error.response?.status === 401 && !originalRequest._retry) {
                    originalRequest._retry = true;

                    try {
                        const tokens = await this.refreshToken();
                        originalRequest.headers.Authorization = `Bearer ${tokens.accessToken}`;
                        return axios(originalRequest);
                    } catch (refreshError) {
                        // If refresh token fails, logout user
                        this.logout();
                        return Promise.reject(refreshError);
                    }
                }

                return Promise.reject(error);
            }
        );
    }
}

// Initialize axios interceptors
AuthService.setupAxiosInterceptors();

export default AuthService; 