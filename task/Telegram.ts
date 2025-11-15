/**
 * TypeScript definitions for the Telegram WebApp API
 *
 * This file provides interfaces for the `window.Telegram.WebApp` object,
 * allowing for type-checking and autocompletion in TypeScript projects.
 *
 * @see https://core.telegram.org/bots/webapps
 */

declare global {
    interface Window {
        Telegram?: TelegramWebApp;
    }
}


/**
 * Main Telegram WebApp object.
 */
export interface TelegramWebApp {
    WebApp: WebApp;
}

/**
 * The main interface for the Telegram WebApp.
 */
export interface WebApp {
    /**
     * A string with raw data transferred to the Web App, convenient for validating data.
     * WARNING: Validate data from this field before using it on the bot's server.
     */
    initData: string;

    /**
     * An object with input data transferred to the Web App.
     * WARNING: Data from this field should not be trusted.
     * You should only use data from `initData` on the bot's server and only after it has been validated.
     */
    initDataUnsafe: WebAppInitData;

    /**
     * The version of the Web App API.
     */
    version: string;

    /**
     * The color scheme currently used in the Telegram app. Either "light" or "dark".
     * Also available as the CSS variable var(--tg-color-scheme).
     */
    colorScheme: "light" | "dark";

    /**
     * An object containing the current theme settings used in the Telegram app.
     */
    themeParams: ThemeParams;

    /**
     * A boolean indicating if the Web App is expanded to the full height of the viewport.
     */
    isExpanded: boolean;

    /**
     * The current height of the visible area of the Web App.
     */
    viewportHeight: number;

    /**
     * The current height of the visible area of the Web App, including the area under the keyboard.
     */
    viewportStableHeight: number;

    /**
     * A boolean indicating if the Web App is running in fullscreen mode.
     */
    isVersionAtLeast(version: string): boolean;

    /**
     * A string describing the platform on which the Telegram app is running.
     * e.g., "macos", "ios", "android", "windows", "linux", "web", "unknown".
     */
    platform: string;

    /**
     * A boolean indicating if the header is always visible.
     */
    headerColor: string;

    /**
     * A boolean indicating if the background is always visible.
     */
    backgroundColor: string;

    /**
     * An object for controlling the main button displayed in the Telegram app.
     */
    MainButton: MainButton;

    /**
     * An object for controlling the back button displayed in the Telegram app.
     */
    BackButton: BackButton;

    /**
     * An object for controlling the settings button displayed in the Telegram app.
     */
    SettingsButton: SettingsButton;

    /**
     * An object for controlling haptic feedback.
     */
    HapticFeedback: HapticFeedback;

    /**
     * An object for controlling cloud storage.
     */
    CloudStorage: CloudStorage;

    /**
     * An object for showing popups.
     */
    showPopup(params: PopupParams, callback?: (id: string) => void): void;

    /**
     * Shows a native popup with a message and an OK button.
     */
    showAlert(message: string, callback?: () => void): void;

    /**
     * Shows a native popup with a message, an OK button, and a Cancel button.
     */
    showConfirm(message: string, callback?: (isOk: boolean) => void): void;

    /**
     * Shows a native popup for scanning a QR code.
     */
    showScanQrPopup(params: ScanQrPopupParams, callback?: (text: string) => void | boolean): void;

    /**
     * Closes the QR code scanner.
     */
    closeScanQrPopup(): void;

    /**
     * Opens a link in an external browser.
     */
    openLink(url: string, options?: { try_instant_view?: boolean }): void;

    /**
     * Opens a Telegram link (e.g., t.me/username).
     */
    openTelegramLink(url: string): void;

    /**
     * Requests write access to the user's contact list.
     */
    requestWriteAccess(callback?: (isGranted: boolean) => void): void;

    /**
     * Requests the user's phone number.
     */
    requestContact(callback?: (isShared: boolean, data: { phone_number: string }) => void): void;

    /**
     * A method that informs the Telegram app that the Web App is ready to be displayed.
     */
    ready(): void;

    /**
     * A method that expands the Web App to the full height of the viewport.
     */
    expand(): void;

    /**
     * A method that closes the Web App.
     */
    close(): void;

    /**
     * A method that enables the "swipe to close" gesture.
     */
    enableClosingConfirmation(): void;

    /**
     * A method that disables the "swipe to close" gesture.
     */
    disableClosingConfirmation(): void;

    /**
     * Sets the app's header color.
     */
    setHeaderColor(color: "bg_color" | "secondary_bg_color" | string): void;

    /**
     * Sets the app's background color.
     */
    setBackgroundColor(color: "bg_color" | "secondary_bg_color" | string): void;

    /**
     * Sends data to the bot.
     */
    sendData(data: string): void;

    /**
     * Reads text from the clipboard.
     */
    readTextFromClipboard(callback?: (text: string | null) => void): void;

    /**
     * Registers an event handler.
     */
    onEvent(eventType: EventType, eventHandler: () => void): void;
    onEvent(eventType: "mainButtonClicked", eventHandler: () => void): void;
    onEvent(eventType: "backButtonClicked", eventHandler: () => void): void;
    onEvent(eventType: "settingsButtonClicked", eventHandler: () => void): void;
    onEvent(eventType: "viewportChanged", eventHandler: (payload: { isStateStable: boolean }) => void): void;
    onEvent(eventType: "themeChanged", eventHandler: () => void): void;
    onEvent(eventType: "popupClosed", eventHandler: (payload: { button_id: string | null }) => void): void;
    onEvent(eventType: "qrTextReceived", eventHandler: (payload: { data: string }) => void): void;
    onEvent(eventType: "invoiceClosed", eventHandler: (payload: { url: string; status: "paid" | "cancelled" | "failed" | "pending" }) => void): void;

