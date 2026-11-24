import { BadRequestException, Body, Controller, Delete, Get, NotFoundException, Param, Post, Put, Req, UseGuards } from '@nestjs/common';
import { Request } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { GamesService } from './games.service';

@Controller()
@UseGuards(JwtAuthGuard)
export class GamesController {
  constructor(private readonly games: GamesService) {}
  private async run<T>(fn: () => Promise<T>): Promise<T> {
    try { return await fn(); }
    catch (e) {
      const message = e instanceof Error ? e.message : 'Database request failed';
      if (message.startsWith('Unknown table') || message.startsWith('Unknown column') || message.startsWith('Provide')) throw new BadRequestException(message);
      if (message.startsWith('Table ')) throw new NotFoundException(message);
      throw e;
    }
  }
  @Get('health') health() { return this.run(() => this.games.health()); }
  @Get(':table/schema') schema(@Param('table') table: string) { return this.run(() => this.games.schema(table)); }
  @Get(':table') all(@Param('table') table: string, @Req() req: Request & { user: { userId: number } }) { return this.run(() => this.games.all(table, Number(req.user.userId))); }
  @Get(':table/:id') one(@Param('table') table: string, @Param('id') id: string, @Req() req: Request & { user: { userId: number } }) {
    return this.run(async () => {
      const row = await this.games.one(table, id, Number(req.user.userId));
      if (!row) throw new NotFoundException('Record not found');
      return row;
    });
  }
  @Post(':table') create(@Param('table') table: string, @Body() body: Record<string, unknown>, @Req() req: Request & { user: { userId: number } }) { return this.run(() => this.games.create(table, body, Number(req.user.userId))); }
  @Put(':table/:id') update(@Param('table') table: string, @Param('id') id: string, @Body() body: Record<string, unknown>, @Req() req: Request & { user: { userId: number } }) { return this.run(() => this.games.update(table, id, body, Number(req.user.userId))); }
  @Delete(':table/:id') remove(@Param('table') table: string, @Param('id') id: string, @Req() req: Request & { user: { userId: number } }) { return this.run(() => this.games.remove(table, id, Number(req.user.userId))); }
}


