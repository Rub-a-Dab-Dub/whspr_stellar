import {
  Controller,
  Get,
  Patch,
  Param,
  Body,
  Query,
  UseGuards,
  HttpException,
  HttpStatus,
  Logger,
} from "@nestjs/common";
import { SecurityAlertService } from "../services/security-alert.service";
import { RoleGuard } from "@/shared/guards/role.guard";
import { JwtGuard } from "@/shared/guards/jwt.guard";
import { Roles } from "@/shared/decorators/roles.decorator";
import { CurrentUser } from "@/shared/decorators/current-user.decorator";

@Controller("admin/security/alerts")
@UseGuards(JwtGuard, RoleGuard)
@Roles("ADMIN", "SUPER_ADMIN")
export class SecurityAlertsController {
  private readonly logger = new Logger(SecurityAlertsController.name);

  constructor(private securityAlertService: SecurityAlertService) {}

  /**
   * GET /admin/security/alerts
   * List all security alerts with filtering and pagination
   */
  @Get()
  async getAlerts(
    @Query("severity") severity?: string,
    @Query("status") status?: string,
    @Query("page") page: string = "1",
    @Query("limit") limit: string = "20",
    @CurrentUser() user?: any,
  ) {
    try {
      const pageNum = Math.max(1, parseInt(page, 10) || 1);
      const limitNum = Math.max(1, Math.min(100, parseInt(limit, 10) || 20));

      const result = await this.securityAlertService.getAlerts({
        severity: severity as any,
        status: status as any,
        page: pageNum,
        limit: limitNum,
      });

      return {
        success: true,
        data: result.data,
        pagination: result.pagination,
      };
    } catch (error) {
      this.logger.error("Error fetching alerts", error);
      throw new HttpException(
        "Failed to fetch alerts",
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * PATCH /admin/security/alerts/:alertId
   * Update alert status and add notes
   */
  @Patch(":alertId")
  async updateAlert(
    @Param("alertId") alertId: string,
    @Body() updateData: { status?: string; note?: string },
    @CurrentUser() user?: any,
    @Roles() userRoles?: string[],
  ) {
    try {
      // Validate status
      const validStatuses = ["open", "acknowledged", "resolved"];
      if (updateData.status && !validStatuses.includes(updateData.status)) {
        throw new HttpException(
          `Invalid status. Allowed values: ${validStatuses.join(", ")}`,
          HttpStatus.BAD_REQUEST,
        );
      }

      const alert = await this.securityAlertService.getAlertById(alertId);
      if (!alert) {
        throw new HttpException("Alert not found", HttpStatus.NOT_FOUND);
      }

      // Only SUPER_ADMIN can resolve alerts
      if (
        updateData.status === "resolved" &&
        !userRoles?.includes("SUPER_ADMIN")
      ) {
        throw new HttpException(
          "Only SUPER_ADMIN can resolve alerts",
          HttpStatus.FORBIDDEN,
        );
      }

      const updatedAlert = await this.securityAlertService.updateAlert(
        alertId,
        {
          status: updateData.status as any,
          note: updateData.note,
        },
      );

      return {
        success: true,
        data: updatedAlert,
      };
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      this.logger.error("Error updating alert", error);
      throw new HttpException(
        "Failed to update alert",
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * GET /admin/security/alerts/:alertId
   * Get a specific alert by ID
   */
  @Get(":alertId")
  async getAlertById(@Param("alertId") alertId: string) {
    try {
      const alert = await this.securityAlertService.getAlertById(alertId);
      if (!alert) {
        throw new HttpException("Alert not found", HttpStatus.NOT_FOUND);
      }

      return {
        success: true,
        data: alert,
      };
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      this.logger.error("Error fetching alert", error);
      throw new HttpException(
        "Failed to fetch alert",
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}
