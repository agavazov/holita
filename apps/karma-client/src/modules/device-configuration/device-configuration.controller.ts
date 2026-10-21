import { Body, Controller, HttpCode, Post, UseGuards } from '@nestjs/common';
import { DeviceConfigurationGuard } from './device-configuration.guard.js';
import { DeviceConfigurationService } from './device-configuration.service.js';

@Controller('internal/device-configuration')
@UseGuards(DeviceConfigurationGuard)
export class DeviceConfigurationController {
  constructor(private readonly configurations: DeviceConfigurationService) {}

  @Post('target')
  @HttpCode(200)
  target(@Body() body: unknown) {
    return this.configurations.target(body);
  }

  @Post('request')
  @HttpCode(200)
  request(@Body() body: unknown) {
    return this.configurations.request(body);
  }

  @Post('profile-request')
  @HttpCode(200)
  profileRequest(@Body() body: unknown) {
    return this.configurations.requestProfile(body);
  }

  @Post('parameter-request')
  @HttpCode(200)
  parameterRequest(@Body() body: unknown) {
    return this.configurations.requestParameter(body);
  }

  @Post('observations')
  @HttpCode(200)
  observations(@Body() body: unknown) {
    return this.configurations.observations(body);
  }

  @Post('profile-observations')
  @HttpCode(200)
  profileObservations(@Body() body: unknown) {
    return this.configurations.profileObservations(body);
  }
}
