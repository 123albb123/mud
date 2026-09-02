import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import packageJson from '../../package.json';
import type { ChatMessage } from '../protocol/gmcp/gmcp';

export const PWA_SCOPE = '/app/';
export const SERVICE_WORKER_PATH = '/app/service-worker.js';
export const CACHE_NAME_PREFIX = 'yanhuang-web-';
export const NOTIFICATION_ENABLED_KEY = 'yanhuang.client.notifications-enabled';
export const NOTIFICATION_CONTENT_KEY = 'yanhuang.client.notification-content';
export const LAST_MUD_URL_KEY = 'yanhuang.client.last-mud-url';

export type NotificationContent = 'body' | 'summary';
export type InstallPlatform = 'ios-safari' | 'ios-other' | 'android' | 'desktop' | 'unknown';
export type NotificationPermissionState = NotificationPermission | 'unsupported';
export type UpdateStatus = 'idle' | 'checking' | 'latest' | 'error';

export interface BeforeInstallPromptEvent extends Event {
    prompt: () => Promise<void>;
    userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

export interface StandaloneContext {
    matchMedia?: (query: string) => { matches: boolean };
    navigator?: { standalone?: boolean };
}

export interface PlatformContext {
    userAgent: string;
    vendor?: string;
    maxTouchPoints?: number;
}

export interface NotificationContext {
    Notification?: {
        permission: NotificationPermission;
        requestPermission: () => Promise<NotificationPermission>;
    };
}

export interface NotificationConstructor {
    new (title: string, options?: NotificationOptions): Notification;
    permission: NotificationPermission;
    requestPermission: () => Promise<NotificationPermission>;
}

export interface NotificationDeliveryContext {
    content: NotificationContent;
    notification?: NotificationConstructor;
    notificationsEnabled: boolean;
    pageVisibleAndFocused: boolean;
    permission: NotificationPermissionState;
    registration?: { showNotification?: (title: string, options?: NotificationOptions) => Promise<void> } | null;
}

export interface PwaCapabilities {
    notificationAvailable: boolean;
    secureContext: boolean;
    serviceWorkerAvailable: boolean;
}

const staticAppPaths = [
    `${PWA_SCOPE}index.html`,
    `${PWA_SCOPE}manifest.json`,
    `${PWA_SCOPE}icons/icon-192.png`,
    `${PWA_SCOPE}icons/icon-512.png`,
    `${PWA_SCOPE}icons/icon-maskable-512.png`,
    `${PWA_SCOPE}icons/apple-touch-icon.png`,
];

const notificationKinds = new Set<ChatMessage['kind']>(['tell', 'reply']);

export const clientVersion = `${packageJson.version} · ${import.meta.env.VITE_BUILD_HASH || 'local'}`;

export const getCacheName = (version: string, buildHash: string): string =>
    `${CACHE_NAME_PREFIX}v${version}-${buildHash}`;

export const createPrecacheEntries = (assetFileNames: string[]): string[] => {
    const assets = assetFileNames
        .filter((fileName) => fileName.startsWith('assets/'))
        .map((fileName) => `${PWA_SCOPE}${fileName}`);
    return [...new Set([...staticAppPaths, ...assets])];
};

export const isStandaloneMode = (context: StandaloneContext): boolean => {
    let mediaStandalone = false;
    try {
        mediaStandalone = context.matchMedia?.('(display-mode: standalone)').matches === true;
    } catch {
        mediaStandalone = false;
    }
    return mediaStandalone || context.navigator?.standalone === true;
};

export const isIosDevice = ({ userAgent, maxTouchPoints = 0 }: PlatformContext): boolean =>
    /iPad|iPhone|iPod/i.test(userAgent) || (/Macintosh/i.test(userAgent) && maxTouchPoints > 1);

export const isIosSafari = (context: PlatformContext): boolean =>
    isIosDevice(context) && /Safari/i.test(context.userAgent) &&
    !/CriOS|FxiOS|EdgiOS|OPiOS|GSA/i.test(context.userAgent);

export const getInstallPlatform = (context: PlatformContext): InstallPlatform => {
    if (isIosSafari(context)) {
        return 'ios-safari';
    }
    if (isIosDevice(context)) {
        return 'ios-other';
    }
    if (/Android/i.test(context.userAgent)) {
        return 'android';
    }
    if (context.userAgent) {
        return 'desktop';
    }
    return 'unknown';
};

export const getNotificationPermission = (context: NotificationContext): NotificationPermissionState => {
    const permission = context.Notification?.permission;
    return permission === 'default' || permission === 'granted' || permission === 'denied'
        ? permission
        : 'unsupported';
};

export const getPwaCapabilities = (context: {
    hasNotification: boolean;
    hasServiceWorker: boolean;
    isSecureContext: boolean;
}): PwaCapabilities => ({
    notificationAvailable: context.isSecureContext && context.hasNotification,
    secureContext: context.isSecureContext,
    serviceWorkerAvailable: context.isSecureContext && context.hasServiceWorker,
});

export const shouldNotifyForChat = (message: ChatMessage, pageVisibleAndFocused: boolean): boolean =>
    !pageVisibleAndFocused && message.direction === 'in' && notificationKinds.has(message.kind);

export const truncateNotificationText = (text: string, maxLength = 120): string => {
    const normalized = text.replace(/\s+/g, ' ').trim();
    if (normalized.length <= maxLength) {
        return normalized;
    }
    return `${normalized.slice(0, Math.max(1, maxLength - 1))}…`;
};

export const notificationTitle = (message: ChatMessage): string => `${message.sender.name}发来消息`;

export const notificationBody = (message: ChatMessage, content: NotificationContent): string =>
    content === 'summary' ? '收到新消息' : truncateNotificationText(message.text);

export type NotificationDelivery = 'service-worker' | 'desktop' | 'none';

export const notifyChatMessage = async (
    message: ChatMessage,
    context: NotificationDeliveryContext,
): Promise<NotificationDelivery> => {
    if (context.permission !== 'granted' || !context.notificationsEnabled ||
        !shouldNotifyForChat(message, context.pageVisibleAndFocused)) {
        return 'none';
    }

    const title = notificationTitle(message);
    const options: NotificationOptions = {
        body: notificationBody(message, context.content),
        icon: `${PWA_SCOPE}icons/icon-192.png`,
        tag: `chat-${message.message_id}`,
    };
    if (context.registration && typeof context.registration.showNotification === 'function') {
        try {
            await context.registration.showNotification(title, options);
            return 'service-worker';
        } catch {
            return 'none';
        }
    }
    if (context.notification) {
        try {
            new context.notification(title, options);
            return 'desktop';
        } catch {
            return 'none';
        }
    }
    return 'none';
};

const getStorage = (): Storage | null => {
    if (typeof window === 'undefined') {
        return null;
    }
    try {
        return window.localStorage;
    } catch {
        return null;
    }
};

export const readStoredPreference = (key: string): string | null => {
    try {
        return getStorage()?.getItem(key) ?? null;
    } catch {
        return null;
    }
};

export const writeStoredPreference = (key: string, value: string): void => {
    try {
        getStorage()?.setItem(key, value);
    } catch {
        // Storage can be blocked by private browsing or browser policy.
    }
};

export const isSafeMudUrl = (value: string): boolean => {
    try {
        const parsed = new URL(value);
        return (parsed.protocol === 'ws:' || parsed.protocol === 'wss:') &&
            parsed.username === '' && parsed.password === '' &&
            parsed.search === '' && parsed.hash === '';
    } catch {
        return false;
    }
};

const getPageProtocol = (): string =>
    typeof window === 'undefined' ? 'http:' : window.location.protocol;

export const isMudUrlCompatibleWithPage = (value: string, pageProtocol = getPageProtocol()): boolean => {
    if (!isSafeMudUrl(value)) {
        return false;
    }
    if (pageProtocol !== 'https:') {
        return true;
    }
    return new URL(value).protocol === 'wss:';
};

export const getMudUrlCompatibilityMessage = (value: string, pageProtocol = getPageProtocol()): string => {
    if (!isSafeMudUrl(value)) {
        return '请输入有效的 ws:// 或 wss:// WebSocket 地址。';
    }
    if (pageProtocol === 'https:' && new URL(value).protocol !== 'wss:') {
        return 'HTTPS 页面需要使用 wss:// WebSocket 地址。';
    }
    return '';
};

export const readLastMudUrl = (fallback: string, pageProtocol = getPageProtocol()): string => {
    const stored = readStoredPreference(LAST_MUD_URL_KEY);
    return stored && isMudUrlCompatibleWithPage(stored, pageProtocol) ? stored : fallback;
};

export const persistMudUrl = (value: string): void => {
    if (isSafeMudUrl(value)) {
        writeStoredPreference(LAST_MUD_URL_KEY, value);
    }
};

const getPlatformContext = (): PlatformContext => {
    if (typeof navigator === 'undefined') {
        return { userAgent: '' };
    }
    return {
        userAgent: navigator.userAgent,
        vendor: navigator.vendor,
        maxTouchPoints: navigator.maxTouchPoints,
    };
};

const getStandaloneContext = (): StandaloneContext => {
    if (typeof window === 'undefined') {
        return {};
    }
    return {
        matchMedia: typeof window.matchMedia === 'function' ? window.matchMedia.bind(window) : undefined,
        navigator: window.navigator as Navigator & { standalone?: boolean },
    };
};

const isSecurePage = (): boolean =>
    typeof window !== 'undefined' && window.location.protocol === 'https:' && window.isSecureContext === true;

const getInitialNotificationPermission = (): NotificationPermissionState => {
    if (!isSecurePage()) {
        return 'unsupported';
    }
    return getNotificationPermission({ Notification: window.Notification });
};

const getInitialNotificationContent = (): NotificationContent =>
    readStoredPreference(NOTIFICATION_CONTENT_KEY) === 'summary' ? 'summary' : 'body';

export const usePwa = (chatMessages: ChatMessage[]) => {
    const platform = useMemo(getPlatformContext, []);
    const capabilities = useMemo<PwaCapabilities>(() => {
        if (typeof window === 'undefined') {
            return getPwaCapabilities({ hasNotification: false, hasServiceWorker: false, isSecureContext: false });
        }
        return getPwaCapabilities({
            hasNotification: typeof window.Notification !== 'undefined',
            hasServiceWorker: typeof navigator !== 'undefined' && 'serviceWorker' in navigator,
            isSecureContext: isSecurePage(),
        });
    }, []);
    const { notificationAvailable, secureContext } = capabilities;
    const serviceWorkerAvailable = import.meta.env.PROD && capabilities.serviceWorkerAvailable;
    const installPlatform = getInstallPlatform(platform);
    const iosSafari = installPlatform === 'ios-safari';
    const [standalone, setStandalone] = useState(() => isStandaloneMode(getStandaloneContext()));
    const [isOnline, setIsOnline] = useState(() => typeof navigator === 'undefined' || navigator.onLine !== false);
    const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null);
    const [registration, setRegistration] = useState<ServiceWorkerRegistration | null>(null);
    const [updateAvailable, setUpdateAvailable] = useState(false);
    const [updateStatus, setUpdateStatus] = useState<UpdateStatus>('idle');
    const [isUpdating, setIsUpdating] = useState(false);
    const [notificationPermission, setNotificationPermission] = useState<NotificationPermissionState>(getInitialNotificationPermission);
    const [notificationsEnabled, setNotificationsEnabled] = useState(() =>
        getInitialNotificationPermission() === 'granted' && readStoredPreference(NOTIFICATION_ENABLED_KEY) === 'true',
    );
    const [notificationContent, setNotificationContentState] = useState<NotificationContent>(getInitialNotificationContent);
    const refreshAfterUpdateRef = useRef(false);
    const notifiedMessageIdsRef = useRef(new Set<string>());

