module.exports = {
  extends: ['@commitlint/config-conventional'],
  rules: {
    'scope-enum': [1, 'always', ['api', 'web', 'contracts', 'shared', 'identity', 'conversion', 'billing', 'growth', 'deploy', 'deps', 'tooling', 'docs', 'ci']],
    'subject-case': [0],
  },
};
