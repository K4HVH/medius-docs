import { Component, JSX, Show, createContext, useContext, createSignal, For } from 'solid-js';
import { Portal } from 'solid-js/web';
import { BsX, BsCheckCircleFill, BsExclamationTriangleFill, BsInfoCircleFill, BsXCircleFill } from 'solid-icons/bs';
import { Card } from '../surfaces/Card';
import { Button } from '../inputs/Button';
import '../../styles/components/feedback/Notification.css';

export type NotificationVariant = 'success' | 'error' | 'warning' | 'info';
export type NotificationPosition = 'top-right' | 'top-center' | 'bottom-right' | 'bottom-center';

export interface NotificationAction {
  label: string;
  onClick: () => void;
}

export interface NotificationOptions {
  id?: string;
  variant?: NotificationVariant;
  title: string;
  message?: string;
  duration?: number | null; // null = persistent
  position?: NotificationPosition;
  actions?: NotificationAction[];
  onClose?: () => void;
}

interface NotificationItem extends NotificationOptions {
  id: string;
  dismissing?: boolean;
}

interface NotificationContextType {
  notify: (options: NotificationOptions) => string;
  dismiss: (id: string) => void;
  dismissAll: () => void;
}

const NotificationContext = createContext<NotificationContextType>();

export const useNotification = () => {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error('useNotification must be used within NotificationProvider');
  }
  return context;
};

export const NotificationProvider: Component<{ children: JSX.Element }> = (props) => {
  const [notifications, setNotifications] = createSignal<NotificationItem[]>([]);
  let idCounter = 0;

  const notify = (options: NotificationOptions): string => {
    const id = options.id || `notification-${++idCounter}`;
    const notification: NotificationItem = {
      variant: 'info',
      duration: 5000,
      position: 'top-right',
      ...options,
      id,
    };

    setNotifications((prev) => [...prev, notification]);

    if (notification.duration !== null && notification.duration !== undefined && notification.duration > 0) {
      setTimeout(() => {
        dismiss(id);
      }, notification.duration);
    }

    return id;
  };

  const dismiss = (id: string) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, dismissing: true } : n))
    );

    setTimeout(() => {
      setNotifications((prev) => {
        const notification = prev.find((n) => n.id === id);
        if (notification?.onClose) {
          notification.onClose();
        }
        return prev.filter((n) => n.id !== id);
      });
    }, 300); // Match animation duration
  };

  const dismissAll = () => {
    setNotifications([]);
  };

  const getNotificationsByPosition = (position: NotificationPosition) => {
    return notifications().filter((n) => (n.position || 'top-right') === position);
  };

  return (
    <NotificationContext.Provider value={{ notify, dismiss, dismissAll }}>
      {props.children}
      <Portal>
        <div class="notification-container notification-container--top-right">
          <For each={getNotificationsByPosition('top-right')}>
            {(notification) => (
              <NotificationItem notification={notification} onDismiss={() => dismiss(notification.id)} />
            )}
          </For>
        </div>
        <div class="notification-container notification-container--top-center">
          <For each={getNotificationsByPosition('top-center')}>
            {(notification) => (
              <NotificationItem notification={notification} onDismiss={() => dismiss(notification.id)} />
            )}
          </For>
        </div>
        <div class="notification-container notification-container--bottom-right">
          <For each={getNotificationsByPosition('bottom-right')}>
            {(notification) => (
              <NotificationItem notification={notification} onDismiss={() => dismiss(notification.id)} />
            )}
          </For>
        </div>
        <div class="notification-container notification-container--bottom-center">
          <For each={getNotificationsByPosition('bottom-center')}>
            {(notification) => (
              <NotificationItem notification={notification} onDismiss={() => dismiss(notification.id)} />
            )}
          </For>
        </div>
      </Portal>
    </NotificationContext.Provider>
  );
};

interface NotificationItemProps {
  notification: NotificationItem;
  onDismiss: () => void;
}

const NotificationItem: Component<NotificationItemProps> = (props) => {
  const variant = () => props.notification.variant || 'info';

  const getIcon = () => {
    switch (variant()) {
      case 'success':
        return BsCheckCircleFill;
      case 'error':
        return BsXCircleFill;
      case 'warning':
        return BsExclamationTriangleFill;
      case 'info':
        return BsInfoCircleFill;
    }
  };

  const classNames = () => {
    const classes = ['notification'];
    classes.push(`notification--${variant()}`);
    if (props.notification.dismissing) {
      classes.push('notification--dismissing');
    }
    return classes.join(' ');
  };

  const Icon = getIcon();

  return (
    <div class={classNames()} role="alert">
      <Card variant="emphasized" padding="normal">
        <div class="notification__wrapper">
          <div class="notification__icon">
            <Icon />
          </div>
          <div class="notification__content">
            <div class="notification__title">{props.notification.title}</div>
            <Show when={props.notification.message}>
              <div class="notification__message">{props.notification.message}</div>
            </Show>
            <Show when={props.notification.actions && props.notification.actions.length > 0}>
              <div class="notification__actions">
                <For each={props.notification.actions}>
                  {(action) => (
                    <Button
                      variant="subtle"
                      size="compact"
                      class="notification__action"
                      onClick={() => {
                        action.onClick();
                        props.onDismiss();
                      }}
                    >
                      {action.label}
                    </Button>
                  )}
                </For>
              </div>
            </Show>
          </div>
          <button
            type="button"
            class="notification__close"
            onClick={props.onDismiss}
            aria-label="Close notification"
          >
            <BsX />
          </button>
        </div>
      </Card>
    </div>
  );
};
