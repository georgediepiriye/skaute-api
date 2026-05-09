import { Request, Response, NextFunction } from "express";
import * as authService from "./services/authService.js";
import { signToken } from "../utils/jwt.js";
import httpStatus from "http-status";
import catchAsync from "../utils/catchAsync.js";
import config from "../config/config.js";
import jwt from "jsonwebtoken";

export const signup = catchAsync(
  async (req: Request, res: Response, next: NextFunction) => {
    const newUser = await authService.createUser(req.body);
    const token = signToken(newUser._id.toString());

    // Sanitize response
    const user = newUser.toObject();
    delete user.password;
    delete user.__v;

    res.cookie("token", token, {
      httpOnly: true,
      secure: config.env === "production",
      sameSite: config.env === "production" ? "none" : "lax",
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    res.status(httpStatus.CREATED).json({
      status: "success",
      token,
      data: {
        user,
      },
    });
  },
);

export const login = catchAsync(
  async (req: Request, res: Response, next: NextFunction) => {
    const { email, password } = req.body;

    // 1. Verify user via the service.
    // This will now handle password checks AND Google-account detection.
    const user = await authService.verifyUser(email, password);

    // 2. Generate the Kivo JWT
    const token = signToken(user._id.toString());

    // 3. Set the token in a cookie (Optional but highly recommended for Kivo's security)
    res.cookie("token", token, {
      httpOnly: true,
      secure: config.env === "production",
      sameSite: config.env === "production" ? "none" : "lax",
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    });

    // 4. Send response
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

export const getMe = async (req: Request, res: Response) => {
  try {
    // 1. Extract token from HttpOnly cookie
    const token = req.cookies.token;

    if (!token) {
      return res
        .status(401)
        .json({ authenticated: false, message: "No token" });
    }

    // 2. Verify JWT
    const decoded = jwt.verify(token, config.jwt.secret!) as {
      id: string;
    };

    // 3. Get user from service
    const user = await authService.getAuthenticatedUser(decoded.id);

    return res.status(200).json({
      authenticated: true,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        image: user.image,
        role: user.role,
      },
    });
  } catch (error: any) {
    return res
      .status(401)
      .json({ authenticated: false, message: "Unauthorized" });
  }
};

export const logout = async (req: Request, res: Response) => {
  res.cookie("token", "", {
    httpOnly: true,
    secure: config.env === "production",
    sameSite: config.env === "production" ? "none" : "lax",
    expires: new Date(0),
  });

  return res.status(200).json({ message: "Logged out successfully" });
};
