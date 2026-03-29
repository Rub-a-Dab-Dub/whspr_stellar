import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import {
  AttendeeResponseDto,
  CreateGroupEventDto,
  EventRsvpResponseDto,
  GroupEventResponseDto,
  RsvpDto,
  UpdateGroupEventDto,
} from './dto/group-event.dto';
import { GroupEventsService } from './group-events.service';

@ApiTags('group-events')
@ApiBearerAuth()
@Controller()
export class GroupEventsController {
  constructor(private readonly service: GroupEventsService) {}

  @Post('groups/:id/events')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create an event in a group (admin/creator only)' })
  @ApiResponse({ status: 201, type: GroupEventResponseDto })
  createEvent(
    @CurrentUser('id') userId: string,
    @CurrentUser('groupMemberIds') groupMemberIds: string[],
    @Param('id', ParseUUIDPipe) groupId: string,
    @Body() dto: CreateGroupEventDto,
  ): Promise<GroupEventResponseDto> {
    return this.service.createEvent(userId, groupId, dto, groupMemberIds ?? []);
  }

  @Get('groups/:id/events')
  @ApiOperation({ summary: 'List all events for a group' })
  @ApiResponse({ status: 200, type: [GroupEventResponseDto] })
  getGroupEvents(
    @Param('id', ParseUUIDPipe) groupId: string,
  ): Promise<GroupEventResponseDto[]> {
    return this.service.getGroupEvents(groupId);
  }

  @Get('events/:id')
  @ApiOperation({ summary: 'Get a single event with RSVP counts' })
  @ApiResponse({ status: 200, type: GroupEventResponseDto })
  getEvent(
    @Param('id', ParseUUIDPipe) eventId: string,
  ): Promise<GroupEventResponseDto> {
    return this.service.getEvent(eventId);
  }

  @Patch('events/:id')
  @ApiOperation({ summary: 'Update an event (creator only)' })
  @ApiResponse({ status: 200, type: GroupEventResponseDto })
  updateEvent(
    @CurrentUser('id') userId: string,
    @Param('id', ParseUUIDPipe) eventId: string,
    @Body() dto: UpdateGroupEventDto,
  ): Promise<GroupEventResponseDto> {
    return this.service.updateEvent(userId, eventId, dto);
  }

  @Delete('events/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Cancel an event (creator only)' })
  cancelEvent(
    @CurrentUser('id') userId: string,
    @Param('id', ParseUUIDPipe) eventId: string,
  ): Promise<void> {
    return this.service.cancelEvent(userId, eventId);
  }

  @Post('events/:id/rsvp')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'RSVP to an event (auto-waitlisted if full)' })
  @ApiResponse({ status: 200, type: EventRsvpResponseDto })
  rsvp(
    @CurrentUser('id') userId: string,
    @Param('id', ParseUUIDPipe) eventId: string,
    @Body() dto: RsvpDto,
  ): Promise<EventRsvpResponseDto> {
    return this.service.rsvp(userId, eventId, dto);
  }

  @Get('events/:id/attendees')
  @ApiOperation({ summary: 'Get attendee list with RSVP counts visible to all group members' })
  @ApiResponse({ status: 200, type: [AttendeeResponseDto] })
  getAttendees(
    @Param('id', ParseUUIDPipe) eventId: string,
  ): Promise<AttendeeResponseDto[]> {
    return this.service.getAttendees(eventId);
  }
}
