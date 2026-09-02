/**
 * @vitest-environment jsdom
 * @vitest-environment-options {"url":"https://mud.example.test/app/index.html"}
 */
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ChatMessage } from '../protocol/gmcp/gmcp';
import {
    NOTIFICATION_ENABLED_KEY,
    type BeforeInstallPromptEvent,
    usePwa,
} from './pwa';

const incomingTell: ChatMessage = {
    version: 1,
    message_id: 'hook-notification-1',
    timestamp: 1,
    kind: 'tell',
    direction: 'in',
    sender: { name: '张三', id: 'player-1' },
    text: '后台私聊正文',
};

const publicSay: ChatMessage = {
    ...incomingTell,
    message_id: 'hook-notification-2',
    kind: 'say',
};

type NotificationRecord = { title: string; options: NotificationOptions | undefined };

class NotificationStub {
    static permission: NotificationPermission = 'default';
    static requestPermission = vi.fn(async () => NotificationStub.permission);

    constructor(public readonly title: string, public readonly options?: NotificationOptions) {}
}

const Harness = ({ messages }: { messages: ChatMessage[] }) => {
    const pwa = usePwa(messages);
    return <>
        <button disabled={!pwa.canInstall} onClick={() => { void pwa.promptInstall(); }} type="button">install</button>
        <span data-testid="secure-context">{String(pwa.secureContext)}</span>
        <span data-testid="notification-available">{String(pwa.notificationAvailable)}</span>
        <button disabled={!pwa.notificationAvailable} onClick={() => { void pwa.enableNotifications(); }} type="button">enable notifications</button>
    </>;
};

const installNotificationStub = (permission: NotificationPermission) => {
    NotificationStub.permission = permission;
    NotificationStub.requestPermission.mockClear();
    vi.stubGlobal('Notification', NotificationStub);
    Object.defineProperty(window, 'Notification', {
        configurable: true,
        value: NotificationStub,
    });
};

describe('PWA hook behavior', () => {
    beforeEach(() => {
        localStorage.clear();
        Object.defineProperty(window, 'isSecureContext', {
            configurable: true,
            value: true,
        });
        installNotificationStub('default');
    });

    afterEach(() => {
        vi.restoreAllMocks();
        vi.unstubAllGlobals();
        Object.defineProperty(document, 'visibilityState', {
            configurable: true,
            value: 'visible',
        });
        Object.defineProperty(window, 'isSecureContext', {
            configurable: true,
            value: false,
        });
    });

    it('does not request notification permission until the user clicks', async () => {
        render(<Harness messages={[]} />);

        expect(NotificationStub.requestPermission).not.toHaveBeenCalled();
        fireEvent.click(screen.getByRole('button', { name: 'enable notifications' }));
        await waitFor(() => expect(NotificationStub.requestPermission).toHaveBeenCalledTimes(1));
    });

    it('does not request again after notification permission is denied', async () => {
        installNotificationStub('denied');
        render(<Harness messages={[]} />);

        fireEvent.click(screen.getByRole('button', { name: 'enable notifications' }));
        await waitFor(() => expect(screen.getByRole('button', { name: 'enable notifications' })).toBeInTheDocument());
        expect(NotificationStub.requestPermission).not.toHaveBeenCalled();
    });

    it('keeps the game usable but hides notification capability on an insecure HTTP page', () => {
        Object.defineProperty(window, 'isSecureContext', { configurable: true, value: false });
        render(<Harness messages={[]} />);

        expect(screen.getByTestId('secure-context')).toHaveTextContent('false');
        expect(screen.getByTestId('notification-available')).toHaveTextContent('false');
        expect(screen.getByRole('button', { name: 'enable notifications' })).toBeDisabled();
        expect(NotificationStub.requestPermission).not.toHaveBeenCalled();
    });

    it('notifies for an unfocused incoming private message, not public or focused messages', async () => {
        const records: NotificationRecord[] = [];
        const OriginalNotification = NotificationStub;
        class RecordingNotification extends OriginalNotification {
            constructor(title: string, options?: NotificationOptions) {
                super(title, options);
                records.push({ title, options });
            }
        }
        RecordingNotification.permission = 'granted';
        RecordingNotification.requestPermission = vi.fn(async () => 'granted' as NotificationPermission);
        vi.stubGlobal('Notification', RecordingNotification);
        Object.defineProperty(window, 'Notification', { configurable: true, value: RecordingNotification });
        localStorage.setItem(NOTIFICATION_ENABLED_KEY, 'true');
        Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'hidden' });
        vi.spyOn(document, 'hasFocus').mockReturnValue(false);

        const view = render(<Harness messages={[incomingTell, publicSay]} />);
        await waitFor(() => expect(records).toHaveLength(1));
        expect(records[0]).toEqual({ title: '张三发来消息', options: expect.objectContaining({ body: '后台私聊正文' }) });

        Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'visible' });
        vi.spyOn(document, 'hasFocus').mockReturnValue(true);
        view.rerender(<Harness messages={[incomingTell, publicSay, { ...incomingTell, message_id: 'hook-notification-3' }]} />);
        await waitFor(() => expect(records).toHaveLength(1));
    });

    it('waits for a click before invoking the Android install prompt', async () => {
        const prompt = vi.fn(async () => undefined);
        const userChoice = Promise.resolve({ outcome: 'accepted' as const, platform: 'web' });
        render(<Harness messages={[]} />);

        const event = new Event('beforeinstallprompt', { cancelable: true }) as BeforeInstallPromptEvent;
        Object.assign(event, { prompt, userChoice });
        window.dispatchEvent(event);
        const installButton = screen.getByRole('button', { name: 'install' });
        await waitFor(() => expect(installButton).toBeEnabled());
        expect(prompt).not.toHaveBeenCalled();
        fireEvent.click(installButton);
        await waitFor(() => expect(prompt).toHaveBeenCalledTimes(1));
    });
});
