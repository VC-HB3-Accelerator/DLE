module.exports = {
  extends: [
    // Используем стандартную конфигурацию для Vue (включает CSS и <style> в .vue)
    'stylelint-config-standard-vue',
    // Отключает правила Stylelint, конфликтующие с Prettier
    'stylelint-config-prettier',
  ],
  // Здесь можно добавить или переопределить правила
  rules: {
    // Пример: можно отключить правило о пустой строке перед комментариями
    // 'comment-empty-line-before': null,
    // Пример: требовать нижний регистр для имен анимаций
    // 'keyframes-name-pattern': '^[a-z][a-z0-9-]*$',
  },
};
