import { Request, Response, NextFunction } from "express";
import * as authService from "./services/authService.js";
import { signToken } from "../utils/jwt.js";
import httpStatus from "http-status";
import catchAsync from "../utils/catchAsync.js";

export const signup = catchAsync(
  async (req: Request, res: Response, next: NextFunction) => {
    const newUser = await authService.createUser(req.body);
    const token = signToken(newUser._id.toString(), newUser.role);

    const user = newUser.toObject();
    delete user.password;
    delete user.__v;

    res.status(httpStatus.CREATED).json({
      status: "success",
      token,
      data: { user },
    });
  },
);

export const login = catchAsync(
  async (req: Request, res: Response, next: NextFunction) => {
    const { email, password } = req.body;
    const user = await authService.verifyUser(email, password);
    const token = signToken(user._id.toString(), user.role);

    res.status(httpStatus.OK).json({
      status: "success",
      token,
      data: {
        user: {
          id: user._id,
          name: user.name,
          email: user.email,
          role: user.role,
          interests: user.interests,
          location: user.location,
          image: user.image,
        },
      },
    });
  },
);

export const getMe = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const currentUser = (req as any).user;

    if (!currentUser) {
      return res.status(httpStatus.UNAUTHORIZED).json({
        status: "fail",
        message: "User context missing. Please log in again.",
      });
    }

    res.setHeader(
      "Cache-Control",
      "no-store, no-cache, must-revalidate, proxy-revalidate",
    );
    res.setHeader("Pragma", "no-cache");
    res.setHeader("Expires", "0");

    return res.status(httpStatus.OK).json({
      status: "success",
      data: {
        user: {
          id: currentUser._id,
          name: currentUser.name,
          email: currentUser.email,
          role: currentUser.role,
          image: currentUser.image,
          interests: currentUser.interests,
          location: currentUser.location,
        },
      },
    });
  } catch (error) {
    next(error);
  }
};

export const logout = async (req: Request, res: Response) => {
  const isProd = process.env.NODE_ENV === "production";

  // Wipe the tokens from the HTTP headers if your backend uses HTTP-only cookies
  res.clearCookie("skaute_token", {
    path: "/",
    httpOnly: true,
    secure: isProd,
    sameSite: "lax",
  });

  res.clearCookie("user_role", {
    path: "/",
    httpOnly: true,
    secure: isProd,
    sameSite: "lax",
  });

  return res.status(200).json({
    status: "success",
    message: "Logged out successfully",
  });
};
