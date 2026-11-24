import { BadRequestException, Controller, Post, Body, UseGuards, Request, Get, UnauthorizedException } from '@nestjs/common';
import { AuthService } from './auth.service';
import { UsersService } from '../users/users.service';

@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService, private usersService: UsersService) {}

  @Post('register')
  async register(@Body() body: { username: string; password: string }) {
    if (typeof body?.username !== 'string' || typeof body?.password !== 'string' || !body.username.trim() || body.password.length < 8) {
      throw new BadRequestException('Choose a username and a password with at least 8 characters.');
    }
    return this.usersService.createUser(body.username, body.password);
  }

  @Post('login')
  async login(@Body() body: { username: string; password: string }) {
    if (typeof body?.username !== 'string' || typeof body?.password !== 'string') {
      throw new UnauthorizedException('Invalid username or password.');
    }
    const user = await this.authService.validateUser(body.username, body.password);
    if (!user) throw new UnauthorizedException('Invalid username or password.');
    return this.authService.login(user);
  }

  @Post('logout')
  async logout(@Body() body: { userId: number }) {
    return this.authService.logout(body.userId);
  }

  @Post('refresh')
  async refresh(@Body() body: { refreshToken: string }) {
    return this.authService.refreshTokens(body.refreshToken);
  }
}
