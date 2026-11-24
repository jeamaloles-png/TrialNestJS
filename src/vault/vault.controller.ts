import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Request } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { VaultService } from './vault.service';

type AuthenticatedRequest = Request & { user: { userId: number } };

@Controller('vault')
@UseGuards(JwtAuthGuard)
export class VaultController {
  constructor(private readonly vault: VaultService) {}

  private owner(req: AuthenticatedRequest) {
    return Number(req.user?.userId);
  }

  @Get('games')
  listGames(@Req() req: AuthenticatedRequest) {
    return this.vault.listGames(this.owner(req));
  }

  @Post('games')
  addGame(@Req() req: AuthenticatedRequest, @Body() body: { name?: string }) {
    return this.vault.addGame(this.owner(req), body?.name);
  }

  @Delete('games/:id')
  removeGame(@Req() req: AuthenticatedRequest, @Param('id') id: string) {
    return this.vault.removeGame(this.owner(req), id);
  }

  @Get('accounts')
  listAccounts(@Req() req: AuthenticatedRequest, @Query('q') query = '') {
    return this.vault.listAccounts(this.owner(req), query);
  }

  @Post('accounts')
  addAccount(
    @Req() req: AuthenticatedRequest,
    @Body() body: { gameId?: number; username?: string; password?: string; email?: string; notes?: string },
  ) {
    return this.vault.addAccount(this.owner(req), body);
  }

  // Password plaintext is returned only for this authenticated, owner-scoped reveal request.
  @Get('accounts/:id')
  revealAccount(@Req() req: AuthenticatedRequest, @Param('id') id: string) {
    return this.vault.revealAccount(this.owner(req), id);
  }

  @Put('accounts/:id')
  updateAccount(
    @Req() req: AuthenticatedRequest,
    @Param('id') id: string,
    @Body() body: { gameId?: number; username?: string; password?: string; email?: string; notes?: string },
  ) {
    return this.vault.updateAccount(this.owner(req), id, body);
  }

  @Delete('accounts/:id')
  deleteAccount(@Req() req: AuthenticatedRequest, @Param('id') id: string) {
    return this.vault.deleteAccount(this.owner(req), id);
  }
}
