// @generated
// This file is automatically generated by Kanel. Do not modify manually.

import type UsersTable from "./Users";
import type ItemsTable from "./Items";
import type StocksTable from "./Stocks";
import type CommandsTable from "./Commands";
import type UserActivitiesTable from "./UserActivities";
import type UserItemsTable from "./UserItems";
import type UserStocksTable from "./UserStocks";
import type UserCooldownsTable from "./UserCooldowns";

export default interface PublicSchema {
    users: UsersTable;

    items: ItemsTable;

    stocks: StocksTable;

    commands: CommandsTable;

    user_activities: UserActivitiesTable;

    user_items: UserItemsTable;

    user_stocks: UserStocksTable;

    user_cooldowns: UserCooldownsTable;
}
