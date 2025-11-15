import React, { useState, useEffect, FormEvent, useMemo } from 'react';

// --- Глобальный объект Telegram (для TypeScript) ---
declare global {
    interface Window {
        Telegram: {
            WebApp: {
                ready: () => void;
                initData: string; // Важно: используем initData для отправки на бэкенд
                initDataUnsafe: {
                    user?: {
                        id: number;
                        first_name: string;
                        last_name?: string;
                        username?: string;
                    };
                };
                themeParams: {
                    bg_color?: string;
                    text_color?: string;
                    hint_color?: string;
                    link_color?: string;
                    button_color?: string;
                    button_text_color?: string;
                    secondary_bg_color?: string;
                };
                MainButton: {
                    setText: (text: string) => void;
                    show: () => void;
                    hide: () => void;
                    onClick: (callback: () => void) => void;
                };
                BackButton: {
                    show: () => void;
                    hide: () => void;
                    onClick: (callback: () => void) => void;
                };
                expand: () => void;
            };
        };
    }
}

// --- Типы данных (из app_details.md) ---

type UserRole = 'user' | 'admin';

interface User {
    id: string;
    name: string;
    role: UserRole;
}

interface TaskSummary {
    id: string;
    title: string;
    project: string;
    deadline: string;
}

interface TaskDetails extends TaskSummary {
    assignee: string;
    group: string;
    description: string;
    startTime: string;
}

interface GroupSummary {
    id: string;
    name: string;
    avatarUrl: string;
}

interface GroupDetails extends GroupSummary {
    members: { id: string; name: string }[];
    description: string;
}

type Page =
    | 'myTasks'
    | 'taskDetails'
    | 'myGroups'
    | 'groupDetails'
    | 'adminCreateTask'
    | 'adminCreateGroup'
    | 'adminAllGroups';

// --- Настоящий API Сервис ---

/**
 * Вспомогательная функция-обертка для fetch
 */
const apiFetch = async (
    apiBaseUrl: string,
    endpoint: string,
    options: RequestInit = {}
) => {
    const url = `${apiBaseUrl}${endpoint}`;
    const tgInitData = window.Telegram?.WebApp?.initData;

    const headers = new Headers(options.headers || {});
    if (tgInitData) {
        headers.set('Authorization', `tma ${tgInitData}`);
    }
    // Для FormData Content-Type не устанавливается, браузер делает это сам
    if (options.body && !(options.body instanceof FormData)) {
        headers.set('Content-Type', 'application/json');
    }

    const response = await fetch(url, { ...options, headers });

    if (!response.ok) {
        // Пытаемся получить ошибку в виде JSON, иначе берем текст
        try {
            const errorData = await response.json();
            throw new Error(`API Error (${response.status}): ${errorData.message || JSON.stringify(errorData)}`);
        } catch {
            const errorText = await response.text();
            throw new Error(`API Error (${response.status}): ${errorText || response.statusText}`);
        }
    }

    // Если тело ответа пустое (например, 204 No Content)
    const contentType = response.headers.get('content-type');
    if (!contentType || !contentType.includes('application/json')) {
        return null;
    }

    return response.json();
};

/**
 * Создает экземпляр API-сервиса
 */
