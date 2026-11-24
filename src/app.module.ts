import { Module } from '@nestjs/common';
import { UsersModule } from './users/users.module';
import { AuthModule } from './auth/auth.module';
import { DatabaseModule } from './database/database.module';
import { GamesModule } from './games/games.module';
import { VaultModule } from './vault/vault.module';

@Module({ imports: [DatabaseModule, UsersModule, AuthModule, GamesModule, VaultModule] })
export class AppModule {}