    useEffect(() => {
        if (typeof window === 'undefined') {
            return undefined;
        }
        const updateOnline = () => setIsOnline(navigator.onLine !== false);
        const updateStandalone = () => setStandalone(isStandaloneMode(getStandaloneContext()));
        const onBeforeInstallPrompt = (event: Event) => {
            if (!secureContext) {
                return;
            }
            event.preventDefault();
            setInstallPrompt(event as BeforeInstallPromptEvent);
        };
        const onAppInstalled = () => {
            setInstallPrompt(null);
            setStandalone(true);
        };
        window.addEventListener('online', updateOnline);
        window.addEventListener('offline', updateOnline);
        window.addEventListener('beforeinstallprompt', onBeforeInstallPrompt);
        window.addEventListener('appinstalled', onAppInstalled);
        window.addEventListener('resize', updateStandalone, { passive: true });
        return () => {
            window.removeEventListener('online', updateOnline);
            window.removeEventListener('offline', updateOnline);
            window.removeEventListener('beforeinstallprompt', onBeforeInstallPrompt);
            window.removeEventListener('appinstalled', onAppInstalled);
            window.removeEventListener('resize', updateStandalone);
        };
    }, [secureContext]);

    useEffect(() => {
        if (!serviceWorkerAvailable || typeof navigator === 'undefined') {
            return undefined;
        }

        let disposed = false;
        let currentRegistration: ServiceWorkerRegistration | null = null;
        const markWaiting = () => {
            if (!disposed && currentRegistration?.waiting) {
                setUpdateAvailable(true);
                setUpdateStatus('idle');
            }
        };
        const onControllerChange = () => {
            if (refreshAfterUpdateRef.current) {
                window.location.reload();
            }
        };
        const onUpdateFound = () => {
            const worker = currentRegistration?.installing;
            worker?.addEventListener('statechange', () => {
                if (worker.state === 'installed' && navigator.serviceWorker.controller) {
                    markWaiting();
                }
            });
        };

        navigator.serviceWorker.addEventListener('controllerchange', onControllerChange);
        const register = async () => {
            try {
                const nextRegistration = await navigator.serviceWorker.register(SERVICE_WORKER_PATH, { scope: PWA_SCOPE });
                if (disposed) {
                    return;
                }
                currentRegistration = nextRegistration;
                setRegistration(nextRegistration);
                nextRegistration.addEventListener('updatefound', onUpdateFound);
                markWaiting();
            } catch {
                setUpdateStatus('error');
            }
        };
        void register();

        return () => {
            disposed = true;
            currentRegistration?.removeEventListener('updatefound', onUpdateFound);
            navigator.serviceWorker.removeEventListener('controllerchange', onControllerChange);
        };
    }, [serviceWorkerAvailable]);