const createApiService = (apiBaseUrl: string) => {
    return {
        fetchUserData: (): Promise<User> => {
            return apiFetch(apiBaseUrl, '/api/auth/me', {
                method: 'POST',
                body: JSON.stringify({
                    initData: window.Telegram?.WebApp?.initData,
                }),
            });
        },

        fetchUserTasks: (): Promise<TaskSummary[]> => {
            return apiFetch(apiBaseUrl, '/api/user/tasks', { method: 'GET' });
        },

        /**
         * @CUSTOMIZED: Используем POST с JSON для получения деталей по ID
         */
        fetchTaskDetails: (taskId: string): Promise<TaskDetails> => {
            return apiFetch(apiBaseUrl, '/api/taskDetails', {
                method: 'POST',
                body: JSON.stringify({ taskId }),
            });
        },

        fetchUserGroups: (): Promise<GroupSummary[]> => {
            return apiFetch(apiBaseUrl, '/api/user/groups', { method: 'GET' });
        },

        fetchGroupDetails: (groupId: string): Promise<GroupDetails> => {
            return apiFetch(apiBaseUrl, `/api/groups/${groupId}`, { method: 'GET' });
        },

        // --- Админские методы ---

        createTask: (data: Record<string, string>): Promise<{ success: boolean; taskId: string }> => {
            return apiFetch(apiBaseUrl, '/api/tasks', {
                method: 'POST',
                body: JSON.stringify(data),
            });
        },

        createGroup: (data: FormData): Promise<{ success: boolean; groupId: string }> => {
            return apiFetch(apiBaseUrl, '/api/groups', {
                method: 'POST',
                body: data, // FormData не требует 'Content-Type'
            });
        },

        fetchAllGroups: (): Promise<GroupSummary[]> => {
            return apiFetch(apiBaseUrl, '/api/admin/groups/all', { method: 'GET' });
        }
    };
};

type ApiService = ReturnType<typeof createApiService>;

// --- Компоненты UI ---

// Заголовок
const Header: React.FC<{ title: string; onBack?: () => void }> = ({ title, onBack }) => (
    <div className="p-4 sticky top-0 bg-[var(--tg-secondary-bg-color)] shadow-md z-10 flex items-center border-b border-[var(--tg-hint-color)]/20">
        {onBack && (
            <button
                onClick={onBack}
                className="mr-3 text-[var(--tg-link-color)] text-lg active:opacity-70"
            >
                &lsaquo; Назад
            </button>
        )}
        <h1 className="text-xl font-bold text-[var(--tg-text-color)]">{title}</h1>
    </div>
);

// Элемент списка
const ListItem: React.FC<{
    title: string;
    subtitle: string;
    imageUrl?: string;
    onClick: () => void;
}> = ({ title, subtitle, imageUrl, onClick }) => (
    <div
        onClick={onClick}
        className="flex items-center p-3 border-b border-[var(--tg-hint-color)]/20 cursor-pointer active:bg-[var(--tg-hint-color)]/10 transition-colors"
    >
        {imageUrl && (
            <div className="w-12 h-12 rounded-full mr-4 bg-[var(--tg-secondary-bg-color)] flex items-center justify-center text-[var(--tg-text-color)] overflow-hidden">
                <img src={imageUrl} alt={title} onError={(e) => {
                    // Fallback, если изображение не загрузилось
                    (e.target as HTMLImageElement).onerror = null;
                    (e.target as HTMLImageElement).src = `https://placehold.co/48x48/CCCCCC/333333?text=${title.charAt(0)}`
                }} className="w-full h-full object-cover" />
            </div>
        )}
        <div className="flex-1 min-w-0">
            <div className="font-semibold text-[var(--tg-text-color)] truncate">{title}</div>
            <div className="text-sm text-[var(--tg-hint-color)] truncate">{subtitle}</div>
        </div>
        <div className="text-[var(--tg-hint-color)] ml-2">&rsaquo;</div>
    </div>
);

// Компонент-заглушка для загрузки
const Loading: React.FC<{ text?: string }> = ({ text = 'Загрузка...' }) => (
    <div className="p-10 text-center text-[var(--tg-hint-color)]">
        <svg className="animate-spin h-5 w-5 mr-3 inline-block" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="var(--tg-hint-color)" strokeWidth="4"></circle>
            <path className="opacity-75" fill="var(--tg-text-color)" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
        {text}
    </div>
);

// Компонент-заглушка для ошибки
const ErrorDisplay: React.FC<{ message: string; onRetry?: () => void }> = ({ message, onRetry }) => (
    <div className="p-10 text-center rounded-lg bg-red-100 border border-red-500 text-red-700 mx-4 mt-4">
        <p className='font-bold mb-3'>Ошибка:</p>
        <p className='whitespace-pre-wrap'>{message}</p>
        {onRetry && (
            <button
                onClick={onRetry}
                className="mt-4 p-2 px-4 rounded-lg text-[var(--tg-button-text-color)] bg-red-500 hover:bg-red-600 transition-colors"
            >
                Попробовать снова
            </button>
        )}
    </div>
);

