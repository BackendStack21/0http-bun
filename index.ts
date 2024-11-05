import server from './lib/router/sequential';
import type { IRouterConfig } from './common';
export type * from './common';
export { IRouter } from './lib/router/sequential';
export default (config: IRouterConfig) => {
  const router = server(config);
  return {
    router,
  };
};