    /**
     * Removes an event handler.
     */
    offEvent(eventType: EventType, eventHandler: (...args: any[]) => void): void;

    /**
     * Checks if the user has a Telegram Premium subscription.
     */
    isPremium: boolean;
}

/**
 * Describes the data structure of the `initDataUnsafe` object.
 */
export interface WebAppInitData {
    /**
     * A unique identifier for the Web App session.
     */
    query_id?: string;

    /**
     * An object describing the current user.
     */
    user?: WebAppUser;

    /**
     * An object describing the user opening the Web App from a chat.
     */
    receiver?: WebAppUser;

    /**
     * An object describing the chat from which the Web App was opened.
     */
    chat?: WebAppChat;

    /**
     * The "start" parameter passed to the bot.
     */
    start_param?: string;

    /**
     * Unix time when the data was signed.
     */
    auth_date: number;

    /**
     * A hash of all passed parameters, used to check data integrity.
     */
    hash: string;
}

/**
 * Describes a Telegram user.
 */
export interface WebAppUser {
    id: number;
    is_bot?: boolean;
    first_name: string;
    last_name?: string;
    username?: string;
    language_code?: string;
    is_premium?: boolean;
    photo_url?: string;
}

/**
 * Describes a Telegram chat.
 */
export interface WebAppChat {
    id: number;
    type: "group" | "supergroup" | "channel";
    title: string;
    username?: string;
    photo_url?: string;
}

/**
 * Describes the theme parameters.
 * These are also available as CSS variables (e.g., `var(--tg-theme-bg-color)`).
 */
export interface ThemeParams {
    bg_color: string;
    text_color: string;
    hint_color: string;
    link_color: string;
    button_color: string;
    button_text_color: string;
    secondary_bg_color: string;
    header_bg_color: string;
    accent_text_color: string;
    section_bg_color: string;
    section_header_text_color: string;
    subtitle_text_color: string;
    destructive_text_color: string;
}

/**
 * Describes the main button.
 */
export interface MainButton {
    text: string;
    color: string;
    textColor: string;
    isVisible: boolean;
    isActive: boolean;
    isProgressVisible: boolean;

    setText(text: string): MainButton;
    onClick(callback: () => void): MainButton;
    show(): MainButton;
    hide(): MainButton;
    enable(): MainButton;
    disable(): MainButton;
    showProgress(leaveActive?: boolean): MainButton;
    hideProgress(): MainButton;
    setParams(params: {
        text?: string;
        color?: string;
        text_color?: string;
        is_active?: boolean;
        is_visible?: boolean;
    }): MainButton;
}

/**
 * Describes the back button.
 */
export interface BackButton {
    isVisible: boolean;
    onClick(callback: () => void): BackButton;
    offClick(callback: () => void): BackButton;
    show(): BackButton;
    hide(): BackButton;
}

/**
 * Describes the settings button.
 */
export interface SettingsButton {
    isVisible: boolean;
    onClick(callback: () => void): SettingsButton;
    offClick(callback: () => void): SettingsButton;
    show(): SettingsButton;
    hide(): SettingsButton;
}

/**
 * Describes the haptic feedback generator.
 */
export interface HapticFeedback {
    /**
     * Triggers a haptic feedback event.
     * @param style "light" | "medium" | "heavy" | "rigid" | "soft"
     */
    impactOccurred(style: "light" | "medium" | "heavy" | "rigid" | "soft"): void;
    /**
     * Triggers a haptic feedback event.
     * @param type "success" | "warning" | "error"
     */
    notificationOccurred(type: "success" | "warning" | "error"): void;
    /**
     * Triggers a haptic feedback event.
     */
    selectionChanged(): void;
}

/**
 * Describes the cloud storage.
 */
export interface CloudStorage {
    setItem(key: string, value: string, callback?: (error: string | null) => void): void;
    getItem(key: string, callback: (error: string | null, value?: string) => void): void;
    getItems(keys: string[], callback: (error: string | null, values?: Record<string, string>) => void): void;
    deleteItem(key: string, callback?: (error: string | null) => void): void;
    deleteItems(keys: string[], callback?: (error: string | null) => void): void;
    getKeys(callback: (error: string | null, keys?: string[]) => void): void;
}

/**
 * Describes the parameters for `showPopup`.
 */
export interface PopupParams {
    title?: string;
    message: string;
    buttons?: PopupButton[];
}

/**
 * Describes a button in a popup.
 */
export interface PopupButton {
    id?: string;
    type?: "default" | "ok" | "close" | "cancel" | "destructive";
    text?: string;
}

/**
 * Describes the parameters for `showScanQrPopup`.
 */
export interface ScanQrPopupParams {
    text?: string;
}

/**
 * Valid event types for `onEvent` and `offEvent`.
 */
export type EventType =
    | "themeChanged"
    | "viewportChanged"
    | "mainButtonClicked"
    | "backButtonClicked"
    | "settingsButtonClicked"
    | "invoiceClosed"
    | "popupClosed"
    | "qrTextReceived";