// --- Компоненты Страниц (с реальной загрузкой данных) ---

// Страница: Мои Задания
const PageMyTasks: React.FC<{
    api: ApiService;
    onSelectTask: (taskId: string) => void;
}> = ({ api, onSelectTask }) => {
    const [tasks, setTasks] = useState<TaskSummary[] | null>(null);
    const [error, setError] = useState<string | null>(null);

    const loadTasks = () => {
        setError(null);
        setTasks(null);
        api.fetchUserTasks()
            .then(setTasks)
            .catch(e => setError(e.message));
    };

    useEffect(loadTasks, [api]);

    return (
        <>
            <Header title="Мои Задания" />
            <div className="p-4">
                {error && <ErrorDisplay message={error} onRetry={loadTasks} />}
                {!tasks && !error && <Loading />}
                {tasks && (
                    <div className="rounded-lg bg-[var(--tg-secondary-bg-color)] overflow-hidden shadow-md">
                        {tasks.length === 0 && <div className="p-4 text-center text-[var(--tg-hint-color)]">У вас нет активных заданий.</div>}
                        {tasks.map(task => (
                            <ListItem
                                key={task.id}
                                title={task.title}
                                subtitle={`Проект: ${task.project} | Дедлайн: ${new Date(task.deadline).toLocaleString()}`}
                                onClick={() => onSelectTask(task.id)}
                            />
                        ))}
                    </div>
                )}
            </div>
        </>
    );
};

// Страница: Детализация Задания
const PageTaskDetails: React.FC<{
    api: ApiService;
    taskId: string;
    onBack: () => void;
}> = ({ api, taskId, onBack }) => {
    const [task, setTask] = useState<TaskDetails | null>(null);
    const [error, setError] = useState<string | null>(null);

    const loadTaskDetails = () => {
        if (taskId) {
            setError(null);
            setTask(null);
            api.fetchTaskDetails(taskId)
                .then(setTask)
                .catch(e => setError(e.message));
        }
    };

    useEffect(loadTaskDetails, [api, taskId]);

    return (
        <>
            <Header title="Детали Задания" onBack={onBack} />
            <div className="p-4">
                {error && <ErrorDisplay message={error} onRetry={loadTaskDetails} />}
                {!task && !error && <Loading text="Загрузка деталей..." />}
                {task && (
                    <div className="space-y-4 p-4 rounded-lg bg-[var(--tg-secondary-bg-color)] shadow-md">
                        <h2 className="text-2xl font-bold text-[var(--tg-text-color)] border-b pb-2 border-[var(--tg-hint-color)]/20">{task.title}</h2>
                        <DetailRow label="Номер" value={task.id} />
                        <DetailRow label="Проект" value={task.project} />
                        <DetailRow label="Группа" value={task.group} />
                        <DetailRow label="Исполнитель" value={task.assignee} />
                        <DetailRow label="Старт" value={new Date(task.startTime).toLocaleString()} />
                        <DetailRow label="Дедлайн" value={new Date(task.deadline).toLocaleString()} isDeadline={true} />
                        <div className="pt-2 border-t border-[var(--tg-hint-color)]/20">
                            <label className="text-sm font-semibold text-[var(--tg-hint-color)] block mb-1">Информация о задании:</label>
                            <p className="text-[var(--tg-text-color)] whitespace-pre-wrap rounded-md p-3 bg-[var(--tg-bg-color)]">{task.description}</p>
                        </div>
                    </div>
                )}
            </div>
        </>
    );
};

// Вспомогательный компонент для деталей
const DetailRow: React.FC<{ label: string; value: string; isDeadline?: boolean }> = ({ label, value, isDeadline = false }) => (
    <div className='flex justify-between border-b border-[var(--tg-hint-color)]/10 py-1'>
        <span className="text-sm font-semibold text-[var(--tg-hint-color)]">{label}</span>
        <span className={`text-[var(--tg-text-color)] font-medium ${isDeadline ? 'text-red-500' : ''}`}>{value}</span>
    </div>
);


