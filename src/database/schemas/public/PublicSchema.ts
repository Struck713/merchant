// @generated
// This file is automatically generated by Kanel. Do not modify manually.

import type { default as UsersTable } from './Users';
import type { default as UserStatsTable } from './UserStats';
import type { default as ItemsTable } from './Items';
import type { default as StocksTable } from './Stocks';
import type { default as CommandsTable } from './Commands';
import type { default as UserActivitiesTable } from './UserActivities';
import type { default as UserItemsTable } from './UserItems';
import type { default as UserStocksTable } from './UserStocks';
import type { default as UserCooldownsTable } from './UserCooldowns';
import type { default as UsersFullTable } from './UsersFull';

export default interface PublicSchema {
  users: UsersTable;

  user_stats: UserStatsTable;

  items: ItemsTable;

  stocks: StocksTable;

  commands: CommandsTable;

  user_activities: UserActivitiesTable;

  user_items: UserItemsTable;

  user_stocks: UserStocksTable;

  user_cooldowns: UserCooldownsTable;

  users_full: UsersFullTable;
}
