import { Request, Response, NextFunction } from "express";
import httpStatus from "http-status";
import * as adminService from "./services/adminService.js";

export const getModerationQueue = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    // Destructure the new pagination object from the service
    const { events, pagination } = await adminService.getModerationQueue(
      req.query,
    );

    const response = {
      status: "success",
      results: events.length,
      // Pass the entire pagination object (which now includes counts)
      pagination: {
        totalEvents: pagination.totalEvents,
        totalPages: pagination.totalPages,
        page: pagination.page,
        limit: pagination.limit,
        counts: pagination.counts,
      },
      data: { events },
    };

    res.status(httpStatus.OK).json(response);
  } catch (error) {
    next(error);
  }
};

export const getEventPreview = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const event = await adminService.getEventForPreview(
      req.params.id as string,
    );

    if (!event) {
      return res.status(httpStatus.NOT_FOUND).json({
        status: "error",
        message: "Event not found",
      });
    }

    res.status(httpStatus.OK).json({
      status: "success",
      data: { event },
    });
  } catch (error) {
    next(error);
  }
};

export const processApproval = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { status } = req.body;
    const event = await adminService.updateApprovalStatus(
      req.params.id as string,
      status,
    );

    if (!event) {
      return res.status(httpStatus.NOT_FOUND).json({
        status: "error",
        message: "Event not found",
      });
    }

    res.status(httpStatus.OK).json({
      status: "success",
      message: `Event successfully ${status}`,
      data: { event },
    });
  } catch (error) {
    next(error);
  }
};

export const getAllUsers = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { users, pagination } = await adminService.getUsersList(req.query);

    res.status(httpStatus.OK).json({
      status: "success",
      results: users.length,
      pagination,
      data: { users },
    });
  } catch (error) {
    next(error);
  }
};

export const toggleUserStatus = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { id } = req.params;
    const { status } = req.body; // Expects "active" | "suspended"

    const updatedUser = await adminService.updateUserStatus(
      id as string,
      status,
    );

    if (!updatedUser) {
      return res.status(httpStatus.NOT_FOUND).json({
        status: "error",
        message: "User account could not be found.",
      });
    }

    res.status(httpStatus.OK).json({
      status: "success",
      message: `User account has been successfully set to ${status}.`,
      data: { user: updatedUser },
    });
  } catch (error) {
    next(error);
  }
};

export const toggleUserVerification = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { id } = req.params;
    const { isVerified } = req.body; // Expects true | false

    const updatedUser = await adminService.updateUserVerification(
      id as string,
      isVerified,
    );

    if (!updatedUser) {
      return res.status(httpStatus.NOT_FOUND).json({
        status: "error",
        message: "User account could not be found.",
      });
    }

    res.status(httpStatus.OK).json({
      status: "success",
      message: isVerified
        ? "User verification approved successfully."
        : "User verification status revoked.",
      data: { user: updatedUser },
    });
  } catch (error) {
    next(error);
  }
};

export const getPulseAnalytics = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const pulseData = await adminService.getPulseMetrics();

    res.status(httpStatus.OK).json({
      status: "success",
      message: "Port Harcourt pulse synchronized",
      data: pulseData,
    });
  } catch (error) {
    next(error);
  }
};

export const getEventManagementData = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { id } = req.params;

    const managementData = await adminService.getEventManagementDetails(
      id as string,
    );

    if (!managementData) {
      return res.status(httpStatus.NOT_FOUND).json({
        status: "error",
        message: "Management data for this move is unavailable.",
      });
    }

    res.status(httpStatus.OK).json({
      status: "success",
      message: "Event operations data synchronized",
      data: managementData,
    });
  } catch (error) {
    next(error);
  }
};