// Страница: Мои Группы
const PageMyGroups: React.FC<{
    api: ApiService;
    onSelectGroup: (groupId: string) => void;
}> = ({ api, onSelectGroup }) => {
    const [groups, setGroups] = useState<GroupSummary[] | null>(null);
    const [error, setError] = useState<string | null>(null);

    const loadGroups = () => {
        setError(null);
        setGroups(null);
        api.fetchUserGroups()
            .then(setGroups)
            .catch(e => setError(e.message));
    };

    useEffect(loadGroups, [api]);

    return (
        <>
            <Header title="Мои Группы" />
            <div className="p-4">
                {error && <ErrorDisplay message={error} onRetry={loadGroups} />}
                {!groups && !error && <Loading />}
                {groups && (
                    <div className="rounded-lg bg-[var(--tg-secondary-bg-color)] overflow-hidden shadow-md">
                        {groups.length === 0 && <div className="p-4 text-center text-[var(--tg-hint-color)]">Вы не состоите в группах.</div>}
                        {groups.map(group => (
                            <ListItem
                                key={group.id}
                                title={group.name}
                                subtitle={`ID: ${group.id}`}
                                imageUrl={group.avatarUrl}
                                onClick={() => onSelectGroup(group.id)}
                            />
                        ))}
                    </div>
                )}
            </div>
        </>
    );
};

