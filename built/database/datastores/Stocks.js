"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Stocks = void 0;
const DataStore_1 = require("./DataStore");
const luxon_1 = require("luxon");
const kysely_1 = require("kysely");
const Users_1 = require("./Users");
class Stocks extends DataStore_1.DataStore {
    // caches the 'now' stock history for each stock
    async refreshCache() {
        const latestStocks = await this.getLatestStocks();
        console.log("Cache retrieved: ");
        console.log(latestStocks);
        for (const latestStock of latestStocks) {
            const stockHistory = await this.getStockHistory(latestStock.stock_id, 'now');
            console.log("Stock history: ");
            console.log(stockHistory);
            this.cache.set(latestStock[this.tableID], stockHistory);
        }
    }
    async getTotalSharesPurchased(stock_id) {
        const result = await this.db
            .selectFrom('user_stocks')
            .select(eb => eb.fn.sum('quantity').as('total_shares_purchased'))
            .where('stock_id', '=', stock_id)
            .executeTakeFirst();
        return Number(result.total_shares_purchased) ?? 0;
    }
    async getFromDB(id) {
        return await this.db
            .selectFrom('stocks')
            .selectAll()
            .where('stock_id', '=', id)
            .orderBy('created_date desc')
            .executeTakeFirst();
    }
    async set(id, data = {}) {
        // create the user associated with this stock if they dont exist
        await Users_1.Users.set(id);
        const newData = {
            stock_id: id,
            created_date: data.created_date ?? luxon_1.DateTime.now().toISO(),
            ...data
        };
        await DataStore_1.db.transaction().execute(async (trx) => {
            const result = await trx
                .insertInto('stocks')
                .values(newData)
                .returningAll()
                .executeTakeFirstOrThrow();
            let cachedStockHistory = this.cache.get(id);
            if (cachedStockHistory) {
                cachedStockHistory.pop();
                cachedStockHistory.unshift(result);
            }
            else {
                this.cache.set(id, [result]);
            }
        });
    }
    async updateStockPrice(stock_id, amount) {
        if (amount < 0)
            amount = 0;
        this.set(stock_id, { price: amount });
    }
    async getLatestStocks() {
        let latestStocks = [];
        if (this.cache.size) {
            for (const stockId of this.cache.keys()) {
                const stockCache = this.cache.get(stockId);
                if (stockCache[0]) {
                    latestStocks.push(stockCache[0]);
                }
            }
        }
        else {
            try {
                latestStocks = await this.db
                    .selectFrom('stocks as s1')
                    .selectAll()
                    .innerJoin(eb => eb
                    .selectFrom('stocks')
                    .select(['stock_id', eb => eb.fn.max('created_date').as('max_created_date')])
                    .groupBy('stock_id')
                    .as('s2'), join => join.onRef('s1.stock_id', '=', 's2.stock_id').onRef('s1.created_date', '=', 's2.max_created_date'))
                    .orderBy('s1.created_date', 'desc')
                    .execute();
            }
            catch (error) {
                console.error("Error getting latest stocks: ", error);
            }
        }
        return latestStocks;
    }
    async getLatestStock(stock_id) {
        return await this.get(stock_id);
    }
    async getStockHistory(stock_id, interval) {
        // only 'now' is stored in the cache currently
        if (interval === 'now' && this.getFromCache(stock_id)) {
            console.log("History cache");
            // cache hit on 'now'
            return this.cache.get(stock_id);
        }
        let intervalOffset;
        switch (interval) {
            case 'now':
                intervalOffset = { minutes: 60 };
                break;
            case 'hour':
                intervalOffset = { hours: 24 };
                break;
            case 'day':
                intervalOffset = { days: 30 };
                break;
            case 'month':
                intervalOffset = { months: 6 };
                break;
        }
        const oldestStockDate = luxon_1.DateTime.now().minus(intervalOffset).toISO();
        const stockHistory = await this.db
            .selectFrom('stocks as s1')
            .innerJoin(eb => eb
            .selectFrom('stocks')
            .select([
            'stock_id',
            eb => eb.fn.max('created_date').as('max_created_date'),
            eb => (0, kysely_1.sql) `extract(${kysely_1.sql.raw(interval === 'now' ? 'minute' : interval)} from ${eb.ref('created_date')})`.as('created_interval')
        ])
            .groupBy('created_interval')
            .groupBy('stock_id')
            .as('s2'), join => join.onRef('s1.stock_id', '=', 's2.stock_id').onRef('s1.created_date', '=', 's2.max_created_date'))
            .selectAll()
            .where('s1.stock_id', '=', stock_id)
            .where('s1.created_date', '>=', oldestStockDate)
            .orderBy('s1.created_date', 'desc')
            .execute();
        return stockHistory;
    }
    constructor(db) {
        super(db, 'stocks', 'stock_id');
    }
}
const stocks = new Stocks(DataStore_1.db);
exports.Stocks = stocks;
