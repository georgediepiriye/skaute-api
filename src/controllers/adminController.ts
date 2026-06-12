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

export const getAllHotspots = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { hotspots, pagination } = await adminService.getHotspotsList(
      req.query,
    );

    res.status(httpStatus.OK).json({
      status: "success",
      results: hotspots.length,
      pagination,
      data: { hotspots },
    });
  } catch (error) {
    next(error);
  }
};

export const getHotspotSuggestions = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { suggestions, pagination } =
      await adminService.getHotspotSuggestions(req.query);

    res.status(httpStatus.OK).json({
      status: "success",
      data: { suggestions, pagination },
    });
  } catch (error) {
    next(error);
  }
};

export const getHotspotSuggestion = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const suggestion = await adminService.getHotspotSuggestionById(
      req.params.id as string,
    );

    res.status(httpStatus.OK).json({
      status: "success",
      data: { suggestion },
    });
  } catch (error) {
    next(error);
  }
};

export const updateHotspotSuggestion = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const suggestion = await adminService.updateHotspotSuggestion(
      req.params.id as string,
      req.body,
    );

    res.status(httpStatus.OK).json({
      status: "success",
      data: { suggestion },
    });
  } catch (error) {
    next(error);
  }
};

export const approveHotspotSuggestion = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const adminId =
      (req.user as any)?._id?.toString() || (req.user as any)?.id?.toString();
    const { suggestion, hotspot } = await adminService.approveHotspotSuggestion(
      req.params.id as string,
      adminId,
    );

    res.status(httpStatus.CREATED).json({
      status: "success",
      message: "Suggestion approved and hotspot created",
      data: { hotspot, suggestion },
    });
  } catch (error) {
    next(error);
  }
};

export const rejectHotspotSuggestion = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const adminId =
      (req.user as any)?._id?.toString() || (req.user as any)?.id?.toString();
    const suggestion = await adminService.rejectHotspotSuggestion(
      req.params.id as string,
      adminId,
      req.body.adminNotes,
    );

    res.status(httpStatus.OK).json({
      status: "success",
      message: "Suggestion rejected",
      data: { suggestion },
    });
  } catch (error) {
    next(error);
  }
};

export const deleteHotspotSuggestion = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    await adminService.deleteHotspotSuggestion(req.params.id as string);

    res.status(httpStatus.OK).json({
      status: "success",
      message: "Suggestion deleted",
    });
  } catch (error) {
    next(error);
  }
};

export const getHotspotContributionQueue = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { contributions, pagination } =
      await adminService.getHotspotContributionQueue(req.query);

    res.status(httpStatus.OK).json({
      status: "success",
      data: { contributions },
      pagination,
    });
  } catch (error) {
    next(error);
  }
};

export const approveHotspotContribution = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const adminId =
      (req.user as any)?._id?.toString() || (req.user as any)?.id?.toString();
    const { contribution, hotspot } =
      await adminService.approveHotspotContribution(
        req.params.id as string,
        adminId,
        req.body.adminNote,
        req.body.applyMode,
      );

    res.status(httpStatus.OK).json({
      status: "success",
      message: "Contribution approved",
      data: { contribution, hotspot },
    });
  } catch (error) {
    next(error);
  }
};

export const rejectHotspotContribution = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const adminId =
      (req.user as any)?._id?.toString() || (req.user as any)?.id?.toString();
    const contribution = await adminService.rejectHotspotContribution(
      req.params.id as string,
      adminId,
      req.body.adminNote,
    );

    res.status(httpStatus.OK).json({
      status: "success",
      message: "Contribution rejected",
      data: { contribution },
    });
  } catch (error) {
    next(error);
  }
};

export const issueBulkTickets = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const adminId =
      (req.user as any)?._id?.toString() || (req.user as any)?.id?.toString();
    const tickets = await adminService.processBulkTicketIssue(
      req.params.id as string,
      adminId,
      req.body.guests,
    );

    res.status(httpStatus.CREATED).json({
      status: "success",
      message: `${tickets.length} ticket(s) issued successfully.`,
      results: tickets.length,
      data: { tickets },
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
    const {
      status,
      reason,
    }: {
      status: "approved" | "rejected";
      reason?: string;
    } = req.body;

    const adminId = (req.user as any)?.id?.toString();
    const event = await adminService.updateApprovalStatus(
      req.params.id as string,
      status,
      adminId,
      reason,
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
    const { isVerified } = req.body;

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

export const getPayoutQueue = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { payouts, pagination } = await adminService.getPayoutsList(
      req.query,
    );

    res.status(httpStatus.OK).json({
      status: "success",
      results: payouts.length,
      pagination,
      data: { payouts },
    });
  } catch (error) {
    next(error);
  }
};

export const completeManualPayout = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { id } = req.params;
    const { reference } = req.body; // Expects the manual banking receipt reference string

    const completedPayout = await adminService.processManualPayoutCompletion(
      id as string,
      reference as string,
    );

    if (!completedPayout) {
      return res.status(httpStatus.NOT_FOUND).json({
        status: "error",
        message:
          "Payout record could not be found or has already been settled.",
      });
    }

    res.status(httpStatus.OK).json({
      status: "success",
      message: "Payout ledger marked successful.",
      data: { payout: completedPayout },
    });
  } catch (error) {
    next(error);
  }
};

export const updateEventPromotion = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const adminId = (req.user as any)?.id?.toString();

    const updatedEvent = await adminService.updateEventPromotionStatus(
      id as string,
      adminId,
      req.body,
    );

    if (!updatedEvent) {
      return res.status(404).json({
        success: false,
        message: "Target event could not be found.",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Event discoverability settings updated successfully.",
      data: {
        id: updatedEvent._id,
        title: updatedEvent.title,
        status: updatedEvent.status,
        isSkauteHosted: updatedEvent.isSkauteHosted,
        isBoosted: updatedEvent.isBoosted,
        boostTier: updatedEvent.boostTier,
        boostExpiry: updatedEvent.boostExpiry,
        priorityLevel: updatedEvent.priorityLevel,
      },
    });
  } catch (error: any) {
    console.error("Error updating event promotion:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error updating promotion state.",
      error: error.message,
    });
  }
};

export const getGlobalTelemetry = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const data = await adminService.getTelemetryDataset();
    res.status(httpStatus.OK).json({
      status: "success",
      data,
    });
  } catch (error) {
    next(error);
  }
};

export const getEventTelemetry = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const eventId = req.params.eventId as string;
    const data = await adminService.getTelemetryDataset(eventId);
    res.status(httpStatus.OK).json({
      status: "success",
      data,
    });
  } catch (error) {
    next(error);
  }
};