    useEffect(() => {
        const notification = notificationAvailable && typeof window !== 'undefined'
            ? window.Notification
            : undefined;
        const permission = notificationAvailable
            ? getNotificationPermission({ Notification: notification })
            : 'unsupported';
        const pageVisibleAndFocused = typeof document !== 'undefined' &&
            document.visibilityState === 'visible' &&
            (typeof document.hasFocus !== 'function' || document.hasFocus());

        for (const message of chatMessages) {
            if (notifiedMessageIdsRef.current.has(message.message_id)) {
                continue;
            }
            notifiedMessageIdsRef.current.add(message.message_id);
            void notifyChatMessage(message, {
                content: notificationContent,
                notification,
                notificationsEnabled,
                pageVisibleAndFocused,
                permission,
                registration: serviceWorkerAvailable ? registration : null,
            });
        }
        if (notifiedMessageIdsRef.current.size > 1000) {
            notifiedMessageIdsRef.current.clear();
        }
    }, [chatMessages, notificationContent, notificationAvailable, notificationsEnabled, registration, serviceWorkerAvailable]);

    const promptInstall = useCallback(async () => {
        if (!installPrompt) {
            return null;
        }
        const prompt = installPrompt;
        setInstallPrompt(null);
        try {
            await prompt.prompt();
            return (await prompt.userChoice).outcome;
        } catch {
            return null;
        }
    }, [installPrompt]);

