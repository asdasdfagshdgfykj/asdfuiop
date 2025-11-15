/** @type {import('tailwindcss').Config} */
export default {
    // Указываем, какие файлы должен сканировать Tailwind для классов
    content: [
        "./index.html",
        "./src/**/*.{js,ts,jsx,tsx}",
    ],
    theme: {
        extend: {
            // Здесь можно добавить пользовательские цвета, но для ТГ мы полагаемся на CSS-переменные
        },
    },
    plugins: [],
}