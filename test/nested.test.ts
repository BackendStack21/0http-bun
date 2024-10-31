/* global describe, it, expect, beforeAll */

import { describe, beforeAll, it, expect } from "bun:test";
import http, { IRouter } from "../index";
const { router } = http({
  port: 3000,
});

const api_router = new IRouter();
const api2_router = new IRouter();
// router.use((req, next) => {
//   req.ctx = {
//     engine: "bun",
//   };

//   return next();
// });
// api_router.get("/test", () => new Response("OK!"));
// router.use("/api", api_router);

describe("Nested Router", () => {
  beforeAll(async () => {
    router.use((req, next) => {
      req.ctx = {
        engine: "bun",
      };

      return next();
    });
    api_router.get("/test", () => new Response("OK!"));
    api2_router.get("/api2", () => new Response("OK!"));
    router.use("/api", api_router);
    router.use(api2_router);
    // console.log(router.routes);
  });

  it("should return a text `OK` response with the request parameters for GET requests", async () => {
    const response = await router.fetch(
      new Request("http://localhost:3000/api/test", {
        method: "GET",
      })
    );
    expect(response.status).toBe(200);
    expect(await response.text()).toEqual("OK!");
  });
  it("should return a text `OK` response with the request parameters for GET requests", async () => {
    const response = await router.fetch(
      new Request("http://localhost:3000/api2", {
        method: "GET",
      })
    );
    expect(response.status).toBe(200);
    expect(await response.text()).toEqual("OK!");
  });
});
