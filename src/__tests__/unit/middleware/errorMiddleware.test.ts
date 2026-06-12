import { jest } from "@jest/globals";
import { globalErrorHandler } from "../../../middleware/errorMiddleware.js";
import AppError from "../../../utils/AppError.js";
import httpStatus from "http-status";

const mockResponse = () => {
  const res: any = {
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
  };
  return res;
};

const req: any = {
  method: "POST",
  originalUrl: "/v1/test",
};

describe("Global Error Middleware", () => {
  it("formats duplicate email errors into a user-friendly 400", () => {
    const res = mockResponse();
    const err: any = {
      code: 11000,
      keyValue: { email: "taken@skaute.test" },
      message: "E11000 duplicate key",
    };

    globalErrorHandler(err, req, res, jest.fn());

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "fail",
        message:
          "This email address is already registered with an active account.",
      }),
    );
  });

  it("formats validation errors by joining field messages", () => {
    const res = mockResponse();
    const err: any = {
      name: "ValidationError",
      errors: {
        title: { path: "title", message: "title is required" },
        location: { path: "location", message: "cannot be completely empty" },
      },
    };

    globalErrorHandler(err, req, res, jest.fn());

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json.mock.calls[0][0].message).toMatch(/cannot be left blank/i);
    expect(res.json.mock.calls[0][0].message).toMatch(/Team partners/i);
  });

  it("formats JWT errors as unauthorized responses", () => {
    const res = mockResponse();

    globalErrorHandler(
      { name: "JsonWebTokenError", message: "bad token" },
      req,
      res,
      jest.fn(),
    );

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json.mock.calls[0][0].message).toMatch(/session is invalid/i);
  });

  it("passes operational AppError messages through", () => {
    const res = mockResponse();

    globalErrorHandler(
      new AppError(httpStatus.FORBIDDEN, "No entry"),
      req,
      res,
      jest.fn(),
    );

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({
      status: "fail",
      message: "No entry",
    });
  });
});
