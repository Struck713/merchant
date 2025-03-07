// @generated
// This file is automatically generated by Kanel. Do not modify manually.

import type { ColumnType, Selectable, Insertable, Updateable } from 'kysely';

/** Identifier type for public.items */
export type ItemsItemId = string & { __brand: 'ItemsItemId' };

/** Identifier type for public.items */
export type ItemsGuildId = string & { __brand: 'ItemsGuildId' };

/** Represents the table public.items */
export default interface ItemsTable {
  item_id: ColumnType<ItemsItemId, ItemsItemId, ItemsItemId>;

  guild_id: ColumnType<ItemsGuildId, ItemsGuildId, ItemsGuildId>;

  price: ColumnType<number, number | undefined, number>;

  description: ColumnType<string, string | undefined, string>;

  usage: ColumnType<string, string | undefined, string>;

  emoji_code: ColumnType<string, string | undefined, string>;
}

export type Items = Selectable<ItemsTable>;

export type NewItems = Insertable<ItemsTable>;

export type ItemsUpdate = Updateable<ItemsTable>;
