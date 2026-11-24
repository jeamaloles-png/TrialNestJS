import { Module } from '@nestjs/common';
import { VaultController } from './vault.controller';
import { VaultService } from './vault.service';
import { DatabaseModule } from '../database/database.module';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Module({
  imports: [DatabaseModule],
  controllers: [VaultController],
  providers: [VaultService, JwtAuthGuard],
})
export class VaultModule {}
