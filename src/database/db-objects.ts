import { Kysely, PostgresDialect, Updateable, Insertable, sql, Selectable } from 'kysely';
import { Users as User, NewUsers as NewUser, UsersUpdate as UserUpdate, UsersUserId } from './schemas/public/Users';
import { Items as Item, NewItems as NewItem, ItemsUpdate as ItemUpdate, ItemsItemId } from './schemas/public/Items';
import { Stocks as Stock, NewStocks as NewStock, StocksUpdate as StockUpdate } from './schemas/public/Stocks';
import { UserItems as UserItem, NewUserItems as NewUserItem, UserItemsUpdate as UserItemUpdate } from './schemas/public/UserItems';
import Database from './schemas/Database';

import { Collection } from 'discord.js';
import path from 'path';
import fs from 'fs';
import { Pool } from 'pg';

const dialect = new PostgresDialect({
    pool: new Pool({
        database: 'merchant',
        host: 'localhost',
        user: 'dominic',
        port: 5432,
        max: 10,
    }),
});

const db = new Kysely<Database>({
    dialect,
});

type TableName = keyof Database;
type TableID = 'user_id' | 'item_id';

abstract class DataStore<Data> {
    protected cache: Collection<string, Data>;
    protected db: Kysely<Database>;
    protected tableName: TableName;
    protected tableID: TableID;

    async refreshCache(): Promise<void> {
        if (this.db && this.tableName && this.tableID) {
            const results: Data[] = await db.selectFrom('users').selectAll().execute() as Data[];

            results.forEach(result => {
                this.cache.set(result[this.tableID], result);
            });
        }
    }

    async destroyDB() {
        db.destroy();
    }

    async delete(id: string): Promise<void> {
        this.cache.delete(id);

        if (this.db && this.tableName && this.tableID) {
            await this.db
                .deleteFrom(this.tableName as any)
                .where(this.tableID, '=', id as any)
                .executeTakeFirst();
        }
    }

    async get(id: string): Promise<Data | null> {
        if (this.cache.has(id)) {
            return this.cache.get(id);
        }

        if (this.db && this.tableName && this.tableID) {
            const result: Data = await this.db
                .selectFrom(this.tableName)
                .selectAll()
                .where(this.tableID, '=', id as any)
                .executeTakeFirst() as Data;
            return result;
        }

        return null;
    }

    async set(id: string, data: Insertable<Data> | Updateable<Data> = {}): Promise<void> {
        let result: Data;
        if (this.db && this.tableName && this.tableID) {
            result = await this.db
                .selectFrom(this.tableName as any)
                .selectAll()
                .where(this.tableID, '=', id as any)
                .executeTakeFirst() as Data;
            
            if (result) {
                await this.db
                    .updateTable(this.tableName)
                    .set(data)
                    .where(this.tableID, '=', id as any)
                    .execute();
            } else {
                result = await this.db
                    .insertInto(this.tableName)
                    .values({ [this.tableID]: id, ...data })
                    .returningAll()
                    .executeTakeFirst() as Data;
            }
        }
        
        this.cache.set(id, { ...result, ...data });
    }

    constructor(db: Kysely<Database> | null = null, tableName: TableName | null = null, tableID: TableID | null = null) {
        this.cache = new Collection<TableID, Data>();
        this.db = db;
        this.tableName = tableName;
        this.tableID = tableID;
    }
}

class Users extends DataStore<User> {
    // TODO: should make a transaction?
    async addBalance(user_id: string, amount: number): Promise<void> {
        const user: User | null = await this.get(user_id);
        
        let newBalance = user ? (user.balance + amount) : amount;
        if (newBalance < 0) newBalance = 0;

        await this.set(user_id, {
            user_id: user_id as UsersUserId,
            balance: newBalance
        });
    }
    
    async addItem(user_id: string, item_id: string): Promise<void> {
        const userItem = await this.db
            .selectFrom('user_items')
            .selectAll()
            .where('user_id', '=', user_id as any)
            .where('item_id', '=', item_id as any)
            .executeTakeFirst();
        if (userItem) {
            await this.db
                .updateTable('user_items')
                .set({
                    quantity: (++userItem.quantity)
                })
                .where('user_id', '=', user_id as any)
                .where('item_id', '=', item_id as any)
                .execute();
        } else {
            await this.db
                .insertInto('user_items')
                .values({ user_id: user_id as UsersUserId, item_id: item_id as ItemsItemId })
                .execute();
        }
    }

    async removeItem(user_id: string, item_id: string): Promise<void> {
        const userItem = await this.db
            .selectFrom('user_items')
            .selectAll()
            .where('user_id', '=', user_id as any)
            .where('item_id', '=', item_id as any)
            .executeTakeFirst();

        if (userItem) {
            userItem.quantity -= 1;
            if (userItem.quantity <= 0) {
                await this.db
                    .deleteFrom('user_items')
                    .where('user_id', '=', user_id as any)
                    .where('item_id', '=', item_id as any)
                    .execute();               
            } else {
                await this.db
                    .updateTable('user_items')
                    .set({
                        quantity: userItem.quantity
                    })
                    .where('user_id', '=', user_id as any)
                    .where('item_id', '=', item_id as any)
                    .execute();
            }
        }
    }

    async getItem(user_id: string, item_id: string): Promise<UserItem | null> {
        const userItem: UserItem = await this.db
            .selectFrom('user_items')
            .selectAll()
            .where('user_id', '=', user_id as any)
            .where('item_id', '=', item_id as any)
            .executeTakeFirst() as UserItem;
        
        return userItem;
    }

    async getItems(user_id: string): Promise<UserItem[]> {
        const userItems: UserItem[] = await this.db
            .selectFrom('user_items')
            .selectAll()
            .where('user_id', '=', user_id as any)
            .execute() as UserItem[];
        return userItems;
    }

    constructor(db: Kysely<Database> | null) {
        super(db, 'users', 'user_id');
    }
}


// class Commands extends DataStore<Command> {
//     async refreshCache(): Promise<void> {
//         const foldersPath: string = path.join(process.cwd(), 'commands');
//         const commandFolders: string[] = fs.readdirSync(foldersPath);

//         for (const folder of commandFolders) {
//             const commandsPath: string = path.join(foldersPath, folder);
//             const commandFiles: string[] = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));
//             for (const file of commandFiles) {
//                 const filePath: string = path.join(commandsPath, file);
//                 const command: Command = await import(filePath);
//                 if ('data' in command && 'execute' in command) {
//                     this.cache.set(command.data.name, command);
//                 } else {
//                     console.log(`[WARNING] The command at ${filePath} is missing a required "data" or "execute" property.`);
//                 }
//             }
//         }
//     }
// }

// class Items extends DataStore<Item> {
//     async refreshCache(): Promise<void> {
//         const itemsPath = path.join(process.cwd(), 'items');
//         const itemFiles = fs.readdirSync(itemsPath).filter(file => file.endsWith('.js'));
//         for (const file of itemFiles) {
//             const filePath = path.join(itemsPath, file);
//             const item: Item = await import(filePath);
//             if ('data' in item && 'use' in item) {
//                 this.cache.set(item.data., item);
//             } else {
//                 console.log(`[WARNING] The item at ${filePath} is missing a required "data" or "use" property.`);
//             }
//         }
//     }
// }

// class Stocks extends DataStore<Stock> {

// }

const users = new Users(db);

export { users as Users };

