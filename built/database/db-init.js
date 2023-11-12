"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const luxon_1 = require("luxon");
const pg_1 = require("pg");
const kysely_1 = require("kysely");
const kanel_1 = require("kanel");
const kanelrc_js_1 = __importDefault(require("./kanelrc.js"));
const dialect = new kysely_1.PostgresDialect({
    pool: new pg_1.Pool({
        database: 'merchant',
        host: 'localhost',
        user: 'dominic',
        port: 5432,
        max: 10,
    }),
});
const db = new kysely_1.Kysely({
    dialect,
});
const args = process.argv.slice(2);
const shouldOverwrite = (args[0] === "-f");
async function main() {
    try {
        if (shouldOverwrite) {
            await db.schema.dropTable("users").ifExists().cascade().execute();
            await db.schema.dropTable("items").ifExists().cascade().execute();
            await db.schema.dropTable("stocks").ifExists().cascade().execute();
            await db.schema.dropTable("commands").ifExists().cascade().execute();
            await db.schema.dropTable("user_items").ifExists().cascade().execute();
            await db.schema.dropTable("user_stocks").ifExists().cascade().execute();
            await db.schema.dropTable("user_cooldowns").ifExists().cascade().execute();
        }
        // USERS
        await db.schema.createTable('users')
            .addColumn('user_id', 'varchar(30)', col => col.notNull().primaryKey())
            .addColumn('balance', 'integer', col => col.notNull().defaultTo(0).check((0, kysely_1.sql) `balance >= 0`))
            .addColumn('activity_points', 'integer', col => col.notNull().defaultTo(0).check((0, kysely_1.sql) `activity_points >= 0`))
            .addColumn('last_activity_date', 'timestamptz', col => col.notNull().defaultTo(luxon_1.DateTime.now().toISO()))
            .addColumn('armor', 'integer', col => col.notNull().defaultTo(0).check((0, kysely_1.sql) `armor >= 0`))
            .execute();
        // ITEMS 
        await db.schema.createTable('items')
            .addColumn('item_id', 'varchar(30)', col => col.notNull().primaryKey())
            .addColumn('price', 'integer', col => col.notNull().defaultTo(0).check((0, kysely_1.sql) `price >= 0`))
            .addColumn('description', 'varchar', col => col.notNull().defaultTo(""))
            .addColumn('usage', 'varchar', col => col.notNull().defaultTo(""))
            .addColumn('emoji_code', 'varchar(30)', col => col.notNull().defaultTo(':black_small_square:'))
            .execute();
        // STOCKS
        await db.schema.createTable('stocks')
            .addColumn('stock_id', 'varchar(30)', col => col.notNull())
            .addColumn('created_date', 'timestamptz', col => col.notNull().defaultTo(luxon_1.DateTime.now().toISO()))
            .addColumn('price', 'integer', col => col.notNull().defaultTo(0).check((0, kysely_1.sql) `price >= 0`))
            .addForeignKeyConstraint('stock_fk_user', ['stock_id'], 'users', ['user_id'], (cb) => cb.onDelete('cascade'))
            .addPrimaryKeyConstraint('stock_pk', ['stock_id', 'created_date'])
            .execute();
        await db.schema
            .createIndex('stock_history')
            .on('stocks')
            .columns(['stock_id'])
            .execute();
        // COMMANDS
        await db.schema.createTable('commands')
            .addColumn('command_id', 'varchar(30)', col => col.notNull().primaryKey())
            .addColumn('description', 'varchar', col => col.notNull().defaultTo(""))
            .addColumn('usage', 'varchar', col => col.notNull().defaultTo(""))
            .addColumn('cooldown_time', 'integer', col => col.notNull().defaultTo(0))
            .addColumn('is_admin', 'boolean', col => col.notNull().defaultTo(false))
            .execute();
        // USER ITEMS
        await db.schema.createTable('user_items')
            .addColumn('user_id', 'varchar(30)', col => col.notNull())
            .addColumn('item_id', 'varchar(30)', col => col.notNull())
            .addColumn('quantity', 'integer', col => col.notNull().defaultTo(1).check((0, kysely_1.sql) `quantity > 0`))
            .addPrimaryKeyConstraint('user_items_pk', ['user_id', 'item_id'])
            .addForeignKeyConstraint('user_items_fk_user', ['user_id'], 'users', ['user_id'], (cb) => cb.onDelete('cascade'))
            .addForeignKeyConstraint('user_items_fk_item', ['item_id'], 'items', ['item_id'], (cb) => cb.onDelete('cascade'))
            .execute();
        // USER STOCKS
        await db.schema.createTable('user_stocks')
            .addColumn('user_id', 'varchar(30)', col => col.notNull())
            .addColumn('stock_id', 'varchar(30)', col => col.notNull())
            .addColumn('purchase_date', 'timestamptz', col => col.notNull().defaultTo(luxon_1.DateTime.now().toISO()))
            .addColumn('quantity', 'integer', col => col.notNull().defaultTo(1).check((0, kysely_1.sql) `quantity > 0`))
            .addColumn('purchase_price', 'integer', col => col.notNull().defaultTo(0).check((0, kysely_1.sql) `purchase_price >= 0`))
            .addPrimaryKeyConstraint('user_stocks_pk', ['user_id', 'stock_id', 'purchase_date'])
            .addForeignKeyConstraint('user_stocks_fk_user', ['user_id'], 'users', ['user_id'], (cb) => cb.onDelete('cascade'))
            .addForeignKeyConstraint('user_stocks_fk_stock', ['stock_id'], 'users', ['user_id'], (cb) => cb.onDelete('cascade'))
            .execute();
        // USER COOLDOWNS
        await db.schema.createTable('user_cooldowns')
            .addColumn('user_id', 'varchar(30)', col => col.notNull())
            .addColumn('command_id', 'varchar(30)', col => col.notNull())
            .addColumn('start_date', 'timestamptz', col => col.notNull().defaultTo(luxon_1.DateTime.now().toISO()))
            .addPrimaryKeyConstraint('user_cooldown_pk', ['user_id', 'command_id'])
            .addForeignKeyConstraint('user_cooldown_fk_user', ['user_id'], 'users', ['user_id'], (cb) => cb.onDelete('cascade'))
            .addForeignKeyConstraint('user_cooldown_fk_command', ['command_id'], 'commands', ['command_id'], (cb) => cb.onDelete('cascade'))
            .execute();
        await (0, kanel_1.processDatabase)(kanelrc_js_1.default);
    }
    catch (error) {
        console.error('An error occurred:', error);
    }
}
main();
