import { run, bench, group, baseline } from "mitata";
import httpNext from "./index";
import httpPrevious from "0http-bun";

function setupRouter(router) {
  router.use((req, next) => {
    return next();
  });

  router.get("/", () => {
    return new Response();
  });
  router.get("/:id", async (req) => {
    return new Response(req.params.id);
  });
  router.get("/:id/error", () => {
    throw new Error("Error");
  });
}

const { router } = httpNext();
setupRouter(router);

const { router: routerPrevious } = httpPrevious();
setupRouter(routerPrevious);

group("Next Router", () => {
  baseline("Base URL", () => {
    router.fetch(new Request(new URL("http://localhost/")));
  });
  bench("Parameter URL", () => {
    router.fetch(new Request(new URL("http://localhost/0")));
  });
  bench("Not Found URL", () => {
    router.fetch(new Request(new URL("http://localhost/0/404")));
  });
  bench("Error URL", () => {
    router.fetch(new Request(new URL("http://localhost/0/error")));
  });
});

group("Previous Router", () => {
  baseline("Base URL", () => {
    routerPrevious.fetch(new Request(new URL("http://localhost/")));
  });
  bench("Parameter URL", () => {
    routerPrevious.fetch(new Request(new URL("http://localhost/0")));
  });
  bench("Not Found URL", () => {
    routerPrevious.fetch(new Request(new URL("http://localhost/0/404")));
  });
  bench("Error URL", () => {
    routerPrevious.fetch(new Request(new URL("http://localhost/0/error")));
  });
});

await run({
  silent: false,
  avg: true,
  json: false,
  colors: true,
  min_max: false,
  percentiles: false,
});
