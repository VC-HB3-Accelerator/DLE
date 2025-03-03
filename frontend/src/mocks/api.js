// Заглушки для API в режиме разработки
export function setupMockServer() {
  if (import.meta.env.DEV) {
    // Перехватываем fetch запросы
    const originalFetch = window.fetch;
    
    window.fetch = async function(url, options) {
      // Проверяем, является ли запрос API запросом
      if (typeof url === 'string' && url.includes('/api/')) {
        console.log('Перехвачен запрос:', url, options);
        
        // Заглушка для сессии
        if (url.includes('/api/session')) {
          return new Response(JSON.stringify({
            authenticated: true,
            address: '0xf45aa4917b3775ba37f48aeb3dc1a943561e9e0b'
          }), { status: 200, headers: { 'Content-Type': 'application/json' } });
        }
        
        // Заглушка для проверки доступности сервера
        if (url.includes('/api/debug/ping')) {
          return new Response(JSON.stringify({ status: 'ok' }), 
            { status: 200, headers: { 'Content-Type': 'application/json' } });
        }
        
        // Заглушка для досок Канбан
        if (url.includes('/api/kanban/boards')) {
          return new Response(JSON.stringify({
            ownBoards: [
              { 
                id: 1, 
                title: 'Разработка DApp', 
                description: 'Задачи по разработке DApp',
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
                owner_address: '0xf45aa4917b3775ba37f48aeb3dc1a943561e9e0b',
                is_public: true
              },
              { 
                id: 2, 
                title: 'Маркетинг', 
                description: 'Маркетинговые задачи',
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
                owner_address: '0xf45aa4917b3775ba37f48aeb3dc1a943561e9e0b',
                is_public: false
              }
            ],
            sharedBoards: [],
            publicBoards: []
          }), { status: 200, headers: { 'Content-Type': 'application/json' } });
        }
        
        // Заглушка для чата с ИИ
        if (url.includes('/api/chat/message') && options?.method === 'POST') {
          const body = options.body ? JSON.parse(options.body) : {};
          return new Response(JSON.stringify({
            response: `Это тестовый ответ на ваше сообщение: "${body.message}". В данный момент сервер недоступен.`
          }), { status: 200, headers: { 'Content-Type': 'application/json' } });
        }
      }
      
      // Для всех остальных запросов используем оригинальный fetch
      return originalFetch.apply(this, arguments);
    };
    
    console.log('Заглушки API настроены для режима разработки');
  }
} 