// Страница: Детали Группы
const PageGroupDetails: React.FC<{
    api: ApiService;
    groupId: string;
    onBack: () => void;
}> = ({ api, groupId, onBack }) => {
    const [group, setGroup] = useState<GroupDetails | null>(null);
    const [error, setError] = useState<string | null>(null);

    const loadGroupDetails = () => {
        if (groupId) {
            setError(null);
            setGroup(null);
            api.fetchGroupDetails(groupId)
                .then(setGroup)
                .catch(e => setError(e.message));
        }
    };

    useEffect(loadGroupDetails, [api, groupId]);

    return (
        <>
            <Header title="Данные Группы" onBack={onBack} />
            <div className="p-4">
                {error && <ErrorDisplay message={error} onRetry={loadGroupDetails} />}
                {!group && !error && <Loading />}
                {group && (
                    <div className="space-y-4">
                        <div className="flex flex-col items-center p-6 rounded-lg bg-[var(--tg-secondary-bg-color)] shadow-md">
                            <img
                                src={group.avatarUrl}
                                alt={group.name}
                                className="w-24 h-24 rounded-full mb-4 object-cover border-4 border-[var(--tg-link-color)]"
                                onError={(e) => {
                                    // Fallback
                                    (e.target as HTMLImageElement).onerror = null;
                                    (e.target as HTMLImageElement).src = `https://placehold.co/96x96/CCCCCC/333333?text=${group.name.charAt(0)}`
                                }}
                            />
                            <h2 className="text-2xl font-bold text-[var(--tg-text-color)]">{group.name}</h2>
                            <p className="text-[var(--tg-hint-color)] text-center mt-2 whitespace-pre-wrap">{group.description}</p>
                        </div>

                        <div className="p-4 rounded-lg bg-[var(--tg-secondary-bg-color)] shadow-md">
                            <h3 className="text-lg font-semibold mb-3 text-[var(--tg-text-color)] border-b pb-2 border-[var(--tg-hint-color)]/20">Участники ({group.members.length})</h3>
                            <ul className="space-y-2">
                                {group.members.map(member => (
                                    <li key={member.id} className="flex justify-between text-[var(--tg-text-color)] border-b border-[var(--tg-hint-color)]/10 last:border-b-0 py-1">
                                        <span>{member.name}</span>
                                        <span className='text-sm text-[var(--tg-hint-color)]'>ID: {member.id}</span>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    </div>
                )}
            </div>
        </>
    );
};

// Страница: Админ - Создать Задание
const PageAdminCreateTask: React.FC<{
    api: ApiService;
    onTaskCreated: () => void;
}> = ({ api, onTaskCreated }) => {
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        setIsLoading(true);
        setError(null);

        const formData = new FormData(e.currentTarget);
        const data = Object.fromEntries(formData.entries()) as Record<string, string>;

        // Проверка обязательных полей
        if (!data.title || !data.project || !data.group || !data.assignee) {
            setError('Пожалуйста, заполните все обязательные поля.');
            setIsLoading(false);
            return;
        }

        try {
            await api.createTask(data);
            // Используем MainButton для уведомления, затем переходим назад
            if (window.Telegram?.WebApp?.MainButton) {
                window.Telegram.WebApp.MainButton.setText('✅ Задание успешно создано');
                setTimeout(() => {
                    window.Telegram.WebApp.MainButton.hide();
                    onTaskCreated();
                }, 2000);
            } else {
                onTaskCreated();
            }
        } catch (e: any) {
            setError(e.message);
            window.Telegram?.WebApp?.MainButton.hide();
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <>
            <Header title="Выдать Задание" />
            <form className="p-4 space-y-4 bg-[var(--tg-secondary-bg-color)] m-4 rounded-xl shadow-lg" onSubmit={handleSubmit}>
                <h3 className='text-lg font-semibold text-[var(--tg-text-color)]'>Форма создания задания</h3>
                <FormInput name="title" label="Титул задания" required placeholder="Например: Разработка модуля авторизации" />
                <FormInput name="project" label="Проект" required placeholder="Например: Core App" />
                {/* В реальном приложении здесь должен быть Select с загрузкой данных */}
                <FormInput name="group" label="Группа (ID)" required placeholder="Например: g-devs-1" />
                <FormInput name="assignee" label="Исполнитель (ID)" required placeholder="Например: 123456789" />
                <FormTextarea name="description" label="Информация о задании" rows={4} placeholder="Подробное описание задачи и требований..." />
                <div className='flex space-x-4'>
                    <FormInput name="startTime" label="Время старта" type="datetime-local" />
                    <FormInput name="deadline" label="Дедлайн" type="datetime-local" />
                </div>
                <button
                    type="submit"
                    disabled={isLoading}
                    className="w-full p-3 rounded-lg text-[var(--tg-button-text-color)] bg-[var(--tg-button-color)] hover:opacity-90 transition-opacity disabled:opacity-50"
                >
                    {isLoading ? 'Отправка...' : 'Создать Задание'}
                </button>
                {error && <div className="text-red-500 text-center mt-2">{error}</div>}
            </form>
        </>
    );
};

// Страница: Админ - Создать Группу
const PageAdminCreateGroup: React.FC<{
    api: ApiService;
    onGroupCreated: () => void;
}> = ({ api, onGroupCreated }) => {
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        setIsLoading(true);
        setError(null);

        const formData = new FormData(e.currentTarget);

        // Проверка обязательного имени
        if (!formData.get('name')) {
            setError('Имя группы является обязательным.');
            setIsLoading(false);
            return;
        }

        try {
            await api.createGroup(formData);
            if (window.Telegram?.WebApp?.MainButton) {
                window.Telegram.WebApp.MainButton.setText('✅ Группа успешно создана');
                setTimeout(() => {
                    window.Telegram.WebApp.MainButton.hide();
                    onGroupCreated();
                }, 2000);
            } else {
                onGroupCreated();
            }
        } catch (e: any) {
            setError(e.message);
            window.Telegram?.WebApp?.MainButton.hide();
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <>
            <Header title="Создать Группу" />
            <form className="p-4 space-y-4 bg-[var(--tg-secondary-bg-color)] m-4 rounded-xl shadow-lg" onSubmit={handleSubmit}>
                <h3 className='text-lg font-semibold text-[var(--tg-text-color)]'>Форма создания группы</h3>
                <FormInput name="name" label="Имя Группы" required placeholder="Например: Frontend Team A" />
                <FormInput name="description" label="Описание (опционально)" placeholder="Краткое описание группы..." />
                <FormInput name="avatar" label="Аватарка" type="file" accept="image/*" />
                <button
                    type="submit"
                    disabled={isLoading}
                    className="w-full p-3 rounded-lg text-[var(--tg-button-text-color)] bg-[var(--tg-button-color)] hover:opacity-90 transition-opacity disabled:opacity-50"
                >
                    {isLoading ? 'Создание...' : 'Создать Группу'}
                </button>
                {error && <div className="text-red-500 text-center mt-2">{error}</div>}
            </form>
        </>
    );
};

// Страница: Админ - Все Группы
const PageAdminAllGroups: React.FC<{
    api: ApiService;
    onSelectGroup: (groupId: string) => void;
}> = ({ api, onSelectGroup }) => {
    const [groups, setGroups] = useState<GroupSummary[] | null>(null);
    const [error, setError] = useState<string | null>(null);

    const loadGroups = () => {
        setError(null);
        setGroups(null);
        api.fetchAllGroups()
            .then(setGroups)
            .catch(e => setError(e.message));
    };

    useEffect(loadGroups, [api]);

    return (
        <>
            <Header title="Все Группы" />
            <div className="p-4">
                {error && <ErrorDisplay message={error} onRetry={loadGroups} />}
                {!groups && !error && <Loading />}
                {groups && (
                    <div className="rounded-lg bg-[var(--tg-secondary-bg-color)] overflow-hidden shadow-md">
                        {groups.length === 0 && <div className="p-4 text-center text-[var(--tg-hint-color)]">В системе нет групп.</div>}
                        {groups.map(group => (
                            <ListItem
                                key={group.id}
                                title={group.name}
                                subtitle={`ID: ${group.id}`}
                                imageUrl={group.avatarUrl}
                                onClick={() => onSelectGroup(group.id)}
                            />
                        ))}
                    </div>
                )}
            </div>
        </>
    );
};

// Вспомогательные компоненты форм
const FormInput: React.FC<{
    label: string,
    name: string,
    type?: string,
    required?: boolean,
    accept?: string,
    placeholder?: string
}> = ({ label, ...props }) => (
    <div>
        <label className="block text-sm font-medium text-[var(--tg-hint-color)] mb-1">{label} {props.required && <span className='text-red-500'>*</span>}</label>
        <input
            {...props}
            className="w-full p-2 border border-[var(--tg-hint-color)]/30 rounded-md bg-[var(--tg-bg-color)] text-[var(--tg-text-color)] focus:border-[var(--tg-link-color)] focus:ring-[var(--tg-link-color)]"
        />
    </div>
);

const FormTextarea: React.FC<{
    label: string,
    name: string,
    rows?: number,
    required?: boolean,
    placeholder?: string
}> = ({ label, ...props }) => (
    <div>
        <label className="block text-sm font-medium text-[var(--tg-hint-color)] mb-1">{label} {props.required && <span className='text-red-500'>*</span>}</label>
        <textarea
            {...props}
            className="w-full p-2 border border-[var(--tg-hint-color)]/30 rounded-md bg-[var(--tg-bg-color)] text-[var(--tg-text-color)] focus:border-[var(--tg-link-color)] focus:ring-[var(--tg-link-color)]"
        />
    </div>
);


// --- Компонент Навигации ---

const BottomNavBar: React.FC<{
    activePage: Page;
    onNavigate: (page: Page) => void;
    role: UserRole;
}> = ({ activePage, onNavigate, role }) => {
    const navItems = [
        { page: 'myTasks', label: 'Задания', icon: '📝' },
        { page: 'myGroups', label: 'Группы', icon: '👥' },
    ];

    const adminNavItems = [
        { page: 'adminCreateTask', label: 'Выдать', icon: '➕' },
        { page: 'adminCreateGroup', label: 'Создать', icon: '🏠' },
        { page: 'adminAllGroups', label: 'Все', icon: '🌐' },
    ];

    const itemsToShow = role === 'admin' ? [...navItems, ...adminNavItems] : navItems;
    const gridColsClass = `grid-cols-${itemsToShow.length}`;

    return (
        <nav className={`sticky bottom-0 grid ${gridColsClass} gap-1 p-1 bg-[var(--tg-secondary-bg-color)] border-t border-[var(--tg-hint-color)]/20 shadow-lg`}>
            {itemsToShow.map(item => (
                <button
                    key={item.page}
                    onClick={() => onNavigate(item.page as Page)}
                    className={`flex flex-col items-center justify-center p-2 rounded-lg transition-colors
            ${activePage === item.page
                        ? 'text-[var(--tg-link-color)] bg-[var(--tg-link-color)]/10'
                        : 'text-[var(--tg-hint-color)] hover:bg-[var(--tg-hint-color)]/10'
                    }`}
                >
                    <span className="text-xl">{item.icon}</span>
                    <span className="text-xs font-medium text-center mt-1">{item.label}</span>
                </button>
            ))}
        </nav>
    );
};

// --- Главный Компонент Приложения ---

const App: React.FC = () => {
    const [currentPage, setCurrentPage] = useState<Page>('myTasks');
    const [user, setUser] = useState<User | null>(null);
    const [apiBaseUrl, setApiBaseUrl] = useState<string>('');
    const [error, setError] = useState<string | null>(null);

    // --- Выбранные ID для перехода на страницы деталей ---
    const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
    const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);

    // Создаем экземпляр API-сервиса, который будет обновляться при изменении apiBaseUrl
    const api = useMemo(() => createApiService(apiBaseUrl), [apiBaseUrl]);

    // --- Инициализация приложения ---
    useEffect(() => {
        // 1. Инициализация Telegram
        if (window.Telegram?.WebApp) {
            window.Telegram.WebApp.ready();
            window.Telegram.WebApp.expand();
            window.Telegram.WebApp.BackButton.hide();
        }


        // 2. Установка темы из Telegram
        const tgTheme = window.Telegram?.WebApp?.themeParams;
        if (tgTheme) {
            document.documentElement.style.setProperty('--tg-bg-color', tgTheme.bg_color || '#f0f0f0');
            document.documentElement.style.setProperty('--tg-secondary-bg-color', tgTheme.secondary_bg_color || '#ffffff');
            document.documentElement.style.setProperty('--tg-text-color', tgTheme.text_color || '#000000');
            document.documentElement.style.setProperty('--tg-hint-color', tgTheme.hint_color || '#999999');
            document.documentElement.style.setProperty('--tg-link-color', tgTheme.link_color || '#007aff');
            document.documentElement.style.setProperty('--tg-button-color', tgTheme.button_color || '#007aff');
            document.documentElement.style.setProperty('--tg-button-text-color', tgTheme.button_text_color || '#ffffff');
        }

        // 3. Парсинг 'replyip' из URL
        try {
            const urlParams = new URLSearchParams(window.location.search);
            const replyIp = urlParams.get('replyip');
            if (replyIp) {
                setApiBaseUrl(replyIp);
            } else {
                setError("Ошибка конфигурации: параметр 'replyip' не найден в URL.");
            }
        } catch (e: any) {
            setError(`Ошибка парсинга URL: ${e.message}`);
        }

    }, []);

    // Загрузка данных пользователя (и установка роли)
    useEffect(() => {
        if (apiBaseUrl) {
            setError(null);
            api.fetchUserData()
                .then(user => {
                    setUser(user);
                    // Если пользователь админ, по умолчанию ставим его на первую админскую вкладку
                    if (user.role === 'admin') {
                        setCurrentPage('adminCreateTask');
                    } else {
                        setCurrentPage('myTasks');
                    }
                })
                .catch(e => {
                    setError(`Ошибка аутентификации: ${e.message}`);
                });
        }
    }, [api, apiBaseUrl]);


    // --- Навигационная Логика ---

    const handleNavigate = (page: Page) => {
        setCurrentPage(page);
        setSelectedTaskId(null);
        setSelectedGroupId(null);
    };

    // Логика кнопки "Назад" в Telegram
    const handleBack = useMemo(() => {
        return () => {
            if (selectedTaskId || selectedGroupId) {
                // Если на странице деталей, возвращаемся к списку
                const targetPage = selectedTaskId ? 'myTasks' : 'myGroups';
                handleNavigate(targetPage);
            } else {
                // Если на главной странице, можно закрыть WebApp (или что-то другое)
                if (window.Telegram?.WebApp) {
                    // В реальном приложении здесь может быть window.Telegram.WebApp.close();
                    console.log('Попытка закрыть WebApp или перейти на главную вкладку');
                    handleNavigate('myTasks');
                }
            }
        }
    }, [selectedTaskId, selectedGroupId]);


    // Активация кнопки "Назад"
    useEffect(() => {
        if (window.Telegram?.WebApp) {
            if (selectedTaskId || selectedGroupId) {
                window.Telegram.WebApp.BackButton.show();
                window.Telegram.WebApp.BackButton.onClick(handleBack);
            } else {
                window.Telegram.WebApp.BackButton.hide();
                window.Telegram.WebApp.BackButton.onClick(handleBack);
            }
        }
        return () => {
            if (window.Telegram?.WebApp) {
                window.Telegram.WebApp.BackButton.onClick(handleBack);
            }
        };
    }, [selectedTaskId, selectedGroupId, handleBack]);


    const handleSelectTask = (taskId: string) => {
        setSelectedTaskId(taskId);
        setCurrentPage('taskDetails');
    };

    const handleSelectGroup = (groupId: string) => {
        setSelectedGroupId(groupId);
        setCurrentPage('groupDetails');
    };

    // --- Логика рендеринга страницы ---
    const renderPage = () => {
        // Сначала показываем ошибки
        if (error) {
            // Убираем нижнюю навигацию при ошибке
            return <ErrorDisplay message={error} />;
        }
        // Затем - загрузку пользователя
        if (!user) {
            return <Loading text="Аутентификация и загрузка данных пользователя..." />
        }

        // Логика для страницы деталей
        if (selectedTaskId) {
            return (
                <PageTaskDetails
                    api={api}
                    taskId={selectedTaskId}
                    onBack={() => handleNavigate('myTasks')}
                />
            );
        }
        if (selectedGroupId) {
            return (
                <PageGroupDetails
                    api={api}
                    groupId={selectedGroupId}
                    onBack={() => handleNavigate('myGroups')}
                />
            );
        }

        // Основные страницы
        switch (currentPage) {
            case 'myTasks':
                return <PageMyTasks api={api} onSelectTask={handleSelectTask} />;
            case 'myGroups':
                return <PageMyGroups api={api} onSelectGroup={handleSelectGroup} />;
            // --- Админские страницы ---
            case 'adminCreateTask':
                return <PageAdminCreateTask api={api} onTaskCreated={() => handleNavigate('myTasks')} />;
            case 'adminCreateGroup':
                return <PageAdminCreateGroup api={api} onGroupCreated={() => handleNavigate('adminAllGroups')} />;
            case 'adminAllGroups':
                return <PageAdminAllGroups api={api} onSelectGroup={handleSelectGroup} />;
            case 'taskDetails': // Should be covered by selectedTaskId, fallback to myTasks
            case 'groupDetails': // Should be covered by selectedGroupId, fallback to myGroups
            default:
                return <PageMyTasks api={api} onSelectTask={handleSelectTask} />;
        }
    };

    return (
        <div className="flex flex-col h-screen font-sans bg-[var(--tg-bg-color)] transition-colors">
            {/* Основной контент страницы */}
            <main className="flex-1 overflow-y-auto">
                {renderPage()}
            </main>

            {/* Нижняя навигация (показывается только после загрузки user и если нет ошибок) */}
            {user && !error && (
                <BottomNavBar
                    activePage={currentPage}
                    onNavigate={handleNavigate}
                    role={user.role}
                />
            )}
        </div>
    );
};

export default App;