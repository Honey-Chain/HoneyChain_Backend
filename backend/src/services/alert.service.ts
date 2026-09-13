import mongoose, { Types } from "mongoose";
import { Alert, IAlert, AlertSeverity } from "../models/Alert.js";
import AppError from "../utils/AppError.js";

export interface CreateAlertDTO {
  hiveId: string;
  apiaryId?: string;
  organizationId?: Types.ObjectId | string;
  severity: AlertSeverity;
  alertType: string;
  message: string;
  metadata?: Record<string, any>;
  cooldownMinutes?: number;
}

export interface GetAlertsFilter {
  hiveId?: string;
  apiaryId?: string;
  organizationId?: string;
  severity?: AlertSeverity;
  isResolved?: boolean;
  alertType?: string;
  page?: number;
  limit?: number;
}

export class AlertService {
  /**
   * Creates an alert if no identical active alert has been created within the cooldown window.
   */
  public async createAlertWithCooldown(data: CreateAlertDTO): Promise<{
    created: boolean;
    alert: IAlert;
    reason?: string;
  }> {
    const {
      hiveId,
      apiaryId,
      organizationId,
      severity,
      alertType,
      message,
      metadata = {},
      cooldownMinutes = 60,
    } = data;

    // 1. If an unresolved alert of the same type already exists for this hive,
    // do NOT create a duplicate alert card. Instead, update the existing alert in-place.
    const existingUnresolved = await Alert.findOne({
      hiveId,
      alertType,
      isResolved: false,
    }).sort({ createdAt: -1 });

    if (existingUnresolved) {
      existingUnresolved.message = message;
      existingUnresolved.severity = severity;
      existingUnresolved.metadata = {
        ...(existingUnresolved.metadata || {}),
        ...metadata,
        lastObservedAt: new Date(),
        occurrences: Number((existingUnresolved.metadata as any)?.occurrences || 1) + 1,
      };
      await existingUnresolved.save().catch(() => {});

      return {
        created: false,
        alert: existingUnresolved,
        reason: `Alert of type '${alertType}' is already open and active for hive '${hiveId}'`,
      };
    }

    // 2. If the alert was recently resolved within the cooldown window, suppress re-creation
    const cooldownThreshold = new Date(Date.now() - cooldownMinutes * 60 * 1000);
    const recentlyResolved = await Alert.findOne({
      hiveId,
      alertType,
      isResolved: true,
      resolvedAt: { $gte: cooldownThreshold },
    }).sort({ resolvedAt: -1 });

    if (recentlyResolved) {
      return {
        created: false,
        alert: recentlyResolved,
        reason: `Alert of type '${alertType}' was resolved recently within the ${cooldownMinutes}-minute cooldown`,
      };
    }

    const newAlert = new Alert({
      hiveId,
      apiaryId,
      ...(organizationId && { organizationId: new Types.ObjectId(organizationId.toString()) }),
      severity,
      alertType,
      message,
      metadata: {
        ...metadata,
        occurrences: 1,
        firstObservedAt: new Date(),
      },
      isResolved: false,
    });

    await newAlert.save();

    return {
      created: true,
      alert: newAlert,
    };
  }

  /**
   * Auto-resolves active alerts of specified types for a hive (e.g. when sensor readings return to normal).
   */
  public async resolveActiveAlerts(hiveId: string, alertTypes: string[]): Promise<number> {
    const result = await Alert.updateMany(
      {
        hiveId,
        alertType: { $in: alertTypes },
        isResolved: false,
      },
      {
        $set: {
          isResolved: true,
          resolvedAt: new Date(),
        },
      }
    );
    return result.modifiedCount;
  }

  /**
   * Convenience wrapper that creates an alert with cooldown and directly returns the IAlert document.
   */
  public async createAlert(data: CreateAlertDTO): Promise<IAlert> {
    const result = await this.createAlertWithCooldown(data);
    return result.alert;
  }

  /**
   * Retrieves alerts with filtering, pagination, and tenant isolation.
   */
  public async getAlerts(
    filter: GetAlertsFilter,
    userOrgId?: string,
    isAdmin: boolean = false
  ): Promise<{
    alerts: IAlert[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }> {
    const page = Math.max(1, Number(filter.page) || 1);
    const limit = Math.max(1, Math.min(100, Number(filter.limit) || 20));
    const skip = (page - 1) * limit;

    const query: Record<string, any> = {};

    if (filter.hiveId) {
      query.hiveId = filter.hiveId.trim();
    }
    if (filter.apiaryId) {
      query.apiaryId = filter.apiaryId.trim();
    }
    if (filter.severity) {
      query.severity = filter.severity;
    }
    if (filter.alertType) {
      query.alertType = filter.alertType.trim();
    }
    if (filter.isResolved !== undefined) {
      query.isResolved = filter.isResolved;
    }

    // Tenant isolation: non-admins are restricted to their organization
    if (!isAdmin && userOrgId) {
      query.organizationId = new Types.ObjectId(userOrgId);
    } else if (filter.organizationId && isAdmin) {
      query.organizationId = new Types.ObjectId(filter.organizationId);
    }

    const [alerts, total] = await Promise.all([
      Alert.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate("resolvedBy", "name email")
        .populate("organizationId", "name"),
      Alert.countDocuments(query),
    ]);

    return {
      alerts,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  /**
   * Resolves an alert.
   */
  public async resolveAlert(
    alertId: string,
    userId: string | Types.ObjectId,
    userOrgId?: string,
    isAdmin: boolean = false
  ): Promise<IAlert> {
    if (!mongoose.isValidObjectId(alertId)) {
      throw new AppError("Invalid alertId format", 400);
    }

    const alert = await Alert.findById(alertId);
    if (!alert) {
      throw new AppError("Alert not found", 404);
    }

    // Tenant check
    if (!isAdmin && userOrgId && alert.organizationId) {
      if (alert.organizationId.toString() !== userOrgId.toString()) {
        throw new AppError("Cannot modify alerts outside your organization", 403);
      }
    }

    alert.isResolved = true;
    alert.resolvedAt = new Date();
    alert.resolvedBy = new Types.ObjectId(userId.toString());
    await alert.save();

    return alert;
  }
}

export const alertService = new AlertService();
export default alertService;