    const enableNotifications = useCallback(async () => {
        if (!secureContext || !notificationAvailable || typeof window === 'undefined' || typeof window.Notification === 'undefined') {
            setNotificationPermission('unsupported');
            setNotificationsEnabled(false);
            return 'unsupported' as const;
        }
        const notification = window.Notification;
        if (notification.permission === 'denied') {
            setNotificationPermission('denied');
            setNotificationsEnabled(false);
            writeStoredPreference(NOTIFICATION_ENABLED_KEY, 'false');
            return 'denied' as const;
        }
        const permission = notification.permission === 'granted'
            ? 'granted'
            : await notification.requestPermission();
        setNotificationPermission(permission);
        if (permission === 'granted') {
            setNotificationsEnabled(true);
            writeStoredPreference(NOTIFICATION_ENABLED_KEY, 'true');
        } else {
            setNotificationsEnabled(false);
            writeStoredPreference(NOTIFICATION_ENABLED_KEY, 'false');
        }
        return permission;
    }, [notificationAvailable, secureContext]);

    const disableNotifications = useCallback(() => {
        setNotificationsEnabled(false);
        writeStoredPreference(NOTIFICATION_ENABLED_KEY, 'false');
    }, []);

    const setNotificationContent = useCallback((content: NotificationContent) => {
        setNotificationContentState(content);
        writeStoredPreference(NOTIFICATION_CONTENT_KEY, content);
    }, []);

    const checkForUpdate = useCallback(async () => {
        if (!registration) {
            setUpdateStatus('error');
            return;
        }
        setUpdateStatus('checking');
        try {
            await registration.update();
            if (registration.waiting) {
                setUpdateAvailable(true);
                setUpdateStatus('idle');
            } else {
                setUpdateStatus('latest');
            }
        } catch {
            setUpdateStatus('error');
        }
    }, [registration]);

    const applyUpdate = useCallback(() => {
        const waiting = registration?.waiting;
        if (!waiting) {
            return;
        }
        refreshAfterUpdateRef.current = true;
        setIsUpdating(true);
        waiting.postMessage({ type: 'SKIP_WAITING' });
    }, [registration]);

    return {
        clientVersion,
        isOnline,
        isStandalone: standalone,
        installPlatform,
        isIosSafari: iosSafari,
        canInstall: secureContext && installPrompt !== null,
        promptInstall,
        notificationAvailable,
        secureContext,
        serviceWorkerAvailable,
        registration,
        updateAvailable,
        updateStatus,
        isUpdating,
        checkForUpdate,
        applyUpdate,
        notificationPermission,
        notificationsEnabled,
        notificationContent,
        enableNotifications,
        disableNotifications,
        setNotificationContent,
    };
};
