import { Module } from '@nestjs/common';
import { UsersModule } from './users/users.module';
import { AuthModule } from './auth/auth.module';
import { DatabaseModule } from './database/database.module';
import { GamesModule } from './games/games.module';
import { VaultModule } from './vault/vault.module';

// Register the explicit /vault routes before the legacy /:table/:id routes.
@Module({ imports: [DatabaseModule, UsersModule, AuthModule, VaultModule, GamesModule] })
export class AppModule {}
