import {
  defineConfig,
  configDefaults,
} from 'vitest/config';

export default defineConfig({
  ...configDefaults,
  test: {
    include: ['tests/*'],
  },
});// -- end export default
