import { Request, Response, NextFunction } from "express";
import * as eventService from "./services/eventService.js";
import httpStatus from "http-status";
import { IUser } from "../models/User.js";
import logger from "../utils/logger.js";

export const createEvent = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const eventData = { ...req.body };

    // CRITICAL: Prevent GeoSpatial Index errors for Online events
    // If it's online, we must ensure the location object doesn't exist
    // so Mongoose doesn't try to fill in defaults like { type: "Point" }
    if (eventData.eventFormat === "online") {
      delete eventData.location;
      eventData.isOnline = true; // Sync boolean helper
    }

    const user = (req as any).user as IUser;
    const organizerId = user._id.toString();

    const newEvent = await eventService.createNewEvent(eventData, organizerId);

    res.status(httpStatus.CREATED).json({
      status: "success",
      data: { event: newEvent },
    });
  } catch (error) {
    next(error);
  }
};

export const updateEvent = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { id } = req.params;
    const updateData = { ...req.body };
    const user = (req as any).user as IUser;

    // Handle online format logic same as creation
    if (updateData.eventFormat === "online") {
      updateData.location = null;
      updateData.isOnline = true;
    }

    const updatedEvent = await eventService.updateEvent(
      id as string,
      updateData,
      user._id.toString(),
    );

    res.status(httpStatus.OK).json({
      status: "success",
      data: { event: updatedEvent },
    });
  } catch (error) {
    next(error);
  }
};

export const getAllEvents = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { events, total, page, limit } = await eventService.getAllEvents(
      req.query,
    );

    const response = {
      status: "success",
      results: events.length,
      pagination: {
        total,
        page,
        pages: Math.ceil(total / limit),
      },
      data: { events },
    };

    res.status(httpStatus.OK).json(response);
  } catch (error) {
    next(error);
  }
};

export const getNearbyEvents = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { distance, lng, lat } = req.query;

    const events = await eventService.findNearbyEvents(
      Number(lng),
      Number(lat),
      Number(distance || 10),
    );

    res.status(httpStatus.OK).json({
      status: "success",
      results: events.length,
      data: { events },
    });
  } catch (error) {
    next(error);
  }
};

export const getEvent = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const event = await eventService.getEventById(req.params.id as string);

    if (!event) {
      return res.status(httpStatus.NOT_FOUND).json({
        status: "fail",
        message: "No event found with that ID",
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

export const getManagementDashboardData = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const eventId = req.params.id as string;
    const user = (req as any).user as IUser;

    logger.info(`Management Access: User=${user.email} EventID=${eventId}`);
    const managementData = await eventService.getManagementDashboardData(
      eventId,
      user._id.toString(),
    );

    res.status(httpStatus.OK).json({
      status: "success",
      data: managementData,
    });
  } catch (error: any) {
    logger.error(
      `Management Access Failed: ${error.message} | User=${(req as any).user?.email}`,
    );
    next(error);
  }
};

export const addCoOrganizer = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const eventId = req.params.eventId as string;
    const { email } = req.body;
    const user = (req as any).user;

    const updatedEvent = await eventService.addPartnerToEvent(
      eventId,
      email,
      user._id.toString(),
    );

    res.status(httpStatus.OK).json({
      status: "success",
      message: "Partner added successfully",
      data: { event: updatedEvent },
    });
  } catch (error) {
    next(error);
  }
};

export const removeCoOrganizer = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { eventId, partnerId } = req.params;
    const user = (req as any).user;

    const updatedEvent = await eventService.removePartnerFromEvent(
      eventId as string,
      partnerId as string,
      user._id.toString(),
    );

    res.status(httpStatus.OK).json({
      status: "success",
      message: "Partner removed successfully",
      data: { event: updatedEvent },
    });
  } catch (error) {
    next(error);
  }
};
