import { authedRoute } from "./_base.js";
import { shareStateResponseSchema } from "./fields.js";

export const userShareStateResponseSchema = shareStateResponseSchema;

export const userShareContract = {
  get: authedRoute
    .route({ method: "GET", path: "/api/v1/users/me/share", tags: ["User Share"] })
    .output(userShareStateResponseSchema),
  enable: authedRoute
    .route({ method: "POST", path: "/api/v1/users/me/share", tags: ["User Share"] })
    .errors({ NOT_FOUND: { message: "User not found" } })
    .output(userShareStateResponseSchema),
  disable: authedRoute
    .route({
      method: "DELETE",
      path: "/api/v1/users/me/share",
      successStatus: 204,
      tags: ["User Share"],
    })
    .errors({ NOT_FOUND: { message: "User not found" } }),
};

export type UserShareContract = typeof userShareContract;
