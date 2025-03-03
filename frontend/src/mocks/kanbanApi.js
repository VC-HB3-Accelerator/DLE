// Импортируем axios для перехвата запросов
import axios from 'axios';
import MockAdapter from 'axios-mock-adapter';

// Создаем экземпляр MockAdapter
const mock = new MockAdapter(axios, { delayResponse: 1000 });

// Мокаем запрос к API для получения списка досок
mock.onGet('/api/kanban/boards').reply(200, {
  boards: [
    {
      id: '1',
      title: 'Проект 1',
      description: 'Описание проекта 1',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    },
    {
      id: '2',
      title: 'Проект 2',
      description: 'Описание проекта 2',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }
  ]
});

// Мокаем запрос к API для получения конкретной доски
mock.onGet(/\/api\/kanban\/boards\/\d+/).reply((config) => {
  const id = config.url.split('/').pop();
  
  return [200, {
    board: {
      id,
      title: `Проект ${id}`,
      description: `Описание проекта ${id}`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      columns: [
        {
          id: '1',
          title: 'К выполнению',
          order: 1,
          tasks: [
            {
              id: '1',
              title: 'Задача 1',
              description: 'Описание задачи 1',
              priority: 'high',
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString()
            }
          ]
        },
        {
          id: '2',
          title: 'В процессе',
          order: 2,
          tasks: [
            {
              id: '2',
              title: 'Задача 2',
              description: 'Описание задачи 2',
              priority: 'medium',
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString()
            }
          ]
        },
        {
          id: '3',
          title: 'Завершено',
          order: 3,
          tasks: [
            {
              id: '3',
              title: 'Задача 3',
              description: 'Описание задачи 3',
              priority: 'low',
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString()
            }
          ]
        }
      ]
    }
  }];
});

// Обрабатываем все остальные запросы к API канбан-досок
mock.onAny(/\/api\/kanban\/.*/).reply(200, {
  success: true,
  message: 'Операция выполнена успешно'
});

export default mock; 